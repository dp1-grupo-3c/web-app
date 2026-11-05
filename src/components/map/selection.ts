import type { Coord, Order, Vehicle } from "@/lib/types";

/**
 * Destinos de los pedidos que le quedan al vehículo, agrupados por intersección
 * y en el orden de su ruta, sin inferir paradas a partir de esquinas.
 *
 * La lista sale del propio vehículo, es decir de la foto que se está mostrando:
 * el backend quita un pedido de esa lista cuando la unidad llega y empieza a
 * entregarlo. No se mira el estado actual del pedido, porque en la simulación el
 * mapa va por detrás del servidor y el pedido ya figuraría como entregado antes
 * de que el vehículo llegue en pantalla. `known` aporta el destino de los pedidos
 * que el servidor ya no lista por estar entregados.
 */
export function assignedDestinations(vehicle: Vehicle, orders: Order[], known?: ReadonlyMap<string, Coord>): { key: string; position: Coord; orderIds: string[] }[] {
  const byId = new Map(orders.map((order) => [order.id, order.destination]));
  const destinations = new Map<string, { key: string; position: Coord; orderIds: string[] }>();
  for (const { orderId } of vehicle.orders) {
    const position = byId.get(orderId) ?? known?.get(orderId);
    if (!position) continue;
    const key = `${position.x},${position.y}`;
    const destination = destinations.get(key) ?? { key, position, orderIds: [] };
    if (!destination.orderIds.includes(orderId)) destination.orderIds.push(orderId);
    destinations.set(key, destination);
  }
  return [...destinations.values()];
}
