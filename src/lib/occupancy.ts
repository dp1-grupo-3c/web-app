/**
 * Semáforos en %, ocupación y distancias. Funciones puras (sin React) para
 * que los selectores, los paneles y las pruebas compartan una sola regla.
 */

import { DISTANCE_BANDS_KM } from "@/config/simulacion";
import type { Coord, DistanceBand, PercentBands, StatusTone } from "./types";

/**
 * "lowIsGreen": ocupación de vehículos (verde < low, ámbar low–high, rojo > high).
 * "highIsGreen": llenado de almacenes (rojo ≤ low, ámbar hasta high, verde ≥ high),
 * con los mismos bordes que warehouseTone del semáforo en paquetes.
 */
export type ToneDirection = "lowIsGreen" | "highIsGreen";

/** Porcentaje (0–100, puede exceder 100) → tono. NaN o infinito → null (sin dato). */
export function percentTone(pct: number, bands: PercentBands, direction: ToneDirection = "lowIsGreen"): StatusTone | null {
  if (!Number.isFinite(pct)) return null;
  if (direction === "lowIsGreen") return pct < bands.low ? "ok" : pct <= bands.high ? "warn" : "crit";
  return pct >= bands.high ? "ok" : pct > bands.low ? "warn" : "crit";
}

/** Fracción ocupada en % (0–100+). Sin capacidad conocida o positiva → NaN. */
export function occupancyPercent(used: number | undefined, capacity: number | undefined): number {
  if (used == null || capacity == null || !(capacity > 0) || !Number.isFinite(used)) return NaN;
  return (Math.max(0, used) / capacity) * 100;
}

/** Paquetes a bordo / capacidad del vehículo, en %. */
export const vehicleOccupancy = (v: { load: number; capacity: number }) => occupancyPercent(v.load, v.capacity);

/** Semáforo de un vehículo: "empty" sin carga a bordo; null si no se conoce su capacidad. */
export function vehicleTone(v: { load: number; capacity: number }, bands: PercentBands): StatusTone | "empty" | null {
  return v.load <= 0 ? "empty" : percentTone(vehicleOccupancy(v), bands, "lowIsGreen");
}

/** Stock actual / capacidad del almacén, en %. El central (ilimitado) no tiene ocupación: NaN. */
export const warehouseOccupancy = (w: { kind: string; stock?: number; capacity?: number }) =>
  w.kind === "principal" ? NaN : occupancyPercent(w.stock, w.capacity);

/** Ocupación conjunta Σ usado / Σ capacidad, ignorando los elementos sin dato. */
export function aggregateOccupancy(items: { used?: number; capacity?: number }[]): number {
  let used = 0, capacity = 0;
  for (const i of items) {
    if (i.used == null || i.capacity == null || !(i.capacity > 0)) continue;
    used += Math.max(0, i.used);
    capacity += i.capacity;
  }
  return occupancyPercent(used, capacity);
}

/** Distancia por calles de la retícula (1 unidad = 1 km). */
export const manhattan = (a: Coord, b: Coord) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Longitud de una polilínea de intersecciones, en km. */
export function pathKm(points: Coord[] | undefined): number {
  if (!points) return 0;
  let km = 0;
  for (let i = 1; i < points.length; i++) km += manhattan(points[i - 1], points[i]);
  return km;
}

export const DISTANCE_BANDS: DistanceBand[] = ["0-10", "10-20", "20-40", "40+"];
export const DISTANCE_BAND_LABEL: Record<DistanceBand, string> = { "0-10": "0–10 km", "10-20": "10–20 km", "20-40": "20–40 km", "40+": "40+ km" };

/** Rango semiabierto [desde, hasta): 10 km cae en "10-20". Sin dato → null. */
export function distanceBand(km: number | undefined): DistanceBand | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  for (let i = DISTANCE_BANDS_KM.length - 1; i >= 0; i--) if (km >= DISTANCE_BANDS_KM[i]) return DISTANCE_BANDS[i];
  return null;
}
