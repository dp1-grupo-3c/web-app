/**
 * Carga de archivos de datos (/api/datos). El servidor valida cada archivo
 * antes de guardarlo y lo usa desde la siguiente corrida; las que ya están en
 * curso no cambian.
 */

import * as api from "@/lib/backend/api";
import { ErrorServicio } from "@/lib/backend/api";
import type { ArchivoGuardado, InventarioDatos, SolicitudBloqueo, VistaRegistroBloqueo } from "@/lib/backend/types";
import { recargarParametros } from "@/lib/data/store";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

export type DataKind = "flota" | "bloqueos" | "mantenimiento";

const msg = (e: unknown) => (e instanceof ErrorServicio ? e.message : "No se pudo contactar con el servidor.");

export async function cargarInventario(): Promise<Result<InventarioDatos>> {
  try {
    return { ok: true, data: await api.obtenerDatos() };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** `mes` (AAAA-MM) solo aplica a bloqueos cuyo nombre de archivo no lo indica. */
export async function subirArchivo(kind: DataKind, archivo: File, mes?: string): Promise<Result<ArchivoGuardado>> {
  try {
    if (kind === "flota") {
      const data = await api.subirFlota(archivo);
      // Reemplazar flota.txt descarta las cantidades ajustadas: se vuelven a leer.
      await recargarParametros();
      return { ok: true, data };
    }
    return { ok: true, data: kind === "bloqueos" ? await api.subirBloqueos(archivo, mes) : await api.subirMantenimiento(archivo) };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function registrarBloqueo(s: SolicitudBloqueo): Promise<Result<ArchivoGuardado[]>> {
  try {
    return { ok: true, data: await api.registrarBloqueo(s) };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function listarBloqueos(mes: string): Promise<Result<VistaRegistroBloqueo[]>> {
  try {
    return { ok: true, data: await api.registrosBloqueo(mes) };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

// Si otro usuario cambió la línea desde que se listó, el servidor responde 409 y no la toca.
export async function editarBloqueo(r: VistaRegistroBloqueo, s: SolicitudBloqueo): Promise<Result<ArchivoGuardado[]>> {
  try {
    return { ok: true, data: await api.reemplazarBloqueo(r, s) };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function borrarBloqueo(r: VistaRegistroBloqueo): Promise<Result<ArchivoGuardado>> {
  try {
    return { ok: true, data: await api.quitarBloqueo(r) };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/** Mensaje de éxito con los archivos a los que se agregó el bloqueo. */
export const resumenBloqueo = (archivos: ArchivoGuardado[]) =>
  `Bloqueo guardado en ${archivos.map((a) => a.ruta).join(" y ")}. Rige desde la siguiente corrida.`;

/** Mensaje de éxito con los registros que el servidor validó. */
export function resumenGuardado(r: ArchivoGuardado) {
  const registros = `${r.registros} ${r.registros === 1 ? "registro validado" : "registros validados"}`;
  return `${registros} en ${r.ruta}${r.reemplazado ? " (reemplazó al archivo anterior)" : ""}.`;
}

/** Vacío vale (el mes se deduce del nombre del archivo). */
export const mesValido = (mes: string) => !mes.trim() || /^\d{4}-(0[1-9]|1[0-2])$/.test(mes.trim());
