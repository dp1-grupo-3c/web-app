/**
 * Configuración ampliada de la simulación: valor por defecto, validación y
 * horas del día. Los números salen de src/config/simulacion.ts.
 */

import {
  BREAKDOWN_DURATION_DEFAULTS,
  BREAKDOWN_DURATION_LIMITS,
  DEFAULT_START_TIME,
  VEHICLE_OCCUPANCY_DEFAULTS,
  WAREHOUSE_FILL_DEFAULTS,
} from "@/config/simulacion";
import { pad2 } from "./format";
import type { BreakdownDurations, BreakdownType, PercentBands, SimSettings, VehicleKind } from "./types";
import { integerInRange, type Check } from "./validation";

const KINDS: VehicleKind[] = ["auto", "moto", "bicicleta"];
const BREAKDOWNS: BreakdownType[] = ["T1", "T2", "T3"];

/** Nuevo objeto en cada llamada: nadie comparte (ni muta) el valor por defecto. */
export function defaultSimSettings(): SimSettings {
  return {
    startTime: DEFAULT_START_TIME,
    breakdownDurations: { ...BREAKDOWN_DURATION_DEFAULTS },
    vehicleOccupancy: Object.fromEntries(KINDS.map((k) => [k, { ...VEHICLE_OCCUPANCY_DEFAULTS }])) as Record<VehicleKind, PercentBands>,
    warehouseFill: { ...WAREHOUSE_FILL_DEFAULTS },
  };
}

export const defaultBreakdownDurations = (): BreakdownDurations => ({ ...BREAKDOWN_DURATION_DEFAULTS });

// ---- Hora del día ------------------------------------------------------------

/** "HH:MM" (24 h) → minutos desde las 00:00; null si no es una hora válida. */
export function parseTimeOfDay(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export const formatTimeOfDay = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

/** Vacío vale: se usa la hora por defecto (00:00). */
export function timeOfDay(raw: string): Check {
  if (!raw.trim()) return null;
  return parseTimeOfDay(raw) == null ? "Escribe una hora válida en formato HH:MM (de 00:00 a 23:59)." : null;
}

// ---- Semáforos en % ------------------------------------------------------------

/** Límites enteros de 0 a 100, con low < high. Devuelve qué límite marcar. */
export function validateBands(b: PercentBands): { message: string; keys: (keyof PercentBands)[] } | null {
  const bad = (["low", "high"] as const).filter((k) => !Number.isInteger(b[k]) || b[k] < 0 || b[k] > 100);
  if (bad.length) return { message: "Usa porcentajes enteros de 0 a 100.", keys: [...bad] };
  if (b.low >= b.high) return { message: "El primer límite debe ser menor que el segundo.", keys: ["low", "high"] };
  return null;
}

// ---- Duración de averías ---------------------------------------------------------

/** Mensaje de un valor escrito (texto del campo) para el tipo de avería. */
export function breakdownDuration(type: BreakdownType, raw: string): Check {
  const { min, max } = BREAKDOWN_DURATION_LIMITS[type];
  return integerInRange(raw, min, max);
}

/** T1 y T2 en horas, T3 en días → minutos simulados. */
export const breakdownMinutes = (type: BreakdownType, value: number) => value * (type === "T3" ? 1440 : 60);

/** Toda la configuración: primer error por sección, o null si es válida. */
export function validateSimSettings(s: SimSettings): Partial<Record<"startTime" | "breakdowns" | "vehicleOccupancy" | "warehouseFill", string>> {
  const out: Partial<Record<"startTime" | "breakdowns" | "vehicleOccupancy" | "warehouseFill", string>> = {};
  const t = timeOfDay(s.startTime);
  if (t) out.startTime = t;
  const b = BREAKDOWNS.map((k) => breakdownDuration(k, String(s.breakdownDurations[k]))).find(Boolean);
  if (b) out.breakdowns = b;
  const v = KINDS.map((k) => validateBands(s.vehicleOccupancy[k])?.message).find(Boolean);
  if (v) out.vehicleOccupancy = v;
  const w = validateBands(s.warehouseFill);
  if (w) out.warehouseFill = w.message;
  return out;
}
