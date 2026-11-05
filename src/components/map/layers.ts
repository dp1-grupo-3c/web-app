import { CircleX, House, Package, PackageCheck, Utensils, Wrench } from "lucide-react";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { TONE_COLOR } from "@/lib/constants";
import { percentTone, vehicleTone, warehouseOccupancy } from "@/lib/occupancy";
import { warehouseTone } from "@/lib/traffic-light";
import type { PercentBands, TrafficLight, Vehicle, VehicleStatus, Warehouse } from "@/lib/types";

export type MapLayer = "almacenes" | "flota" | "rutas" | "bloqueos";
export type MapLayers = Record<MapLayer, boolean>;
export const ALL_LAYERS: MapLayers = { almacenes: true, flota: true, rutas: true, bloqueos: true };

export const PINK = "var(--color-pink)";
/** Vehículo sin carga: gris, para no confundirlo con un verde de poca ocupación. */
export const VEHICLE_EMPTY_COLOR = "var(--color-n400)";

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  en_ruta: "En ruta",
  disponible: "Disponible",
  averiado: "Averiado",
  en_alimentacion: "Pausa de alimentación",
  entregando: "Entregando · acondicionamiento",
  abasteciendo: "Abasteciendo",
};

/**
 * Color del almacén. Con `fillBands` (simulación) usa el llenado en % de la
 * configuración, igual que el listado y las métricas; sin ellos, el semáforo
 * en paquetes (operación diaria).
 */
export function warehouseAppearance(w: Warehouse, t: TrafficLight, neutral: boolean, fillBands?: PercentBands) {
  if (w.kind === "principal") return { color: PINK, Icon: House, tone: null };
  if (neutral || w.stock == null) return { color: PINK, Icon: Package, tone: null };
  const tone = fillBands ? percentTone(warehouseOccupancy(w), fillBands, "highIsGreen") : warehouseTone(w.stock, t);
  return { color: tone ? TONE_COLOR[tone] : PINK, Icon: Package, tone };
}

/**
 * El color es el semáforo de ocupación y el ícono distingue el tipo. Como el
 * rojo ya significa "muy cargado", la avería se marca con su propia insignia.
 */
export function vehicleAppearance(v: Vehicle, bands: PercentBands) {
  const meta = VEHICLE_META[v.kind];
  const tone = vehicleTone(v, bands);
  return {
    color: tone === "empty" || !tone ? VEHICLE_EMPTY_COLOR : TONE_COLOR[tone],
    Icon: meta.Icon,
    BadgeIcon: v.status === "averiado" ? Wrench : v.status === "en_alimentacion" ? Utensils : v.status === "entregando" ? PackageCheck : undefined,
    // Rojo para la avería; ámbar para la pausa de alimentación; verde para la entrega en curso.
    badgeColor: v.status === "averiado" ? "var(--color-critic)" : v.status === "entregando" ? "var(--color-success)" : "var(--color-warning)",
    meta,
  };
}

export const BlockageIcon = CircleX;
