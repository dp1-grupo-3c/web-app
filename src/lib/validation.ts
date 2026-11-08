/**
 * Validadores de entrada reutilizables. Cada uno recibe el valor tal como
 * está en el campo (texto) y devuelve un mensaje en español, o null si el
 * valor es válido. Son validaciones de experiencia de uso: no reemplazan
 * las del backend.
 */

import type { SolicitudMundo, VistaMundo } from "@/lib/backend/types";
import { addDays, formatDate, formatNumber, parseISODate, toISODate } from "@/lib/format";

export type Check = string | null;

export const REQUIRED_MESSAGE = "Completa este campo para continuar.";

/** "12,5" y "12.5" valen lo mismo; devuelve NaN si el texto no es un número. */
export function parseDecimal(raw: string): number {
  const t = raw.trim().replace(",", ".");
  return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN;
}

export function required(raw: string): Check {
  return raw.trim() ? null : REQUIRED_MESSAGE;
}

const between = (min: number, max: number) => `Debe estar entre ${formatNumber(min)} y ${formatNumber(max)}.`;

/** Entero en [min, max]. */
export function integerInRange(raw: string, min: number, max: number): Check {
  if (!raw.trim()) return REQUIRED_MESSAGE;
  const n = parseDecimal(raw);
  if (Number.isNaN(n)) return "Escribe solo números.";
  if (!Number.isInteger(n)) return "Debe ser un número entero.";
  if (n < min || n > max) return min === 0 && n < 0 ? "No puede ser negativo." : between(min, max);
  return null;
}

/** Decimal en el rango, con a lo sumo `decimals` decimales; `minExclusive` excluye el mínimo. */
export function decimalInRange(raw: string, o: { min: number; max: number; decimals: number; minExclusive?: boolean }): Check {
  if (!raw.trim()) return REQUIRED_MESSAGE;
  const n = parseDecimal(raw);
  if (Number.isNaN(n)) return "Escribe solo números.";
  if (n < 0) return "No puede ser negativo.";
  if (o.minExclusive ? n <= o.min : n < o.min) return o.minExclusive ? `Debe ser mayor que ${formatNumber(o.min)}.` : between(o.min, o.max);
  if (n > o.max) return `Debe ser como máximo ${formatNumber(o.max)}.`;
  const fraction = raw.trim().replace(",", ".").split(".")[1] ?? "";
  if (fraction.length > o.decimals) return o.decimals ? `Usa como máximo ${o.decimals} decimal${o.decimals > 1 ? "es" : ""}.` : "Debe ser un número entero.";
  return null;
}

/** Obligatorio y con longitud máxima. */
export function textMax(raw: string, max: number): Check {
  if (!raw.trim()) return REQUIRED_MESSAGE;
  return raw.trim().length > max ? `Usa como máximo ${max} caracteres.` : null;
}

/** Solo dígitos, espacios o "+", con `min`–`max` caracteres. */
export function phone(raw: string, min: number, max: number): Check {
  if (!raw.trim()) return REQUIRED_MESSAGE;
  return new RegExp(`^[\\d\\s+]{${min},${max}}$`).test(raw.trim()) ? null : `Usa solo dígitos (de ${min} a ${max}).`;
}

// ---- Fechas ------------------------------------------------------------------

/**
 * ISO si día, mes y año forman una fecha del calendario real (rechaza 30/02
 * y 29/02 en años no bisiestos); null si no.
 */
export function isoFromParts(day: number, month: number, year: number): string | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISODate(d);
}

/** Borrador del mapa y los almacenes: los números van como texto del campo. */
export type WorldDraft = {
  width: string;
  height: string;
  warehouses: { id: number; name: string; central: boolean; x: string; y: string; capacity: string }[];
};

/** Lado máximo del mapa en km (ParametrosMundo.LADO_MAXIMO_KM). */
export const WORLD_MAX_SIDE_KM = 500;

export function worldDraft(v: VistaMundo): WorldDraft {
  return {
    width: String(v.mapa.largoKm),
    height: String(v.mapa.anchoKm),
    warehouses: v.almacenes.map((a) => ({ id: a.id, name: a.nombre, central: a.central, x: String(a.x), y: String(a.y), capacity: a.capacidad == null ? "" : String(a.capacidad) })),
  };
}

export function worldRequest(d: WorldDraft): SolicitudMundo {
  return {
    mapa: { largoKm: Number(d.width), anchoKm: Number(d.height) },
    almacenes: d.warehouses.map((w) => ({ id: w.id, x: Number(w.x), y: Number(w.y), ...(w.central ? {} : { capacidad: Number(w.capacity) }) })),
  };
}

