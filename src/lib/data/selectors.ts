/**
 * Selectores derivados de la simulación: filas listas para los listados y
 * los tooltips. Puros: los hooks (useSimulationRows, useOrderRows) los
 * memoizan por fotografía, así que no se recalculan en cada cuadro de la
 * animación del mapa.
 *
 * Los minutos son minutos SIMULADOS de la corrida; la UI los convierte a
 * hora con clockAt(). Las distancias van en km (1 unidad de la retícula).
 */

import { aggregateOccupancy, manhattan, pathKm, percentTone, vehicleOccupancy, warehouseOccupancy } from "@/lib/occupancy";
import type { Coord, Order, PercentBands, StatusTone, Vehicle, VehicleKind, VehiclePhase, VehicleStatus, Warehouse } from "@/lib/types";
import { loadedOrders, type TripLog } from "./trips";

export type VehicleRow = {
  id: string;
  plate: string;
  kind: VehicleKind;
  status: VehicleStatus;
  position: Coord;
  /** Paquetes a bordo ("stock actual" del vehículo) y capacidad. */
  load: number;
  capacity: number;
  /** % de ocupación (NaN sin capacidad) y su semáforo según el tipo. */
  occupancy: number;
  tone: StatusTone | null;
  /** Pedidos asignados: a bordo y de viajes posteriores a una recarga. */
  orderIds: string[];
  /** Solo los que lleva a bordo ahora. */
  loadedOrderIds: string[];
  /** Al destino inmediato. */
  etaMinutes: number | null;
  remainingKm: number;
  /** Del itinerario vigente (el backend lo reinicia al replanificar). */
  traveledKm: number;
  /** Manhattan desde el almacén de origen estimado (null = sin dato). */
  fromOriginKm: number | null;
  // Minutos desde que salió del almacén de origen (null = sin dato o aún no sale).
  fromOriginMinutes: number | null;
  originId: string | null;
  departureMinute: number | null;
  arrivalMinute: number | null;
  // Llegando o saliendo, según el servidor (null = sin ruta).
  phase: VehiclePhase | null;
};

export function selectVehicleRows(vehicles: Vehicle[], trips: TripLog, minute: number | null, bands: Record<VehicleKind, PercentBands>, warehouses: Warehouse[] = []): VehicleRow[] {
  return vehicles.map((v) => {
    const trip = trips.vehicles[v.id];
    const occupancy = vehicleOccupancy(v);
    // El origen que informa el servidor manda; si no, el estimado y luego el primer nodo recorrido.
    const reported = v.originWarehouseId ? warehouses.find((w) => w.id === v.originWarehouseId)?.position : undefined;
    const origin = reported ?? trip?.originPosition ?? v.route?.traveled[0] ?? null;
    const departed = v.originDepartureMinute ?? trip?.departedAt ?? null;
    return {
      id: v.id,
      plate: v.plate,
      kind: v.kind,
      status: v.status,
      position: v.position,
      load: v.load,
      capacity: v.capacity,
      occupancy,
      tone: percentTone(occupancy, bands[v.kind], "lowIsGreen"),
      orderIds: [...new Set(v.orders.map((o) => o.orderId))],
      loadedOrderIds: loadedOrders(v).map((o) => o.orderId),
      etaMinutes: v.etaMinutes ?? null,
      remainingKm: pathKm(v.route?.pending),
      traveledKm: pathKm(v.route?.traveled),
      fromOriginKm: origin ? manhattan(origin, v.position) : null,
      fromOriginMinutes: departed != null && minute != null && minute >= departed ? minute - departed : null,
      originId: v.originWarehouseId ?? trip?.originId ?? null,
      departureMinute: departed,
      arrivalMinute: v.etaMinutes != null && minute != null ? minute + v.etaMinutes : null,
      phase: v.phase ?? null,
    };
  });
}

export type WarehouseRow = {
  id: string;
  name: string;
  kind: Warehouse["kind"];
  position: Coord;
  stock: number | null;
  capacity: number | null;
  /** NaN para el central (ilimitado). */
  occupancy: number;
  tone: StatusTone | null;
  /** Pedidos ya salidos de este almacén y aún a bordo (estimado). */
  inTransit: number;
  /** Pedidos cargados en vehículos que siguen en este almacén. */
  toDepart: number;
  /** Pedidos con entregas en la ventana (últimas 4 h simuladas), estimado. */
  deliveredRecent: number;
};

