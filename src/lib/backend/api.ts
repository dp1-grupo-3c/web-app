/**
 * Cliente REST del backend KindBox. Todas las rutas son relativas
 * (`/api/...`): en desarrollo, next.config.ts las reescribe hacia
 * BACKEND_ORIGIN (por defecto http://localhost:8080); en producción,
 * el mismo origen debe servir frontend y backend detrás de un proxy.
 */

import type {
  DetalleCorrida,
  PaginaPedidos,
  ResultadoCargaAverias,
  ResultadoSimulacion,
  ResumenCorrida,
  RespuestaAveria,
  RespuestaSalud,
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
export const cambiarSemaforo = (ambar: number, verde: number) =>
  api<VistaParametros>("/parametros/semaforo", { metodo: "PUT", cuerpo: { ambar, verde } });