/** Primer error del mapa y de cada almacén (por id); vacío si todo es coherente. */
export function validateWorld(d: WorldDraft): { width?: string; height?: string; warehouses?: Record<number, string> } {
  const out: { width?: string; height?: string; warehouses?: Record<number, string> } = {};
  const width = integerInRange(d.width, 1, WORLD_MAX_SIDE_KM);
  const height = integerInRange(d.height, 1, WORLD_MAX_SIDE_KM);
  if (width) out.width = width;
  if (height) out.height = height;
  const warehouses: Record<number, string> = {};
  const seen = new Set<string>();
  for (const w of d.warehouses) {
    const x = integerInRange(w.x, 0, width ? WORLD_MAX_SIDE_KM : Number(d.width));
    const y = integerInRange(w.y, 0, height ? WORLD_MAX_SIDE_KM : Number(d.height));
    const capacity = w.central ? null : integerInRange(w.capacity, 1, Number.MAX_SAFE_INTEGER);
    const place = `${Number(w.x)},${Number(w.y)}`;
    const problem = x ? `X: ${x}` : y ? `Y: ${y}` : capacity ? `Capacidad: ${capacity}` : seen.has(place) ? "Ya hay otro almacén en esa ubicación." : null;
    if (problem) warehouses[w.id] = problem;
    seen.add(place);
  }
  if (Object.keys(warehouses).length) out.warehouses = warehouses;
  return out;
}

/**
 * Nodos de un tramo bloqueado, escritos como "12,20 13,20 13,25". Exige al
 * menos dos, dentro de la retícula, sin repetir y con tramos rectos: la ciudad
 * no tiene diagonales. Es el mismo criterio con el que valida el servidor.
 */
export function blockageNodes(raw: string, grid: { width: number; height: number }): { nodes: { x: number; y: number }[]; error: Check } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { nodes: [], error: REQUIRED_MESSAGE };
  const nodes: { x: number; y: number }[] = [];
  for (const part of parts) {
    const m = /^(\d+),(\d+)$/.exec(part);
    if (!m) return { nodes: [], error: `«${part}» no es un nodo: escribe cada uno como x,y y sepáralos con espacios.` };
    const node = { x: Number(m[1]), y: Number(m[2]) };
    if (node.x > grid.width || node.y > grid.height) return { nodes: [], error: `El nodo ${part} está fuera del mapa (x de 0 a ${grid.width}, y de 0 a ${grid.height}).` };
    const last = nodes.at(-1);
    if (last && last.x !== node.x && last.y !== node.y) return { nodes: [], error: `El tramo hasta ${part} es diagonal: cada tramo debe ser horizontal o vertical.` };
    if (nodes.some((n) => n.x === node.x && n.y === node.y)) return { nodes: [], error: `El nodo ${part} está repetido.` };
    nodes.push(node);
  }
  return nodes.length < 2 ? { nodes: [], error: "Indica al menos dos nodos." } : { nodes, error: null };
}

// Bloqueo guardado → campos del formulario: nodos "x,y x,y", fecha AAAA-MM-DD y hora hh:mm.
export function blockageDraft(b: { nodos: { x: number; y: number }[]; inicio: string; fin: string }) {
  const parte = (t: string) => ({ date: t.slice(0, 10), time: t.slice(11, 16) });
  const inicio = parte(b.inicio);
  const fin = parte(b.fin);
  return {
    nodes: b.nodos.map((n) => `${n.x},${n.y}`).join(" "),
    startDate: inicio.date, startTime: inicio.time, endDate: fin.date, endTime: fin.time,
  };
}

export const INCOMPLETE_DATE = "Completa la fecha con el formato dd/mm/aaaa.";

/** Texto dd/mm/aaaa (con o sin barras) → problema de calendario, o null si es una fecha real o está vacío. */
export function calendarDate(text: string): Check {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length < 8) return INCOMPLETE_DATE;
  return isoFromParts(+digits.slice(0, 2), +digits.slice(2, 4), +digits.slice(4, 8)) ? null : "Esa fecha no existe en el calendario.";
}

/** Fecha ISO dentro de [from, to] (ambos incluidos). Las ISO se comparan como texto. */
export function isoDateInRange(iso: string, range: { from: string; to: string }): Check {
  if (!iso) return "Elige una fecha para continuar.";
  if (iso < range.from || iso > range.to)
    return `Elige una fecha entre el ${formatDate(parseISODate(range.from))} y el ${formatDate(parseISODate(range.to))}, que es el periodo con datos.`;
  return null;
}

/** Inicio de una simulación de `days` días: inicio y fin deben caer dentro del periodo con datos. */
export function simulationStart(iso: string, days: number, range: { from: string; to: string }): Check {
  const base = isoDateInRange(iso, range);
  if (base || days <= 1) return base;
  const lastStart = toISODate(addDays(parseISODate(range.to), -(days - 1)));
  return iso > lastStart
    ? `La simulación de ${days} días debe terminar a más tardar el ${formatDate(parseISODate(range.to))}: elige un inicio hasta el ${formatDate(parseISODate(lastStart))}.`
    : null;
}
