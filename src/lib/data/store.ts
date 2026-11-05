/**
 * Store externo (para useSyncExternalStore) con el único estado de corrida
 * que expone el backend: solo puede haber una corrida activa a la vez
 * (POST /simulaciones responde 409 si ya hay una en curso), así que un
 * único store global — no un store por pantalla — refleja fielmente el
 * backend.
 *
 * No usa React Context a propósito: así las pantallas (incluida
 * "operaciones diarias") no necesitan envolverse
 * en un Provider para compartir la corrida.
 */

import * as api from "@/lib/backend/api";
import { ErrorServicio } from "@/lib/backend/api";
import { abrirCanal, type EstadoCanal } from "@/lib/backend/canal";
import { esFinal, inicial, reducir, type Accion, type EstadoSim } from "@/lib/backend/estado";
import type { InstantaneaSimulacion, RespuestaAveria, RespuestaSalud, VistaAlmacen, VistaParametros } from "@/lib/backend/types";
import {
  BACKEND_ACCEPTS,
  BUFFER_FILL_TIMEOUT_MS,
  BUFFER_SIZE,
  BURST_GAP_MS,
  CATCHUP_RATE,
  COLLAPSE_SNAPSHOT_MINUTES,
  DEFAULT_BUFFER_VARIANT,
  FALLBACK_MS_PER_SIM_MINUTE,
  PENDING_CHANGE_TIMEOUT_MS,
  PENDING_ERROR_VISIBLE_MS,
  PLAYBACK_CONTROL,
  PLAYBACK_RATE_WINDOW,
  PLAYBACK_TICK_MS,
  RECENT_DELIVERIES_WINDOW_MIN,
  type BufferVariant,
} from "@/config/simulacion";
import * as playback from "@/lib/data/playback";
import { emptyTripLog, observe, type TripLog } from "@/lib/data/trips";
import { filaPedidoToFirstLate, fleetToFlotaBody, TIPO_POR_KIND, TIPO_POR_MODO, vistaUnidadToVehicle } from "@/lib/data/adapters";
import { SIMULATION_DAYS_5D } from "@/lib/constants";
import { proposedRunFields } from "@/lib/sim-settings";
import { addDays, parseISODate, toISODate } from "@/lib/format";
import type { FirstLateOrder, FleetCount, FleetSettings, SimSettings, SimulationMode, TrafficLight, VehicleKind } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

/** Lo que el buffer muestra ahora (puede ir por detrás de `estado.instantanea`, la última recibida). */
export interface Reproduccion {
  instantanea: InstantaneaSimulacion | null;
  /** Duración de la transición hacia esta foto (la usa la animación del mapa). */
  duracionMs: number;
  /** "llenando" = aviso "Cargando…" inicial. */
  fase: "inactiva" | "llenando" | "reproduciendo";
  /** Fotos en cola y su objetivo, para el aviso de carga. */
  enCola: number;
  objetivo: number;
  variante: BufferVariant;
  /** Desfase esperado del buffer respecto del servidor, en ms reales. */
  retrasoMs: number;
}

/**
 * Cambio enviado por el usuario que aún no se ve en el mapa. `minuto` es el
 * minuto simulado en que el servidor lo aplicó (llega con la respuesta).
 */
export interface CambioPendiente {
  id: number;
  placa: string;
  minuto: number | null;
  desde: number;
  estado: "aplicando" | "error";
  /** Solo en estado "error": hasta cuándo se muestra el aviso. */
  hasta?: number;
}

export interface Store {
  estado: EstadoSim;
  canal: EstadoCanal;
  salud: RespuestaSalud | null;
  parametros: VistaParametros | null;
  almacenes: VistaAlmacen[];
  averiasSesion: RespuestaAveria[];
  firstLateOrder: FirstLateOrder | null;
  firstLateOrderFor: string | null;
  /** Cantidades aceptadas por PUT /parametros/flota (null mientras el backend no lo implemente). */
  cantidadesFlota: FleetCount | null;
  reproduccion: Reproduccion;
  cambiosPendientes: CambioPendiente[];
  /** Origen, salida y entregas estimados a partir de la foto reproducida (ver trips.ts). */
  recorridos: TripLog;
  /** Configuración que eligió el usuario al iniciar la corrida (se muestra en solo lectura). */
  ajustesCorrida: AjustesCorrida | null;
}

