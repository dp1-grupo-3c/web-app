/**
 * Sincroniza la lista de pedidos con la foto que muestra el mapa.
 *
 * En la simulación el mapa reproduce las fotos con un buffer y va por detrás
 * del servidor (≈ 1 h simulada en el colapso), pero la lista de pedidos se
 * consulta con la hora actual del servidor. Sin esta sincronización un pedido
 * desaparece del panel en cuanto el servidor lo entrega, mientras el vehículo
 * todavía va en camino en pantalla, y "Vence en" no coincide con la hora del mapa.
 */

import type { FilaPedido, InstantaneaSimulacion } from "@/lib/backend/types";
import type { Order } from "@/lib/types";
import { entregaPrevista, filaPedidoToOrder, llegadaCompleta, minutosEntre, vistaUnidadToVehicle } from "./adapters";

/** Sondeos seguidos (3 s c/u) que se conserva un pedido que el servidor ya no lista. */
export const RETENCION_SONDEOS = 40;

export type PedidoVisto = { fila: FilaPedido; ausencias: number };

/**
 * Acumula los pedidos vistos en la corrida. Uno que deja de aparecer (entregado)
 * se conserva unos sondeos para que el mapa, que va por detrás, alcance a mostrarlo.
 */
export function acumularVistos(previos: ReadonlyMap<number, PedidoVisto>, filas: FilaPedido[]): Map<number, PedidoVisto> {
  const vistos = new Map<number, PedidoVisto>();
  const actuales = new Set(filas.map((f) => f.id));
  for (const [id, v] of previos) {
    if (actuales.has(id)) continue;
    if (v.ausencias + 1 <= RETENCION_SONDEOS) vistos.set(id, { fila: v.fila, ausencias: v.ausencias + 1 });
  }
  for (const f of filas) vistos.set(f.id, { fila: f, ausencias: 0 });
  return vistos;
}

/**
 * Pedidos tal como estaban en el instante de la foto mostrada:
 * - los que el servidor ya entregó siguen listados mientras algún vehículo de
 *   la foto los tenga pendientes (se quitan cuando el vehículo llega y entrega);
 * - los registrados después de la hora mostrada todavía no aparecen;
 * - "Vence en" se mide desde la hora mostrada, no desde la del servidor.
 * Sin foto, se usa la lista del servidor tal cual.
 */
export function ordersAtShownTime(vistos: ReadonlyMap<number, PedidoVisto>, shown: InstantaneaSimulacion | null): Order[] {
  const filas = [...vistos.values()];
  if (!shown) return filas.filter((v) => v.ausencias === 0).map((v) => filaPedidoToOrder(v.fila, []));
  const vehicles = shown.unidades.map(vistaUnidadToVehicle);
  const pendientes = new Set(vehicles.flatMap((v) => v.orders.map((o) => o.orderId)));
  const ahora = shown.fechaHoraSimulada;
  return filas
    .filter((v) => (v.ausencias === 0 || pendientes.has(String(v.fila.id))) && minutosEntre(v.fila.registro, ahora) >= 0)
    .map((v) => ({ ...filaPedidoToOrder(v.fila, vehicles), minutesLeft: minutosEntre(ahora, v.fila.limite), ...entregaPrevista(llegadaCompleta(v.fila.envios, v.fila.pendientes), ahora) }))
    .sort((a, b) => a.minutesLeft - b.minutesLeft || Number(a.id) - Number(b.id));
}
