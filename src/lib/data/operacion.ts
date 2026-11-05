/**
 * Store externo de la operación diaria (/api/operaciones, /ws/operaciones).
 *
 * Es independiente del store de simulación (store.ts): el contrato es otro y
 * el backend mantiene la operación aparte de las corridas 5D y colapso.
 *
 * Reglas del contrato (docs/OPERACIONES_DIARIAS.md del backend):
 * - Se sigue un único contexto. El WebSocket no cambia solo de contexto, así
 *   que al iniciar otra operación se cierra el canal y se abre uno nuevo.
 * - Se descartan las vistas con una revisión igual o anterior a la aplicada.
 * - Los comandos responden 202: se consulta su estado hasta APLICADO o
 *   RECHAZADO. El solicitudId hace idempotente el reenvío.
 */

import * as api from "@/lib/backend/api";
import { ErrorServicio } from "@/lib/backend/api";
import { abrirCanalOperacion, type EstadoCanal } from "@/lib/backend/canal";
import type { ResultadoComando, SolicitudPedidoOperacion, VistaAlmacen, VistaOperacion } from "@/lib/backend/types";
import { PRIORIDAD_POR_CODIGO, trafficLightToSemaforoBody } from "@/lib/data/adapters";
import type { Coord, PriorityCode, TrafficLight } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

export interface StoreOperacion {
  /** Ya se consultó /actual al menos una vez (distingue "cargando" de "sin operación"). */
  cargado: boolean;
  vista: VistaOperacion | null;
  canal: EstadoCanal;
  /** Para dibujar los almacenes cuando aún no hay operación. */
  almacenes: VistaAlmacen[];
}

const inicial: StoreOperacion = { cargado: false, vista: null, canal: "conectando", almacenes: [] };

let state: StoreOperacion = inicial;
const listeners = new Set<() => void>();

function set(patch: Partial<StoreOperacion>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getSnapshot = (): StoreOperacion => state;
/** Mismo valor "vacío" en el servidor: evita divergencias de hidratación. */
export const getServerSnapshot = (): StoreOperacion => inicial;

const msg = (e: unknown) => (e instanceof ErrorServicio ? e.message : "No se pudo contactar con el servidor.");
export const enCurso = (v: VistaOperacion | null) => v?.estado === "EN_CURSO";

/** Vuelve a leer los almacenes en reposo tras editar la red. */
export async function recargarAlmacenes() {
  set({ almacenes: await api.obtenerAlmacenes() });
}

// ---- Seguimiento del contexto ------------------------------------------------

let canalCtrl: ReturnType<typeof abrirCanalOperacion> | null = null;

/**
 * Incorpora una vista si es más nueva que la aplicada. Solo `/actual` y el
 * inicio (`adoptar`) cambian de contexto: así una respuesta tardía del
 * contexto anterior no devuelve la pantalla a una operación ya reemplazada.
 */
export function aplicar(v: VistaOperacion, adoptar = false) {
  const actual = state.vista;
  if (actual && v.contextoId === actual.contextoId) {
    if (v.revision > actual.revision) set({ vista: v, cargado: true });
    return;
  }
  if (actual && !adoptar) return;
  canalCtrl?.cerrar();
  canalCtrl = null;
  set({ vista: v, cargado: true, canal: "conectando" });
  if (typeof window === "undefined") return;
  canalCtrl = abrirCanalOperacion(v.contextoId, (m) => aplicar(m), (canal) => set({ canal }));
}

/**
 * Sin operación en curso se consulta /actual para adoptar la que inicie otra
 * sesión. Con una en curso solo se resincroniza por REST si el canal no está
 * conectado; si lo está, el WebSocket ya entrega cada revisión.
 */
export async function sincronizar() {
  const v = state.vista;
  try {
    if (v && enCurso(v)) {
      if (state.canal !== "conectado") aplicar(await api.detalleOperacion(v.contextoId));
    } else {
      aplicar(await api.operacionActual(), true);
    }
  } catch (e) {
    // 404 en /actual: el servidor aún no tiene ninguna operación.
    if (e instanceof ErrorServicio && e.codigo === 404) set({ cargado: true });
  }
}

let started = false;

export function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  api.obtenerAlmacenes().then((almacenes) => set({ almacenes })).catch(() => {});
  const tick = async () => {
    await sincronizar();
    setTimeout(tick, 3000);
  };
  tick();
}

