/**
 * Registro de recorridos — ESTIMADO en el frontend.
 *
 * El backend de simulaciones no informa el almacén de origen de un vehículo
 * o de un pedido, ni la hora de salida o de entrega. Este reductor puro los
 * deduce comparando fotografías consecutivas:
 *
 * - Un vehículo "parte" cuando deja de estar sobre un almacén; su origen es
 *   el último almacén donde se le vio.
 * - Un pedido "sale" con el vehículo que lo lleva a bordo; su origen es el
 *   origen de ese vehículo.
 * - Hay una "entrega" cuando a un vehículo, fuera de un almacén, le bajan
 *   paquetes de un pedido que no pasan a otro vehículo (eso sería un
 *   trasvase, p. ej. tras una avería).
 *
 * Solo ve lo ocurrido desde que esta pestaña se conectó a la corrida: lo
 * anterior queda sin dato (la UI lo indica). Se reinicia con cada corrida.
 */

import type { Coord, VehicleStatus } from "@/lib/types";

/** Lo mínimo que se necesita de un vehículo (un `Vehicle` lo cumple). */
export type TripVehicle = {
  id: string;
  position: Coord;
  status: VehicleStatus;
  /** `trip` > 0: entrega de un viaje posterior a una recarga, aún no a bordo. */
  orders: { orderId: string; packagesInVehicle: number; trip?: number }[];
};

/** Solo la carga actual (viaje 0) va de verdad a bordo. */
export const loadedOrders = (v: Pick<TripVehicle, "orders">) => v.orders.filter((o) => !o.trip);
export type TripWarehouse = { id: string; position: Coord };

export type VehicleTrip = {
  /** Almacén donde está ahora (null = en la calle). */
  atWarehouseId: string | null;
  /** Último almacén donde se le vio: origen del viaje actual. */
  originId: string | null;
  originPosition: Coord | null;
  /** Minuto simulado en que salió del origen (null = no se vio salir). */
  departedAt: number | null;
  /** Paquetes a bordo por pedido en la foto anterior. */
  carried: Record<string, number>;
};

export type OrderTrip = { originId: string | null; departedAt: number | null };

export type Delivery = { orderId: string; vehicleId: string; warehouseId: string | null; minute: number; packages: number };

export type TripLog = {
  runId: string | null;
  minute: number | null;
  vehicles: Record<string, VehicleTrip>;
  orders: Record<string, OrderTrip>;
  /** Solo las de la ventana configurada (más recientes al final). */
  deliveries: Delivery[];
};

export const emptyTripLog = (runId: string | null = null): TripLog => ({ runId, minute: null, vehicles: {}, orders: {}, deliveries: [] });

const same = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

export type TripObservation = {
  runId: string | null;
  minute: number;
  vehicles: TripVehicle[];
  warehouses: TripWarehouse[];
  /** Entregas que se conservan, en minutos simulados hacia atrás. */
  windowMin: number;
};

export function observe(log: TripLog, o: TripObservation): TripLog {
  // Otra corrida, o la reproducción retrocedió: se empieza de cero.
  const base = log.runId !== o.runId || (log.minute != null && o.minute < log.minute) ? emptyTripLog(o.runId) : log;
  if (base === log && log.minute === o.minute) return log; // misma foto: nada nuevo

  const first = base.minute == null;
  const aboardNow = new Map<string, number>(); // pedido → paquetes a bordo en toda la flota
  for (const v of o.vehicles) for (const p of loadedOrders(v)) aboardNow.set(p.orderId, (aboardNow.get(p.orderId) ?? 0) + p.packagesInVehicle);

  const vehicles: Record<string, VehicleTrip> = {};
  const orders: Record<string, OrderTrip> = { ...base.orders };
  const deliveries = [...base.deliveries];

  for (const v of o.vehicles) {
    const prev = base.vehicles[v.id];
    const at = o.warehouses.find((w) => same(w.position, v.position)) ?? null;
    const left = !!prev?.atWarehouseId && !at;
    const trip: VehicleTrip = {
      atWarehouseId: at?.id ?? null,
      originId: at ? at.id : prev?.originId ?? null,
      originPosition: at ? at.position : prev?.originPosition ?? null,
      departedAt: at ? null : left ? o.minute : prev?.departedAt ?? null,
      carried: {},
    };
    for (const p of loadedOrders(v)) {
      trip.carried[p.orderId] = p.packagesInVehicle;
      const known = orders[p.orderId];
      if (!known) {
        // Pedido nuevo a bordo. En la primera foto no se sabe de dónde salió.
        orders[p.orderId] = { originId: first && !at ? null : trip.originId, departedAt: at || first ? null : trip.departedAt ?? o.minute };
      } else if (left && known.departedAt == null) {
        orders[p.orderId] = { ...known, departedAt: o.minute };
      }
    }
    // Paquetes que bajaron fuera de un almacén y no siguen en otro vehículo: entrega.
    if (prev && !at) {
      for (const [orderId, before] of Object.entries(prev.carried)) {
        const now = trip.carried[orderId] ?? 0;
        if (now >= before) continue;
        const elsewhere = (aboardNow.get(orderId) ?? 0) - now;
        const delivered = before - now - Math.max(0, elsewhere);
        if (delivered > 0) deliveries.push({ orderId, vehicleId: v.id, warehouseId: orders[orderId]?.originId ?? prev.originId, minute: o.minute, packages: delivered });
      }
    }
    vehicles[v.id] = trip;
  }

  // Pedidos que ya no van a bordo de nadie: se olvidan (su entrega, si la hubo, quedó registrada).
  for (const id of Object.keys(orders)) if (!aboardNow.has(id)) delete orders[id];
  const since = o.minute - o.windowMin;
  return { runId: o.runId, minute: o.minute, vehicles, orders, deliveries: deliveries.filter((d) => d.minute >= since) };
}
