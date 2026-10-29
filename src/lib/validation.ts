/**
 * Validadores de entrada reutilizables. Cada uno recibe el valor tal como
 * está en el campo (texto) y devuelve un mensaje en español, o null si el
 * valor es válido. Son validaciones de experiencia de uso: no reemplazan
 * las del backend.
 */

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