export function selectWarehouseRows(warehouses: Warehouse[], vehicles: Vehicle[], trips: TripLog, bands: PercentBands): WarehouseRow[] {
  const inTransit = new Map<string, Set<string>>();
  const toDepart = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, w: string, o: string) => (m.get(w) ?? m.set(w, new Set()).get(w)!).add(o);
  for (const v of vehicles) {
    const trip = trips.vehicles[v.id];
    for (const o of loadedOrders(v)) {
      if (trip?.atWarehouseId) add(toDepart, trip.atWarehouseId, o.orderId);
      else {
        const origin = trips.orders[o.orderId]?.originId ?? trip?.originId;
        if (origin) add(inTransit, origin, o.orderId);
      }
    }
  }
  const delivered = new Map<string, Set<string>>();
  for (const d of trips.deliveries) if (d.warehouseId) add(delivered, d.warehouseId, d.orderId);

  return warehouses.map((w) => {
    const occupancy = warehouseOccupancy(w);
    return {
      id: w.id,
      name: w.name,
      kind: w.kind,
      position: w.position,
      stock: w.stock ?? null,
      capacity: w.capacity ?? null,
      occupancy,
      tone: w.kind === "principal" ? null : percentTone(occupancy, bands, "highIsGreen"),
      inTransit: inTransit.get(w.id)?.size ?? 0,
      toDepart: toDepart.get(w.id)?.size ?? 0,
      deliveredRecent: delivered.get(w.id)?.size ?? 0,
    };
  });
}

/** `loaded`: lo lleva a bordo; si no, lo entregará tras una recarga. */
export type OrderCarrier = { vehicleId: string; plate: string; packages: number; loaded: boolean; position: Coord; etaMinutes: number | null };

export type OrderRow = Order & {
  /** Vehículos que lo llevan a bordo (un pedido puede repartirse en varios). */
  carriers: OrderCarrier[];
  /** Posición actual en la ruta: la del primer vehículo que lo lleva. */
  currentPoint: Coord | null;
  /** Hora de llegada estimada: cuando el destino inmediato de un vehículo es el del pedido. */
  arrivalMinute: number | null;
  departureMinute: number | null;
  originId: string | null;
};

export function selectOrderRows(orders: Order[], vehicles: Vehicle[], trips: TripLog, minute: number | null): OrderRow[] {
  const byOrder = new Map<string, OrderCarrier[]>();
  for (const v of vehicles) {
    for (const o of v.orders) {
      const list = byOrder.get(o.orderId) ?? [];
      list.push({ vehicleId: v.id, plate: v.plate, packages: o.packagesInVehicle, loaded: !o.trip, position: v.position, etaMinutes: v.etaMinutes ?? null });
      byOrder.set(o.orderId, list);
    }
  }
  const destinationOf = new Map(vehicles.map((v) => [v.id, v.destination]));
  return orders.map((o) => {
    // Primero los que lo llevan a bordo.
    const carriers = (byOrder.get(o.id) ?? []).sort((a, b) => Number(b.loaded) - Number(a.loaded));
    // Solo cuenta la ETA de un vehículo cuyo destino inmediato es el del pedido.
    const etas = carriers
      .filter((c) => { const d = destinationOf.get(c.vehicleId); return c.loaded && c.etaMinutes != null && d && d.x === o.destination.x && d.y === o.destination.y; })
      .map((c) => c.etaMinutes!);
    const trip = trips.orders[o.id];
    return {
      ...o,
      carriers,
      currentPoint: carriers.find((c) => c.loaded)?.position ?? null,
      arrivalMinute: etas.length && minute != null ? minute + Math.max(...etas) : null,
      departureMinute: trip?.departedAt ?? null,
      originId: trip?.originId ?? null,
    };
  });
}

/** Ocupación global de la flota en % (Σ carga / Σ capacidad). */
export const fleetOccupancy = (vehicles: Vehicle[]) => aggregateOccupancy(vehicles.map((v) => ({ used: v.load, capacity: v.capacity })));

/** Llenado global de los almacenes intermedios en % (Σ stock / Σ capacidad). */
export const warehouseFill = (warehouses: Warehouse[]) =>
  aggregateOccupancy(warehouses.filter((w) => w.kind !== "principal").map((w) => ({ used: w.stock, capacity: w.capacity })));

/**
 * Hora simulada ("HH:MM" y día de la corrida) de un minuto, a partir de la
 * hora de la foto actual. Se lee la fecha como UTC solo para restar: así la
 * zona del navegador no la altera.
 */
export function clockAt(currentSimTime: string, currentMinute: number, minute: number): { day: string; time: string } {
  const at = new Date(Date.parse(currentSimTime.slice(0, 19) + "Z") + (minute - currentMinute) * 60_000);
  const iso = at.toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** "HH:MM" simulada de un minuto; si cae en otra fecha, "dd/mm HH:MM". Sin dato → "—". */
export function formatSimClock(currentSimTime: string | null, currentMinute: number | null, minute: number | null): string {
  if (minute == null || currentSimTime == null || currentMinute == null) return "—";
  const c = clockAt(currentSimTime, currentMinute, minute);
  return c.day === currentSimTime.slice(0, 10) ? c.time : `${c.day.slice(8, 10)}/${c.day.slice(5, 7)} ${c.time}`;
}
