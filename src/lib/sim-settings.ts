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
import type { FichaAveria, SolicitudAtributosAveria } from "./backend/types";
import type { BreakdownDurations, BreakdownField, PercentBands, SimSettings, VehicleKind } from "./types";
import { integerInRange, type Check } from "./validation";

const KINDS: VehicleKind[] = ["auto", "moto", "bicicleta"];
const BREAKDOWNS: BreakdownField[] = ["T1", "T2", "T2Shifts", "T3OnSite", "T3"];

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

/** Mensaje para un atributo de avería (texto del campo, o número; NaN = vacío). */
export function breakdownDuration(field: BreakdownField, raw: string | number): Check {
  const { min, max } = BREAKDOWN_DURATION_LIMITS[field];
  return integerInRange(typeof raw === "number" ? (Number.isNaN(raw) ? "" : String(raw)) : raw, min, max);
}

/**
 * Cuerpos de PUT /parametros/averias, uno por tipo y solo con lo que usa su
 * regla: T1 vuelve tras su tiempo en el lugar; T2 al cierre de los turnos
 * indicados; T3 tras sus días de mantenimiento. Las horas viajan en minutos.
 */
export const breakdownRequests = (d: BreakdownDurations): SolicitudAtributosAveria[] => [
  { tipo: 1, minutosEnElLugar: d.T1 * 60 },
  { tipo: 2, minutosEnElLugar: d.T2 * 60, turnosHastaReincorporacion: d.T2Shifts },
  { tipo: 3, minutosEnElLugar: d.T3OnSite * 60, diasMantenimiento: d.T3 },
];

/** Solo los cuerpos que cambian algo: lo que ya rige no se vuelve a escribir. */
export function changedBreakdownRequests(d: BreakdownDurations, vigentes: FichaAveria[] | undefined) {
  return breakdownRequests(d).filter((s) => {
    const a = vigentes?.find((f) => f.tipo === s.tipo)?.atributos;
    return !a
      || a.minutosEnElLugar !== s.minutosEnElLugar
      || (s.turnosHastaReincorporacion !== undefined && a.turnosHastaReincorporacion !== s.turnosHastaReincorporacion)
      || (s.diasMantenimiento !== undefined && a.diasMantenimiento !== s.diasMantenimiento);
  });
}

/** Valores vigentes de GET /parametros en las unidades del formulario; null si faltan tipos. */
export function breakdownDurationsFrom(averias: FichaAveria[] | undefined): BreakdownDurations | null {
  const a = (tipo: number) => averias?.find((f) => f.tipo === tipo)?.atributos;
  const [t1, t2, t3] = [a(1), a(2), a(3)];
  if (!t1 || !t2 || !t3) return null;
  return {
    T1: t1.minutosEnElLugar / 60,
    T2: t2.minutosEnElLugar / 60,
    T2Shifts: t2.turnosHastaReincorporacion,
    T3OnSite: t3.minutosEnElLugar / 60,
    T3: t3.diasMantenimiento,
  };
}

/** Toda la configuración: primer error por sección, o null si es válida. */
export function validateSimSettings(s: SimSettings): Partial<Record<"startTime" | "breakdowns" | "vehicleOccupancy" | "warehouseFill", string>> {
  const out: Partial<Record<"startTime" | "breakdowns" | "vehicleOccupancy" | "warehouseFill", string>> = {};
  const t = timeOfDay(s.startTime);
  if (t) out.startTime = t;
  const b = BREAKDOWNS.map((k) => breakdownDuration(k, s.breakdownDurations[k])).find(Boolean);
  if (b) out.breakdowns = b;
  const v = KINDS.map((k) => validateBands(s.vehicleOccupancy[k])?.message).find(Boolean);
  if (v) out.vehicleOccupancy = v;
  const w = validateBands(s.warehouseFill);
  if (w) out.warehouseFill = w.message;
  return out;
}

/**
 * Campo `inicio` de POST /simulaciones: fecha y hora al minuto, sin segundos
 * (el servidor los rechaza). Una hora vacía se envía como 00:00.
 */
export function runStartFields(s: SimSettings, startDate: string, accepts: { startTime: boolean }) {
  return accepts.startTime ? { inicio: `${startDate}T${formatTimeOfDay(parseTimeOfDay(s.startTime) ?? 0)}` } : {};
}
