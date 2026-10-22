import type { Coord, Order, Vehicle } from "@/lib/types";

/** Agrupa pedidos asignados por su destino, sin inferir paradas a partir de esquinas. */
export function assignedDestinations(vehicle: Vehicle, orders: Order[]): { key: string; position: Coord; orderIds: string[] }[] {
  const assigned = new Set(vehicle.orders.map((order) => order.orderId));
  const destinations = new Map<string, { key: string; position: Coord; orderIds: string[] }>();
  for (const order of orders) {
    if (!assigned.has(order.id) || order.status === "entregado") continue;
    const key = `${order.destination.x},${order.destination.y}`;
    const destination = destinations.get(key) ?? { key, position: order.destination, orderIds: [] };
    if (!destination.orderIds.includes(order.id)) destination.orderIds.push(order.id);
    destinations.set(key, destination);
  }
  return [...destinations.values()];
}
