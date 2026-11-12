import { horaEntrega, minutosEntre } from "@/lib/data/adapters";
import type { EnviosAlmacen } from "@/lib/backend/types";

/** Salida planificada de una parte de un pedido desde un almacén. */
export type WarehouseDeparture = { orderId: string; packages: number; plate: string; departsAt: string; minutesAhead: number };

/**
 * Salidas del almacén entre la hora mostrada (`ahora`, excluida) y `hours` horas
 * después, de la más próxima a la más lejana. El mapa de la simulación va por
 * detrás del servidor: lo que para el servidor ya salió (enTransito) y para la
 * hora mostrada todavía no, también cuenta como "por salir".
 */
export function departuresFrom(envios: Pick<EnviosAlmacen, "enTransito" | "porSalir">, ahora: string, hours: number): WarehouseDeparture[] {
  const out: WarehouseDeparture[] = [];
  for (const { idPedido, envio } of [...envios.porSalir, ...envios.enTransito]) {
    if (!envio.fechaHoraSalida) continue;
    const minutesAhead = minutosEntre(ahora, envio.fechaHoraSalida);
    if (minutesAhead <= 0 || minutesAhead > hours * 60) continue;
    out.push({ orderId: String(idPedido), packages: envio.cantidad, plate: envio.codigoUnidad, departsAt: horaEntrega(envio.fechaHoraSalida, ahora), minutesAhead });
  }
  return out.sort((a, b) => a.minutesAhead - b.minutesAhead || Number(a.orderId) - Number(b.orderId) || a.plate.localeCompare(b.plate));
}

/** Pedidos distintos y paquetes de una lista de salidas (para la tarjeta y el pie de la tabla). */
export function departureTotals(rows: WarehouseDeparture[]): { orders: number; packages: number } {
  return { orders: new Set(rows.map((r) => r.orderId)).size, packages: rows.reduce((n, r) => n + r.packages, 0) };
}
