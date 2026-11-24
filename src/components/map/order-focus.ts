import type { Coord, Vehicle } from "@/lib/types";

/**
 * Pedido fijado: qué vehículos lo llevan y qué parte de su ruta lleva a la
 * entrega. Todo sale de la foto que muestra el mapa (no del estado del pedido
 * en el servidor, que en la simulación va por delante), así una reasignación
 * se ve en el mapa en el mismo momento en que se mueve el vehículo.
 */

/** Vehículo que tiene asignado el pedido; `trip` > 0 = lo entrega tras recargar. */
export type OrderCarrier = { vehicle: Vehicle; trip: number; packages: number };

export function orderCarriers(vehicles: readonly Vehicle[], orderId: string): OrderCarrier[] {
  const out: OrderCarrier[] = [];
  for (const vehicle of vehicles) {
    const loads = vehicle.orders.filter((o) => o.orderId === orderId);
    if (!loads.length) continue;
    out.push({
      vehicle,
      trip: Math.min(...loads.map((o) => o.trip ?? 0)),
      packages: loads.reduce((sum, o) => sum + o.packagesInVehicle, 0),
    });
  }
  return out;
}

const same = (a: Coord, b: Coord) => Math.round(a.x) === b.x && Math.round(a.y) === b.y;

/**
 * Corta la ruta pendiente en la parada de entrega. Si el pedido va en un viaje
 * posterior (`trip` > 0), la parada es la primera visita al destino después de
 * pasar por `trip` almacenes; antes de eso el vehículo solo cruzaría por ahí.
 * Si la parada no aparece (ruta aún sin planificar hasta ella), toda la ruta
 * cuenta como camino a la entrega.
 */
export function splitAtDelivery(path: readonly Coord[], destination: Coord, trip: number, warehouses: readonly Coord[]): { toDelivery: Coord[]; after: Coord[] } {
  let reloads = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (reloads >= trip && same(p, destination)) return { toDelivery: path.slice(0, i + 1), after: path.slice(i) };
    if (i > 0 && warehouses.some((w) => same(p, w))) reloads++;
  }
  return { toDelivery: [...path], after: [] };
}

/**
 * Aviso cuando el pedido pasa a otro vehículo. Solo si aparece una placa
 * nueva: que una deje de llevarlo puede ser una entrega parcial, no un cambio.
 */
export function reassignmentMessage(orderId: string, before: readonly string[], now: readonly string[]): string | null {
  if (!before.length || !now.length) return null;
  const added = now.filter((p) => !before.includes(p));
  if (!added.length) return null;
  return `El pedido ${orderId} ahora lo ${added.length === 1 ? "lleva" : "llevan"} ${added.join(", ")}.`;
}