export const reintentarCanal = () => canalCtrl?.reintentar();

// ---- Comandos ----------------------------------------------------------------

/** crypto.randomUUID solo existe en contextos seguros; el servidor del laboratorio puede servirse por HTTP. */
function nuevoSolicitudId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plazo para ver el comando aplicado. El ciclo operativo corre cada 100 ms. */
export const ESPERA_COMANDO = { intervaloMs: 250, maximoMs: 15_000 };

type EnvioComando = (contextoId: string, solicitudId: string) => Promise<ResultadoComando>;

async function enviarComando(enviar: EnvioComando): Promise<Result<ResultadoComando>> {
  const v = state.vista;
  if (!v || !enCurso(v)) return { ok: false, message: "No hay una operación diaria en curso." };
  const id = v.contextoId;
  let r: ResultadoComando;
  try {
    r = await enviar(id, nuevoSolicitudId());
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
  const limite = Date.now() + ESPERA_COMANDO.maximoMs;
  while (r.estado === "ACEPTADO" && Date.now() < limite) {
    await esperar(ESPERA_COMANDO.intervaloMs);
    try {
      r = await api.comandoOperacion(id, r.comandoId);
    } catch {
      // se reintenta hasta el plazo
    }
  }
  if (r.estado === "RECHAZADO") return { ok: false, message: r.error ?? "El servidor rechazó la solicitud." };
  // Refleja el efecto sin esperar al siguiente envío del canal.
  api.detalleOperacion(id).then((d) => aplicar(d)).catch(() => {});
  return { ok: true, data: r };
}

// ---- Acciones ----------------------------------------------------------------

/** Inicia con la configuración predeterminada del servidor (ALNS, 30 min, 2000 ms, America/Lima). */
export async function iniciar(): Promise<Result> {
  ensureStarted();
  if (enCurso(state.vista)) return { ok: false, message: "Ya hay una operación diaria en curso." };
  try {
    aplicar(await api.iniciarOperacion(), true);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Con `idEsperado`, solo detiene la operación que el usuario vio al confirmar. */
export async function detener(idEsperado: string): Promise<Result> {
  const v = state.vista;
  if (!v || v.contextoId !== idEsperado) return { ok: false, message: "La operación que intentas detener ya no es la actual." };
  try {
    aplicar(await api.detenerOperacion(idEsperado));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export type PedidoNuevo = {
  clientCode: string;
  clientName: string;
  clientPhone: string;
  address: string;
  destination: Coord;
  packages: number;
  priority: PriorityCode;
};

/** pedidoId solo viene cuando el comando ya se aplicó; si sigue aceptado, el pedido está en cola. */
export async function registrarPedido(p: PedidoNuevo): Promise<Result<{ orderId?: string }>> {
  const r = await enviarComando((id, solicitudId) => {
    const cuerpo: SolicitudPedidoOperacion = {
      solicitudId,
      codigoCliente: p.clientCode,
      nombreCliente: p.clientName,
      telefonoCliente: p.clientPhone,
      direccion: p.address,
      x: p.destination.x,
      y: p.destination.y,
      cantidad: p.packages,
      prioridad: PRIORIDAD_POR_CODIGO[p.priority],
    };
    return api.altaPedidoOperacion(id, cuerpo);
  });
  if (!r.ok) return r;
  const pedidoId = r.data?.pedidoId;
  return { ok: true, data: { orderId: pedidoId != null ? String(pedidoId) : undefined } };
}

export async function registrarAveria(placa: string, tipo: 1 | 2 | 3): Promise<Result> {
  const r = await enviarComando((id, solicitudId) => api.averiaOperacion(id, { solicitudId, placa, tipo }));
  return r.ok ? { ok: true } : r;
}

/** Umbrales propios de la operación; no cambia los parámetros globales de simulación. */
export async function guardarSemaforo(t: TrafficLight): Promise<Result> {
  const { ambar, verde } = trafficLightToSemaforoBody(t);
  const r = await enviarComando((id, solicitudId) => api.parametrosOperacion(id, { solicitudId, ambar, verde }));
  return r.ok ? { ok: true } : r;
}
