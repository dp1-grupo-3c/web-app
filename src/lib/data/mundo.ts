/**
 * Parámetros del mundo (/api/parametros/mundo): tamaño del mapa y red de
 * almacenes. Solo se editan sin corridas activas y rigen desde la siguiente.
 * GRID es global porque la geometría del mapa y los formularios la leen sin
 * pasar por React: al cambiarla se avisa a quienes dibujan el mapa.
 */

import * as api from "@/lib/backend/api";
import { ErrorServicio } from "@/lib/backend/api";
import type { SolicitudMundo, VistaMundo } from "@/lib/backend/types";
import { GRID } from "@/lib/constants";
import { recargarAlmacenes as recargarOperacion } from "@/lib/data/operacion";
import { recargarAlmacenes as recargarSimulacion } from "@/lib/data/store";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

export interface StoreMundo {
  vista: VistaMundo | null;
}

const inicial: StoreMundo = { vista: null };
let state: StoreMundo = inicial;
const listeners = new Set<() => void>();

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getSnapshot = (): StoreMundo => state;
export const getServerSnapshot = (): StoreMundo => inicial;

function aplicar(vista: VistaMundo) {
  GRID.width = vista.mapa.largoKm;
  GRID.height = vista.mapa.anchoKm;
  state = { vista };
  listeners.forEach((l) => l());
}

const msg = (e: unknown) => (e instanceof ErrorServicio ? e.message : "No se pudo contactar con el servidor.");

export async function cargarMundo(): Promise<Result<VistaMundo>> {
  try {
    const vista = await api.obtenerMundo();
    aplicar(vista);
    return { ok: true, data: vista };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

let iniciado = false;
/** Primera lectura, para que el mapa se dibuje con el tamaño vigente. */
export function asegurarMundo() {
  if (iniciado) return;
  iniciado = true;
  void cargarMundo();
}

export async function guardarMundo(s: SolicitudMundo): Promise<Result<VistaMundo>> {
  try {
    const vista = await api.cambiarMundo(s);
    aplicar(vista);
    await Promise.all([recargarSimulacion(), recargarOperacion()]);
    return { ok: true, data: vista };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}
