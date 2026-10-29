/**
 * Validadores de entrada reutilizables. Cada uno recibe el valor tal como
 * está en el campo (texto) y devuelve un mensaje en español, o null si el
 * valor es válido. Son validaciones de experiencia de uso: no reemplazan
 * las del backend.
 */

import { formatNumber } from "@/lib/format";

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
