import type { BreakdownType, PriorityCode, StatusTone, TrafficLight } from "./types";

/**
 * Retícula de la ciudad: cada intersección (x, y) es una coordenada válida.
 * Parte del valor del enunciado; src/lib/data/mundo.ts la actualiza con el vigente.
 */
export const GRID = { width: 70, height: 50 };

export const PRIORITIES: { code: PriorityCode; name: string; hours: number }[] = [
  { code: "P1", name: "Prioritario 1", hours: 4 },
  { code: "P2", name: "Prioritario 2", hours: 8 },
  { code: "P3", name: "Prioritario 3", hours: 12 },
  { code: "P4", name: "Prioritario 4", hours: 18 },
  { code: "N", name: "Normal", hours: 36 },
];
export const priorityInfo = (code: PriorityCode) => PRIORITIES.find((p) => p.code === code)!;

export const BREAKDOWN_TYPES: { code: BreakdownType; name: string; description: string }[] = [
  { code: "T1", name: "Leve", description: "Se repara en ruta y vuelve al servicio en el mismo lugar." },
  { code: "T2", name: "Moderada", description: "Requiere taller. Sale de servicio el resto del turno." },
  { code: "T3", name: "Grave", description: "Vehículo inoperativo. Sus pedidos se reasignan de inmediato." },
];
export const breakdownInfo = (code: BreakdownType) => BREAKDOWN_TYPES.find((b) => b.code === code)!;

/**
 * Color de cada tipo de avería: ámbar (leve), rojo (moderada) y rojo oscuro (grave).
 * `glyph` es el color del ícono sobre ese fondo (el rojo oscuro necesita blanco).
 */
export const BREAKDOWN_COLOR: Record<BreakdownType, { color: string; glyph: string }> = {
  T1: { color: "var(--color-warning)", glyph: "#161d25" },
  T2: { color: "var(--color-critic)", glyph: "#161d25" },
  T3: { color: "var(--color-breakdown-severe)", glyph: "#ffffff" },
};

/** Valores iniciales del semáforo (escala 0–1000 paquetes). */
export const DEFAULT_TRAFFIC_LIGHT: TrafficLight = { greenFrom: 500, amberFrom: 250, amberTo: 500, redTo: 250 };
export const TRAFFIC_LIGHT_MAX = 1000;

export const TONE_COLOR: Record<StatusTone, string> = {
  ok: "var(--color-success)",
  warn: "var(--color-warning)",
  crit: "var(--color-critic)",
};
export const TONE_LABEL: Record<StatusTone, string> = { ok: "Verde", warn: "Ámbar", crit: "Rojo" };

export const SIMULATION_TITLE = { "5d": "Simulación de 5 días", colapso: "Simulación hasta el colapso" } as const;
export const SIMULATION_DAYS_5D = 5;

/** Ancho de los paneles laterales (px). */
export const PANEL_WIDTH = { default: 420, wide: 440 } as const;
export const RAIL_WIDTH = 88;