export type AjustesCorrida = { runId: string; settings: SimSettings; fleet: FleetSettings | null };

const initialStore: Store = {
  estado: inicial,
  canal: "conectando",
  salud: null,
  parametros: null,
  almacenes: [],
  averiasSesion: [],
  firstLateOrder: null,
  firstLateOrderFor: null,
  cantidadesFlota: null,
  reproduccion: { instantanea: null, duracionMs: 0, fase: "inactiva", enCola: 0, objetivo: BUFFER_SIZE[DEFAULT_BUFFER_VARIANT], variante: DEFAULT_BUFFER_VARIANT, retrasoMs: 0 },
  cambiosPendientes: [],
  recorridos: emptyTripLog(),
  ajustesCorrida: null,
};

let state: Store = initialStore;
const listeners = new Set<() => void>();

function set(patch: Partial<Store>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getSnapshot(): Store {
  return state;
}
/** Mismo valor "vacío" en el servidor: evita divergencias de hidratación. */
export function getServerSnapshot(): Store {
  return initialStore;
}

function msg(e: unknown) {
  return e instanceof ErrorServicio ? e.message : "No se pudo contactar con el servidor.";
}

function dispatch(a: Accion) {
  const prev = state.estado;
  const next = reducir(prev, a);
  if (next === prev) return;
  const nuevaCorrida = next.idActual !== prev.idActual;
  if (nuevaCorrida) reiniciarReproduccion(next.idActual);
  // Al buffer van todas las fotos (también las de una ráfaga que el reducer
  // ya superó con otra más nueva); él descarta duplicadas y atrasadas.
  const foto = a.t === "ws" ? (a.m.tipo === "instantanea" ? a.m.carga : null) : a.t === "detalle" ? a.d.instantanea : null;
  const id = a.t === "ws" ? a.m.corrida : a.t === "detalle" ? a.d.corrida.id : null;
  if (foto && id === next.idActual) pb = playback.receive(pb, foto, pbConfig());
  if (esFinal(next.corrida?.estado) || next.resultado) pb = playback.markEnded(pb);
  set({
    estado: next,
    ...(nuevaCorrida ? { averiasSesion: [], firstLateOrder: null, firstLateOrderFor: null, cambiosPendientes: [] } : {}),
  });
  publicarReproduccion();
  fetchFirstLateIfNeeded(next);
}

// ---- Reproducción con buffer (ver src/lib/data/playback.ts) ---------------

let pb: playback.PlaybackState<InstantaneaSimulacion> = playback.idle();
let variante: BufferVariant = DEFAULT_BUFFER_VARIANT;

const pbConfig = (): playback.PlaybackConfig => ({
  target: BUFFER_SIZE[variante],
  fillTimeoutMs: BUFFER_FILL_TIMEOUT_MS,
  catchUpRate: CATCHUP_RATE,
  ...PLAYBACK_CONTROL,
  rateWindow: PLAYBACK_RATE_WINDOW,
  fallbackMsPerMinute: FALLBACK_MS_PER_SIM_MINUTE,
  burstGapMs: BURST_GAP_MS,
});

function reiniciarReproduccion(id: string | null) {
  pb = id ? playback.start(id, Date.now(), pbConfig()) : playback.idle();
}

/** Elige la variante del buffer (?buffer= en la URL). Se aplica en caliente: el control ajusta la cola. */
export function fijarVarianteBuffer(v: BufferVariant) {
  if (v === variante) return;
  variante = v;
  publicarReproduccion();
}

function publicarReproduccion() {
  const r = state.reproduccion;
  const cfg = pbConfig();
  const next: Reproduccion = {
    instantanea: pb.played,
    duracionMs: pb.durationMs,
    fase: pb.phase === "idle" ? "inactiva" : pb.phase === "filling" ? "llenando" : "reproduciendo",
    enCola: pb.queue.length,
    objetivo: cfg.target,
    variante,
    retrasoMs: playback.expectedLagMs(pb, cfg),
  };
  // El registro de recorridos sigue a la foto que se muestra (no a la última recibida).
  const recorridos = next.instantanea && next.instantanea !== r.instantanea ? registrarRecorridos(next.instantanea) : state.recorridos;
  if (next.instantanea === r.instantanea && next.fase === r.fase && next.enCola === r.enCola && next.objetivo === r.objetivo && next.variante === r.variante && Math.round(next.retrasoMs / 1000) === Math.round(r.retrasoMs / 1000)) return;
  set({ reproduccion: next, recorridos });
}

function registrarRecorridos(foto: InstantaneaSimulacion): TripLog {
  return observe(state.recorridos, {
    runId: state.estado.idActual,
    minute: foto.minutoSimulado,
    vehicles: foto.unidades.map(vistaUnidadToVehicle),
    warehouses: foto.almacenes.map((a) => ({ id: String(a.id), position: { x: a.x, y: a.y } })),
    windowMin: RECENT_DELIVERIES_WINDOW_MIN,
  });
}

/**
 * Un cambio queda aplicado cuando se muestra la primera foto con minuto ≥ al
 * que informó el servidor y en ella la unidad ya figura averiada. El backend
 * de simulaciones no marca versión/plan en la instantánea; con un `revision`
 * (como /api/operaciones) bastaría comparar números.
 */
function revisarPendientes(now: number) {
  const foto = pb.played;
  let cambio = false;
  const quedan = state.cambiosPendientes.flatMap((c): CambioPendiente[] => {
    if (c.estado === "error") {
      if (now < (c.hasta ?? 0)) return [c];
      cambio = true;
      return [];
    }
    const visible = c.minuto != null && foto && foto.minutoSimulado >= c.minuto
      && foto.unidades.some((u) => u.codigo === c.placa && u.tipoAveria > 0);
    if (visible) { cambio = true; return []; }
    if (now - c.desde > PENDING_CHANGE_TIMEOUT_MS) {
      cambio = true;
      return [{ ...c, estado: "error", hasta: now + PENDING_ERROR_VISIBLE_MS }];
    }
    return [c];
  });
  if (cambio) set({ cambiosPendientes: quedan });
}

function tickReproduccion() {
  const now = Date.now();
  pb = playback.advance(pb, now, pbConfig());
  publicarReproduccion();
  if (state.cambiosPendientes.length) revisarPendientes(now);
}

let secuenciaCambios = 0;

/** Cuando llega el resultado, resuelve el detalle del primer pedido incumplido (solo IDs vienen en el resultado). */
function fetchFirstLateIfNeeded(estado: EstadoSim) {
  const r = estado.resultado;
  const corridaId = estado.idActual;
  const primerDia = estado.corrida?.primerDia;
  if (!r || r.pedidoDelPrimerIncumplimiento < 0 || !corridaId || !primerDia) return;
  if (state.firstLateOrderFor === corridaId) return;
  set({ firstLateOrderFor: corridaId });
  api.paginaPedidos(corridaId, { busqueda: String(r.pedidoDelPrimerIncumplimiento), tamano: 1, soloActivos: false })
    .then((pagina) => {
      const fila = pagina.filas.find((f) => f.id === r.pedidoDelPrimerIncumplimiento);
      if (fila) set({ firstLateOrder: filaPedidoToFirstLate(fila, primerDia) });
    })
    .catch(() => {});
}

/**
 * Olvida la corrida actual del lado del cliente (no llama al backend: la
 * corrida ya terminó, no hay nada que cancelar). Sin esto, "Nueva
 * simulación" no podía funcionar: el store seguía viendo la corrida
 * terminada como activa, así que la pantalla volvía a mostrar el mismo
 * resumen en vez de dejar configurar una corrida nueva.
 */
export function olvidarCorrida() {
  olvidada = state.estado.idActual;
  reiniciarReproduccion(null);
  set({ estado: inicial, averiasSesion: [], firstLateOrder: null, firstLateOrderFor: null, cambiosPendientes: [], recorridos: emptyTripLog() });
  publicarReproduccion();
}

/** Corrida terminada que el usuario descartó: /salud podría seguir reportándola. */
let olvidada: string | null = null;

/**
 * Consulta /salud y adopta la corrida activa del backend si el store aún no
 * la sigue. Cubre las corridas iniciadas antes de cargar la página o desde
 * otra sesión cuando el WebSocket no las anunció (caído o reconectando).
 */
export async function sincronizarActiva() {
  try {
    const salud = await api.obtenerSalud();
    set({ salud });
    const id = salud.corridaActiva;
    if (id && id !== state.estado.idActual && id !== olvidada) dispatch({ t: "seleccionar", id });
  } catch {
    // se reintenta en el siguiente ciclo
  }
}

// ---- Arranque (idempotente) ----------------------------------------------

let started = false;
let canalCtrl: ReturnType<typeof abrirCanal> | null = null;

export function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ ajustesCorrida: leerAjustes() });

  sincronizarActiva();
  setInterval(sincronizarActiva, 5000);
  api.obtenerAlmacenes().then((almacenes) => set({ almacenes })).catch(() => {});
  api.obtenerParametros().then((parametros) => set({ parametros })).catch(() => {});

  canalCtrl = abrirCanal(
    (m) => dispatch({ t: "ws", m }),
    (canal) => set({ canal }),
  );

  pollLoop();
  setInterval(tickReproduccion, PLAYBACK_TICK_MS);
}

