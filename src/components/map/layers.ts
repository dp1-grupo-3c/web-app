import { CircleX, House, PackageCheck, Utensils, Warehouse as WarehouseIcon, Wrench } from "lucide-react";
import type { WarehouseLook } from "./MapPin";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { BREAKDOWN_COLOR, TONE_COLOR } from "@/lib/constants";
import { percentTone, vehicleTone, warehouseOccupancy } from "@/lib/occupancy";
import { warehouseTone } from "@/lib/traffic-light";
import type { PercentBands, TrafficLight, Vehicle, VehicleStatus, Warehouse } from "@/lib/types";

/** Capas del mapa; "auto", "moto" y "bicicleta" filtran la flota (y sus rutas) por tipo de vehículo. */
export type MapLayer = "almacenes" | "flota" | "rutas" | "bloqueos" | "auto" | "moto" | "bicicleta";
export type MapLayers = Record<MapLayer, boolean>;
export const ALL_LAYERS: MapLayers = { almacenes: true, flota: true, rutas: true, bloqueos: true, auto: true, moto: true, bicicleta: true };

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
  if (w.kind === "principal") return { color: PINK, Icon: House, tone: null, empty: false };
  // Sin datos aún: borde neutro claro (el rosado queda para el central).
  if (neutral || w.stock == null) return { color: WAREHOUSE_NO_DATA_COLOR, Icon: WarehouseIcon, tone: null, empty: false };
  // Sin stock va en gris, igual que un vehículo vacío.
  if (w.stock <= 0) return { color: VEHICLE_EMPTY_COLOR, Icon: WarehouseIcon, tone: null, empty: true };
  const tone = fillBands ? percentTone(warehouseOccupancy(w), fillBands, "highIsGreen") : warehouseTone(w.stock, t);
  return { color: tone ? TONE_COLOR[tone] : WAREHOUSE_NO_DATA_COLOR, Icon: WarehouseIcon, tone, empty: false };
}

export const WAREHOUSE_NO_DATA_COLOR = "var(--color-n100)";
const WAREHOUSE_BG = "#232b35";

/** Cómo se dibuja el cuadrado: el central relleno; los intermedios con el semáforo en el borde. */
export function warehouseLook(w: Pick<Warehouse, "kind">, a: { color: string; Icon: WarehouseLook["Icon"]; empty: boolean }): WarehouseLook {
  if (w.kind === "principal") return { fill: PINK, stroke: PINK, glyph: "#161d25", Icon: a.Icon };
  return { fill: WAREHOUSE_BG, stroke: a.color, glyph: a.color, Icon: a.Icon, dashed: a.empty };
}

/** Las mismas variantes, para la leyenda. */
export const WAREHOUSE_LEGEND = {
  principal: warehouseLook({ kind: "principal" }, { color: PINK, Icon: House, empty: false }),
  sinDatos: warehouseLook({ kind: "secundario" }, { color: WAREHOUSE_NO_DATA_COLOR, Icon: WarehouseIcon, empty: false }),
  tone: (color: string) => warehouseLook({ kind: "secundario" }, { color, Icon: WarehouseIcon, empty: false }),
  vacio: warehouseLook({ kind: "secundario" }, { color: VEHICLE_EMPTY_COLOR, Icon: WarehouseIcon, empty: true }),
};

/**
 * El color es el semáforo de ocupación y el ícono distingue el tipo. Como el
 * rojo ya significa "muy cargado", la avería se marca con su propia insignia.
 */
export function vehicleAppearance(v: Vehicle, bands: PercentBands) {
  const meta = VEHICLE_META[v.kind];
  const tone = vehicleTone(v, bands);
  const broken = v.status === "averiado" ? BREAKDOWN_COLOR[v.breakdownType ?? "T2"] : undefined;
  return {
    color: tone === "empty" || !tone ? VEHICLE_EMPTY_COLOR : TONE_COLOR[tone],
    Icon: meta.Icon,
    BadgeIcon: v.status === "averiado" ? Wrench : v.status === "en_alimentacion" ? Utensils : v.status === "entregando" ? PackageCheck : undefined,
    // Avería: color de su tipo (ámbar, rojo, rojo oscuro); ámbar para la pausa de
    // alimentación; verde para la entrega en curso.
    badgeColor: broken ? broken.color : v.status === "entregando" ? "var(--color-success)" : "var(--color-warning)",
    badgeGlyph: broken?.glyph,
    meta,
  };
}

export const BlockageIcon = CircleX;
