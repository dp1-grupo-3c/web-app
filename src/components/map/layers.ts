import { CircleX, House, Package } from "lucide-react";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { TONE_COLOR } from "@/lib/constants";
import { warehouseTone } from "@/lib/traffic-light";
import type { TrafficLight, Vehicle, Warehouse } from "@/lib/types";

export type MapLayer = "almacenes" | "flota" | "rutas" | "bloqueos";
export type MapLayers = Record<MapLayer, boolean>;
export const ALL_LAYERS: MapLayers = { almacenes: true, flota: true, rutas: true, bloqueos: true };

export const PINK = "var(--color-pink)";

export function warehouseAppearance(w: Warehouse, t: TrafficLight, neutral: boolean) {
  if (w.kind === "principal") return { color: PINK, Icon: House, tone: null };
  if (neutral || w.stock == null) return { color: PINK, Icon: Package, tone: null };
  const tone = warehouseTone(w.stock, t);
  return { color: TONE_COLOR[tone], Icon: Package, tone };
}

export function vehicleAppearance(v: Vehicle) {
  const meta = VEHICLE_META[v.kind];
  return { color: v.status === "averiado" ? "var(--color-critic)" : meta.color, Icon: meta.Icon, meta };
}

export const BlockageIcon = CircleX;
