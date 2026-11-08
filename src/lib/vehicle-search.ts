// Búsqueda de vehículos por distancia al destino o desde el origen, en km o minutos.

import type { VehiclePhase } from "@/lib/types";

export type DistanceRef = "destino" | "origen";
export type DistanceUnit = "km" | "min";
export type PhaseFilter = "todas" | VehiclePhase;
export type DistanceQuery = { ref: DistanceRef; unit: DistanceUnit; max: number | null; phase: PhaseFilter };

type Row = {
  remainingKm: number;
  etaMinutes: number | null;
  fromOriginKm: number | null;
  fromOriginMinutes: number | null;
  phase: VehiclePhase | null;
};

export const NO_DISTANCE_QUERY: DistanceQuery = { ref: "destino", unit: "km", max: null, phase: "todas" };

// Distancia de la fila según la referencia y la unidad; null si no hay dato.
export function rowDistance(r: Row, ref: DistanceRef, unit: DistanceUnit): number | null {
  if (ref === "destino") {
    // Sin ruta pendiente ni hora de llegada no hay destino al que medir.
    if (unit === "min") return r.etaMinutes;
    return r.remainingKm > 0 || r.etaMinutes != null ? r.remainingKm : null;
  }
  return unit === "km" ? r.fromOriginKm : r.fromOriginMinutes;
}

export function matchesDistance(r: Row, q: DistanceQuery): boolean {
  if (q.phase !== "todas" && r.phase !== q.phase) return false;
  if (q.max == null) return true;
  const d = rowDistance(r, q.ref, q.unit);
  return d != null && d <= q.max;
}

// Texto del campo "hasta": vacío es sin límite; undefined marca un valor inválido.
export function parseMaxDistance(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
