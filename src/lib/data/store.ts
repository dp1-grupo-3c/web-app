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
import type { RespuestaAveria, RespuestaSalud, VistaAlmacen, VistaParametros } from "@/lib/backend/types";
import { filaPedidoToFirstLate, TIPO_POR_MODO, trafficLightToSemaforoBody } from "@/lib/data/adapters";
import { SIMULATION_DAYS_5D } from "@/lib/constants";
import { addDays, parseISODate, toISODate } from "@/lib/format";
import type { FirstLateOrder, SimulationMode, TrafficLight } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

export interface Store {
  estado: EstadoSim;
  canal: EstadoCanal;
  salud: RespuestaSalud | null;
  parametros: VistaParametros | null;
  almacenes: VistaAlmacen[];
  averiasSesion: RespuestaAveria[];
  firstLateOrder: FirstLateOrder | null;
  firstLateOrderFor: string | null;
}

const initialStore: Store = {
  estado: inicial,
  canal: "conectando",
  salud: null,
  parametros: null,
  almacenes: [],
  averiasSesion: [],
  firstLateOrder: null,
  firstLateOrderFor: null,
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
  set({
    estado: next,
    ...(nuevaCorrida ? { averiasSesion: [], firstLateOrder: null, firstLateOrderFor: null } : {}),
  });
  fetchFirstLateIfNeeded(next);
}

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
  set({ estado: inicial, averiasSesion: [], firstLateOrder: null, firstLateOrderFor: null });
}

// ---- Arranque (idempotente) ----------------------------------------------

let started = false;
let canalCtrl: ReturnType<typeof abrirCanal> | null = null;

export function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;

  api.obtenerSalud()
    .then((salud) => {
      set({ salud });
      if (salud.corridaActiva) dispatch({ t: "seleccionar", id: salud.corridaActiva });
    })
    .catch(() => {});
  api.obtenerAlmacenes().then((almacenes) => set({ almacenes })).catch(() => {});
  api.obtenerParametros().then((parametros) => set({ parametros })).catch(() => {});

  canalCtrl = abrirCanal(
    (m) => dispatch({ t: "ws", m }),
    (canal) => set({ canal }),
  );

  pollLoop();
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

export async function arrancar(mode: SimulationMode, input: { startDate: string; trafficLight: TrafficLight }): Promise<Result<{ id: string }>> {
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
      ...(mode === "5d" ? { ultimoDia: toISODate(addDays(start, SIMULATION_DAYS_5D - 1)) } : {}),
    });
    dispatch({ t: "seleccionar", id: r.id });
    dispatch({ t: "ws", m: { tipo: "corrida", corrida: r.id, carga: r } });
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function cancelar(): Promise<Result> {
  const id = state.estado.idActual;
  if (!id) return { ok: false, message: "No hay ninguna corrida activa para cancelar." };
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
  try {
    const r = await api.registrarAveria(id, placa, tipo);
    set({ averiasSesion: [r, ...state.averiasSesion] });
    return { ok: true };
  } catch (e) {
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

export async function guardarSemaforo(t: TrafficLight): Promise<Result> {
  try {
    const body = trafficLightToSemaforoBody(t);
    const parametros = await api.cambiarSemaforo(body.ambar, body.verde);
    set({ parametros });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Arranque explícito del día a día. El servidor fija K=1 y reloj acompasado. */
export async function arrancarDia(primerDia: string): Promise<Result<{ id: string }>> {
  ensureStarted();
  if (state.estado.idActual && !esFinal(state.estado.corrida?.estado)) {
    return { ok: false, message: "Ya hay una corrida activa. No se ha iniciado otra operación." };
  }
  try {
    const r = await api.arrancarCorrida({
      tipo: "DIA_A_DIA", primerDia, ultimoDia: primerDia,
      generarAverias: false, minutosEntreFotografias: 1,
    });
    dispatch({ t: "ws", m: { tipo: "corrida", corrida: r.id, carga: r } });
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Evita que un control diario rezagado cancele una simulación recién iniciada. */
export async function cancelarDia(id: string): Promise<Result> {
  if (state.estado.idActual !== id || state.estado.corrida?.tipo !== "DIA_A_DIA") {
    return { ok: false, message: "La operación seleccionada ya no es la corrida actual." };
  }
  return cancelar();
}
