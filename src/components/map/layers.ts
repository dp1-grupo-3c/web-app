import { CircleX, House, Package, PackageCheck, Utensils } from "lucide-react";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { TONE_COLOR } from "@/lib/constants";
import { warehouseTone } from "@/lib/traffic-light";
import type { TrafficLight, Vehicle, VehicleStatus, Warehouse } from "@/lib/types";

export type MapLayer = "almacenes" | "flota" | "rutas" | "bloqueos";
export type MapLayers = Record<MapLayer, boolean>;
export const ALL_LAYERS: MapLayers = { almacenes: true, flota: true, rutas: true, bloqueos: true };

export const PINK = "var(--color-pink)";

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  en_ruta: "En ruta",
  disponible: "Disponible",
  averiado: "Averiado",
  en_alimentacion: "Pausa de alimentación",
  entregando: "Entregando · acondicionamiento",
  abasteciendo: "Abasteciendo",
};

export function warehouseAppearance(w: Warehouse, t: TrafficLight, neutral: boolean) {
  if (w.kind === "principal") return { color: PINK, Icon: House, tone: null };
  if (neutral || w.stock == null) return { color: PINK, Icon: Package, tone: null };
  const tone = warehouseTone(w.stock, t);
  return { color: TONE_COLOR[tone], Icon: Package, tone };
}

export function vehicleAppearance(v: Vehicle) {
  const meta = VEHICLE_META[v.kind];
  return {
    color: v.status === "averiado" ? "var(--color-critic)" : meta.color,
    Icon: meta.Icon,
    BadgeIcon: v.status === "en_alimentacion" ? Utensils : v.status === "entregando" ? PackageCheck : undefined,
    // Ámbar para la pausa de alimentación; verde para la entrega en curso.
    badgeColor: v.status === "entregando" ? "var(--color-success)" : "var(--color-warning)",
    meta,
  };
}

export const BlockageIcon = CircleX;
