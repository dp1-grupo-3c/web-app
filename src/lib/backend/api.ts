/**
 * Cliente REST del backend KindBox. Todas las rutas son relativas
 * (`/api/...`): en desarrollo, next.config.ts las reescribe hacia
 * BACKEND_ORIGIN (por defecto http://localhost:8080); en producción,
 * el mismo origen debe servir frontend y backend detrás de un proxy.
 */

import type {
  Cliente,
  DetalleCorrida,
  SolicitudCliente,
  MetricasSimulacion,
  PaginaPedidos,
  PaginaPedidosOperacion,
  ResultadoComando,
  SolicitudAveriaOperacion,
  SolicitudOperacion,
  SolicitudParametrosOperacion,
  SolicitudPedidoOperacion,
  VistaOperacion,
  ResultadoCargaAverias,
  ResultadoSimulacion,
  ResumenCorrida,
  RespuestaAveria,
  RespuestaSalud,
  SolicitudFlota,
  SolicitudSimulacion,
  TipoUnidad,
  VistaAlmacen,
  VistaParametros,
} from "./types";

export class ErrorServicio extends Error {
  constructor(public codigo: number, mensaje: string, public codigoError?: string) {
    super(mensaje);
  }
}

async function api<T>(ruta: string, opciones: {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  cuerpo?: unknown;
  archivo?: File;
} = {}): Promise<T> {
  const init: RequestInit = { method: opciones.metodo ?? "GET", signal: AbortSignal.timeout(120_000) };
  if (opciones.archivo) {
    const form = new FormData();
    form.append("archivo", opciones.archivo);
    init.body = form;
  } else if (opciones.cuerpo !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opciones.cuerpo);
  }
  let r: Response;
  try {
    r = await fetch(`/api${ruta}`, init);
  } catch {
    throw new ErrorServicio(0, "No se pudo contactar con el servidor.");
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new ErrorServicio(datos?.codigo ?? r.status, datos?.mensaje ?? "Error del servidor", datos?.codigoError);
  return datos as T;
}

export const obtenerSalud = () => api<RespuestaSalud>("/salud");
export const obtenerAlmacenes = () => api<VistaAlmacen[]>("/almacenes");
export const obtenerParametros = () => api<VistaParametros>("/parametros");
export const arrancarCorrida = (s: Partial<SolicitudSimulacion>) =>
  api<ResumenCorrida>("/simulaciones", { metodo: "POST", cuerpo: s });
export const cancelarCorrida = (id: string) => api<ResumenCorrida>(`/simulaciones/${id}`, { metodo: "DELETE" });
export const detalleCorrida = (id: string) => api<DetalleCorrida>(`/simulaciones/${id}`);
export const resultadoCorrida = (id: string) => api<ResultadoSimulacion>(`/simulaciones/${id}/resultado`);
export const paginaPedidos = (id: string, q: { pagina?: number; tamano?: number; busqueda?: string; soloActivos?: boolean }) =>
  api<PaginaPedidos>(`/simulaciones/${id}/pedidos?` + new URLSearchParams(
    Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  ));
export const registrarAveria = (id: string, placa: string, tipo: 1 | 2 | 3) =>
  api<RespuestaAveria>(`/simulaciones/${id}/averias`, { metodo: "POST", cuerpo: { placa, tipo } });
export const cargarAverias = (id: string, archivo: File) =>
  api<ResultadoCargaAverias>(`/simulaciones/${id}/averias/masivo`, { metodo: "POST", archivo });
export const cambiarVelocidad = (tipo: TipoUnidad, kmPorHora: number) =>
  api<VistaParametros>("/parametros/velocidad", { metodo: "PUT", cuerpo: { tipo, kmPorHora } });
/**
 * TODO(backend): endpoint aún no implementado. Contrato propuesto:
 *
 *   PUT /api/parametros/flota
 *   { "unidades": { "AUTO":      { "cantidad": 10, "kmPorHora": 40 },
 *                   "MOTO":      { "cantidad": 15, "kmPorHora": 25 },
 *                   "BICICLETA": { "cantidad": 12, "kmPorHora": 12 } } }
 *
 *   200 → VistaParametros (idealmente con `cantidades: Record<TipoUnidad, number>`)
 *   400 → cantidad no entera o negativa, velocidad <= 0 o no finita
 *   409 → hay una corrida en curso y la cantidad no se puede cambiar en caliente
 *
 * Mientras no exista, el servidor responde 404/405 y el store lo traduce a
 * un mensaje de "aún no disponible". Las velocidades ya se guardan con
 * cambiarVelocidad, que sí existe.
 */
export const cambiarFlota = (s: SolicitudFlota) =>
  api<VistaParametros>("/parametros/flota", { metodo: "PUT", cuerpo: s });
export const cambiarSemaforo = (ambar: number, verde: number) =>
  api<VistaParametros>("/parametros/semaforo", { metodo: "PUT", cuerpo: { ambar, verde } });

// ---- Operaciones diarias -----------------------------------------------------

const op = (id: string) => `/operaciones/${encodeURIComponent(id)}`;

export const iniciarOperacion = (s?: SolicitudOperacion) =>
  api<VistaOperacion>("/operaciones", { metodo: "POST", cuerpo: s ?? {} });
export const operacionActual = () => api<VistaOperacion>("/operaciones/actual");
export const detalleOperacion = (id: string) => api<VistaOperacion>(op(id));
export const detenerOperacion = (id: string) => api<VistaOperacion>(`${op(id)}/detener`, { metodo: "POST" });
export const altaPedidoOperacion = (id: string, s: SolicitudPedidoOperacion) =>
  api<ResultadoComando>(`${op(id)}/pedidos`, { metodo: "POST", cuerpo: s });
export const averiaOperacion = (id: string, s: SolicitudAveriaOperacion) =>
  api<ResultadoComando>(`${op(id)}/averias`, { metodo: "POST", cuerpo: s });
export const parametrosOperacion = (id: string, s: SolicitudParametrosOperacion) =>
  api<ResultadoComando>(`${op(id)}/parametros`, { metodo: "PUT", cuerpo: s });
export const comandoOperacion = (id: string, comandoId: string) =>
  api<ResultadoComando>(`${op(id)}/comandos/${encodeURIComponent(comandoId)}`);
export const paginaPedidosOperacion = (id: string, q: { pagina?: number; tamano?: number; busqueda?: string; soloActivos?: boolean }) =>
  api<PaginaPedidosOperacion>(`${op(id)}/pedidos?` + new URLSearchParams(
    Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  ));
export const metricasOperacion = (id: string) => api<MetricasSimulacion>(`${op(id)}/metricas`);

// ---- Clientes ------------------------------------------------------------------

export const listarClientes = () => api<Cliente[]>("/clientes");
export const buscarCliente = (documento: string) => api<Cliente>(`/clientes/${encodeURIComponent(documento)}`);
export const registrarCliente = (s: SolicitudCliente) => api<Cliente>("/clientes", { metodo: "POST", cuerpo: s });
export const actualizarCliente = (s: SolicitudCliente) =>
  api<Cliente>(`/clientes/${encodeURIComponent(s.documento)}`, { metodo: "PUT", cuerpo: s });