function pollLoop() {
  const tick = async () => {
    const id = state.estado.idActual;
    if (id && !esFinal(state.estado.corrida?.estado)) {
      try {
        const d = await api.detalleCorrida(id);
        dispatch({ t: "detalle", d });
      } catch {
        // se mantiene el último estado conocido; se reintenta en el siguiente ciclo
      }
    }
    setTimeout(tick, 1000);
  };
  tick();
}

export const reintentarCanal = () => canalCtrl?.reintentar();

// ---- Acciones --------------------------------------------------------------

// La configuración ampliada solo vive en el frontend (el backend aún no la
// guarda): se recuerda por pestaña para mostrarla tras recargar la página.
const CLAVE_AJUSTES = "kindbox.ajustesCorrida";

function leerAjustes(): AjustesCorrida | null {
  try {
    const raw = window.sessionStorage.getItem(CLAVE_AJUSTES);
    return raw ? (JSON.parse(raw) as AjustesCorrida) : null;
  } catch {
    return null;
  }
}

function guardarAjustes(a: AjustesCorrida) {
  set({ ajustesCorrida: a });
  try {
    window.sessionStorage.setItem(CLAVE_AJUSTES, JSON.stringify(a));
  } catch {
    // sin almacenamiento: se conserva solo en memoria
  }
}

