// Reporte de la última planificación estable: totales y texto para descargar.

import type { ParadaPlan, PlanVigente, ReportePlan, RutaPlan } from "@/lib/backend/types";
import { formatMoney, formatNumber } from "@/lib/format";

const TIPO_UNIDAD: Record<RutaPlan["tipoUnidad"], string> = { AUTO: "Auto", MOTO: "Moto", BICICLETA: "Bicicleta" };

// "2026-09-02T10:30:00" → "02/09 10:30", sin pasar por la zona horaria del navegador.
export function planStamp(fechaHora: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fechaHora ?? "");
  return m ? `${m[2]}/${m[1]} ${m[3]}:${m[4]}` : "—";
}

export const unitKindLabel = (tipo: RutaPlan["tipoUnidad"]) => TIPO_UNIDAD[tipo] ?? tipo;

// Nombres de los almacenes por id; sin nombre se muestra el id.
export type WarehouseNames = Record<number, string>;

export function stopLabel(p: ParadaPlan, names: WarehouseNames = {}): string {
  if (p.tipo === "ENTREGA") return `Entrega del pedido ${p.idPedido} · ${p.cantidad} paq.`;
  if (p.tipo === "ABASTECIMIENTO") return p.idAlmacen >= 0 ? `Carga en ${names[p.idAlmacen] ?? `el almacén ${p.idAlmacen}`}` : "Carga en almacén";
  return "Pausa de alimentación";
}

export type PlanTotals = { routes: number; deliveries: number; orders: number; unassignedOrders: number; unassignedPackages: number };

// Solo cuentan las rutas con paradas; una unidad sin itinerario no es parte del plan.
export function planTotals(plan: PlanVigente): PlanTotals {
  const routes = plan.rutas.filter((r) => r.paradas.length > 0);
  const deliveries = routes.flatMap((r) => r.paradas.filter((p) => p.tipo === "ENTREGA"));
  const pending = Object.values(plan.sinAsignar ?? {});
  return {
    routes: routes.length,
    deliveries: deliveries.length,
    orders: new Set(deliveries.map((p) => p.idPedido)).size,
    unassignedOrders: pending.length,
    unassignedPackages: pending.reduce((a, b) => a + b, 0),
  };
}

// Líneas del reporte en texto plano, una ruta tras otra con sus paradas.
export function planReportLines(r: ReportePlan, names: WarehouseNames = {}): string[] {
  const lines = ["ÚLTIMA PLANIFICACIÓN ESTABLE", "----------------------------"];
  const plan = r.plan;
  if (!plan) return [...lines, "Sin planificación: la corrida terminó antes de la primera."];
  const t = planTotals(plan);
  lines.push(
    `Planificado:         ${planStamp(plan.fechaHora)} con ${plan.algoritmo}`,
    `Rutas:               ${t.routes}, con ${t.deliveries} entregas de ${t.orders} pedidos`,
    `Paquetes planificados: ${formatNumber(plan.paquetesPlanificados)}`,
    `Distancia:           ${formatNumber(plan.kilometros)} km`,
    `Costo:               ${formatMoney(plan.costo)}`,
    `Sin asignar:         ${t.unassignedOrders} pedidos, ${t.unassignedPackages} paquetes`,
  );
  for (const ruta of plan.rutas.filter((x) => x.paradas.length > 0)) {
    lines.push("", `${unitKindLabel(ruta.tipoUnidad)} ${ruta.codigoUnidad} · ${ruta.kilometros} km · ${formatMoney(ruta.costo)}`);
    for (const p of ruta.paradas) {
      lines.push(`  ${planStamp(p.fechaHoraLlegada)} → ${planStamp(p.fechaHoraSalida)}  (${p.x},${p.y})  ${stopLabel(p, names)}`);
    }
  }
  return lines;
}
