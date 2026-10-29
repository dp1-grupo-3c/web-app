/**
 * Store externo del registro de clientes (/api/clientes).
 *
 * Los clientes viven en el backend, persistidos en un archivo, y no dependen
 * de que haya una operación en curso. La lista se vuelve a pedir cada vez que
 * se abre el panel, así incluye los registrados desde otras sesiones; la
 * búsqueda por documento al registrar un pedido siempre consulta al servidor.
 */

import * as api from "@/lib/backend/api";
import { ErrorServicio } from "@/lib/backend/api";
import { clienteToClient, clientToSolicitud } from "@/lib/data/adapters";
import type { Client } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

export interface StoreClientes {
  clientes: Client[];
  /** Ya respondió el servidor al menos una vez. */
  cargado: boolean;
}

const inicial: StoreClientes = { clientes: [], cargado: false };
let state: StoreClientes = inicial;
const listeners = new Set<() => void>();

function set(patch: Partial<StoreClientes>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getSnapshot = (): StoreClientes => state;
export const getServerSnapshot = (): StoreClientes => inicial;

const msg = (e: unknown) => (e instanceof ErrorServicio ? e.message : "No se pudo contactar con el servidor.");
const porNombre = (a: Client, b: Client) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });

/** Reemplaza o agrega un cliente sin esperar a la siguiente lectura completa. */
function incorporar(c: Client) {
  set({ clientes: [...state.clientes.filter((x) => x.document !== c.document), c].sort(porNombre) });
}

export async function refrescar() {
  try {
    const clientes = await api.listarClientes();
    set({ clientes: clientes.map(clienteToClient).sort(porNombre), cargado: true });
  } catch {
    // se mantiene la última lista conocida
  }
}

export async function registrar(c: Client): Promise<Result<Client>> {
  try {
    const nuevo = clienteToClient(await api.registrarCliente(clientToSolicitud(c)));
    incorporar(nuevo);
    return { ok: true, data: nuevo };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

export async function actualizar(c: Client): Promise<Result<Client>> {
  try {
    const nuevo = clienteToClient(await api.actualizarCliente(clientToSolicitud(c)));
    incorporar(nuevo);
    return { ok: true, data: nuevo };
  } catch (e) {
    return { ok: false, message: msg(e) };
  }
}

/**
 * `data` es null si el documento no está registrado. Un 404 de ruta (backend
 * sin /api/clientes) no es "no registrado": se informa como error.
 */
export async function buscar(documento: string): Promise<Result<Client | null>> {
  try {
    const c = clienteToClient(await api.buscarCliente(documento));
    incorporar(c);
    return { ok: true, data: c };
  } catch (e) {
    if (e instanceof ErrorServicio && e.codigoError === "RECURSO_NO_ENCONTRADO") return { ok: true, data: null };
    return { ok: false, message: msg(e) };
  }
}