export async function arrancar(
  mode: SimulationMode,
  input: { startDate: string; trafficLight: TrafficLight; settings?: SimSettings; fleet?: FleetSettings },
): Promise<Result<{ id: string }>> {
  ensureStarted();
  if (state.estado.idActual && !esFinal(state.estado.corrida?.estado)) {
    return { ok: false, message: "Ya hay una corrida activa. Para iniciar otra, cancélala explícitamente desde su pantalla." };
  }
  try {
    const parametros = await api.cambiarSemaforo(input.trafficLight.redTo, input.trafficLight.amberTo);
    set({ parametros });
    const start = parseISODate(input.startDate);
    // Un 409 se muestra al usuario. Iniciar nunca autoriza cancelar la corrida
    // compartida, que otra sesión puede haber arrancado mientras tanto.
    const r = await api.arrancarCorrida({
      tipo: TIPO_POR_MODO[mode],
      primerDia: input.startDate,
      ...(mode === "5d"
        ? { ultimoDia: toISODate(addDays(start, SIMULATION_DAYS_5D - 1)) }
        // Escenario abierto: el backend carga mes a mes desde primerDia hasta el colapso.
        : { minutosEntreFotografias: COLLAPSE_SNAPSHOT_MINUTES }),
      ...(input.settings ? proposedRunFields(input.settings, BACKEND_ACCEPTS) : {}),
    });
    if (input.settings) guardarAjustes({ runId: r.id, settings: input.settings, fleet: input.fleet ?? null });
    dispatch({ t: "seleccionar", id: r.id });
    dispatch({ t: "ws", m: { tipo: "corrida", corrida: r.id, carga: r } });
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/**
 * Cancela la corrida actual. Con `idEsperado`, solo si sigue siendo la que el
 * usuario vio al confirmar: la corrida compartida pudo cambiar entretanto.
 */
export async function cancelar(idEsperado?: string): Promise<Result> {
  const id = state.estado.idActual;
  if (!id) return { ok: false, message: "No hay ninguna corrida activa para cancelar." };
  if (idEsperado && id !== idEsperado) return { ok: false, message: "La corrida que intentas detener ya no es la actual." };
  try {
    const r = await api.cancelarCorrida(id);
    dispatch({ t: "ws", m: { tipo: "corrida", corrida: id, carga: r } });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function registrarAveria(placa: string, tipo: 1 | 2 | 3): Promise<Result> {
  const id = state.estado.idActual;
  if (!id) return { ok: false, message: "No hay ninguna corrida activa." };
  // Indicador "Aplicando cambios…" desde el envío hasta verlo en el mapa.
  const pendiente: CambioPendiente = { id: ++secuenciaCambios, placa, minuto: null, desde: Date.now(), estado: "aplicando" };
  set({ cambiosPendientes: [...state.cambiosPendientes, pendiente] });
  const quitar = () => set({ cambiosPendientes: state.cambiosPendientes.filter((c) => c.id !== pendiente.id) });
  try {
    const r = await api.registrarAveria(id, placa, tipo);
    if (state.estado.idActual !== id) { quitar(); return { ok: true }; }
    // Las fotos en cola muestran el plan anterior: en lugar de descartarlas
    // (salto brusco) se reproducen más rápido hasta el minuto del cambio.
    pb = playback.requestCatchUp(pb, r.minutoSimulado);
    set({
      averiasSesion: [r, ...state.averiasSesion],
      cambiosPendientes: state.cambiosPendientes.map((c) => (c.id === pendiente.id ? { ...c, minuto: r.minutoSimulado } : c)),
    });
    return { ok: true };
  } catch (e) {
    quitar();
    return { ok: false, message: msg(e) };
  }
}

export async function cargarAveriasMasivo(archivo: File): Promise<Result<{ registered: number }>> {
  const id = state.estado.idActual;
  if (!id) return { ok: false, message: "No hay ninguna corrida activa." };
  try {
    const r = await api.cargarAverias(id, archivo);
    return { ok: true, data: { registered: r.aplicadas } };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/**
 * Guarda la flota por tipo. Las velocidades usan PUT /parametros/velocidad
 * (existe); las cantidades, el endpoint propuesto PUT /parametros/flota
 * (TODO backend, ver api.cambiarFlota). Solo se envía lo que cambió.
 */
export async function guardarFlota(next: FleetSettings, prev: FleetSettings): Promise<Result> {
  const kinds = Object.keys(TIPO_POR_KIND) as VehicleKind[];
  const speeds = kinds.filter((k) => next[k].speed !== prev[k].speed);
  const quantities = kinds.some((k) => next[k].quantity !== prev[k].quantity);
  try {
    for (const k of speeds) set({ parametros: await api.cambiarVelocidad(TIPO_POR_KIND[k], next[k].speed) });
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
  if (!quantities) return { ok: true };
  try {
    const parametros = await api.cambiarFlota(fleetToFlotaBody(next));
    set({ parametros, cantidadesFlota: Object.fromEntries(kinds.map((k) => [k, next[k].quantity])) as FleetCount });
    return { ok: true };
  } catch (e) {
    // TODO(backend): 404/405 = PUT /parametros/flota aún no existe.
    const pendiente = e instanceof ErrorServicio && (e.codigo === 404 || e.codigo === 405);
    const motivo = pendiente ? "el cambio de cantidad aún no está disponible en el servidor." : msg(e);
    return { ok: false, message: speeds.length ? `Guardamos las velocidades, pero no la cantidad: ${motivo}` : `No se guardó la cantidad: ${motivo}` };
  }
}
