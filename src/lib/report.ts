import { PRIORITIES, SIMULATION_TITLE, TONE_LABEL } from "./constants";
import { formatClock, formatElapsed, formatHours, formatMoney, formatNumber, formatPercent, formatSimStamp, formatDate, formatTime, parseISODate } from "./format";
import { DELIVERY_TONE_LABEL, deliveryTone } from "./traffic-light";
import type { SimulationOutcome, SimulationSummary } from "./types";

export const OUTCOME_LABEL: Record<SimulationOutcome, string> = {
  exito: "Culminó con éxito",
  cancelada: "Cancelada",
  colapso: "Colapso de operaciones",
  sin_datos: "Sin colapso (datos agotados)",
  fallida: "Error del servidor",
};

/** Mensaje principal del resumen (se usa en el modal y en el reporte). */
export function summaryHeadline(s: Pick<SimulationSummary, "outcome" | "mode" | "startDate" | "firstLateOrder">): string {
  const name = SIMULATION_TITLE[s.mode].toLowerCase();
  const start = parseISODate(s.startDate);
  const ini = formatDate(start);
  const fin = formatDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4));
  const range = s.mode === "5d" ? ` del ${ini} al ${fin}` : ` iniciada el ${ini}`;
  if (s.outcome === "exito") return `La ${name}${range} terminó con éxito.`;
  if (s.outcome === "cancelada") return `Cancelaste la ${name}${range}.`;
  if (s.outcome === "fallida") return `La ${name}${range} se detuvo por un error del servidor.`;
  if (s.outcome === "sin_datos") return `La ${name}${range} no colapsó antes de que se agotaran los datos de ventas.`;
  const late = s.firstLateOrder;
  if (!late) return `La ${name}${range} se detuvo porque las operaciones colapsaron.`;
  const when = formatSimStamp(late.dueAt, s.startDate).date;
  const who = s.mode === "5d" ? `La ${name} colapsó` : "Las operaciones colapsaron";
  return `${who} el ${when}: el pedido ${late.orderId} no llegó a tiempo.`;
}

export const OUTCOME_DETAIL: Record<SimulationOutcome, string> = {
  exito: "Todos los pedidos se entregaron dentro de su plazo.",
  cancelada: "Estos son los resultados obtenidos hasta el momento de la cancelación.",
  colapso: "Una simulación colapsa en cuanto el primer pedido supera su plazo de entrega. Este es el detalle de ese pedido.",
  sin_datos: "No hay archivo de ventas para el mes siguiente y todos los pedidos cargados se entregaron a tiempo. No hay instante de colapso que medir: la flota aguantó al menos hasta aquí.",
  fallida: "El backend interrumpió la corrida por un error interno antes de poder enviar el resumen.",
};

/** Reporte en texto plano con el mismo contenido que el resumen en pantalla. */
export function buildReportText(s: SimulationSummary, now = new Date()): string {
  const line = "=".repeat(72);
  const sub = "-".repeat(72);
  const km = s.distanceKm;
  const total = km.auto + km.moto + km.bicicleta;
  const out: string[] = [
    "KINDBOX · REPORTE DE SIMULACIÓN",
    line,
    `Simulación:  ${SIMULATION_TITLE[s.mode]}`,
    `Resultado:   ${OUTCOME_LABEL[s.outcome]}`,
    `Inicio:      ${formatDate(parseISODate(s.startDate))}`,
    `Generado:    ${formatDate(now)} ${formatTime(now)}`,
    "",
    summaryHeadline(s),
    OUTCOME_DETAIL[s.outcome],
    "",
  ];
  const late = s.firstLateOrder;
  if (s.outcome === "colapso" && late) {
    const p = PRIORITIES.find((x) => x.code === late.priority)!;
    const reg = formatSimStamp(late.registeredAt, s.startDate);
    const due = formatSimStamp(late.dueAt, s.startDate);
    out.push(
      "PRIMER PEDIDO FUERA DE PLAZO",
      sub,
      `Pedido:              ${late.orderId} (${late.packages} paquetes)`,
      `Destino:             (${late.destination.x}, ${late.destination.y})`,
      `Prioridad:           ${p.name} · plazo de ${p.hours} h`,
      `Registrado:          ${reg.day} (${reg.date})`,
      `Plazo vencido:       ${due.day} (${due.date})`,
      `Vehículo asignado:   ${late.vehiclePlate ?? "Sin asignar"}${late.remainingKm != null ? `, a ${late.remainingKm} km del destino` : ""}`,
      "",
    );
  }
  out.push(
    "INDICADORES",
    sub,
    `Pedidos entregados:  ${formatNumber(s.delivered)} (${formatPercent(s.onTimeRate)} a tiempo)`,
    `Tiempo simulado:     ${formatElapsed(s.simulatedMinutes)}`,
    `Tiempo de ejecución: ${formatClock(s.executionSeconds)} min`,
    `Distancia recorrida: ${formatNumber(total)} km (Auto ${km.auto} · Moto ${km.moto} · Bicicleta ${km.bicicleta})`,
    `Costo total rutas:   ${formatMoney(s.totalCost)}`,
    "",
    "TIEMPO PROMEDIO DE ENTREGA POR PRIORIDAD",
    sub,
    ...s.avgDeliveryByPriority.map(({ priority, avgMinutes }) => {
      const p = PRIORITIES.find((x) => x.code === priority)!;
      const { ratio, tone } = deliveryTone(avgMinutes, p.hours);
      return `${p.name.padEnd(15)} plazo ${String(p.hours).padStart(2)} h   promedio ${formatHours(avgMinutes).padStart(8)}   ${String(Math.round(ratio * 100)).padStart(3)} % del plazo   ${DELIVERY_TONE_LABEL[tone]}`;
    }),
    "",
    "RANGOS DEL SEMÁFORO USADOS (paquetes)",
    sub,
    `Rojo:   0 – ${s.trafficLight.redTo}`,
    `Ámbar:  ${s.trafficLight.amberFrom} – ${s.trafficLight.amberTo}`,
    `Verde:  ${s.trafficLight.greenFrom} – 1000`,
    "",
    "EVENTOS DE LA SIMULACIÓN",
    sub,
    ...s.events.map((e) => `${`Día ${e.at.day} · ${e.at.time}`.padEnd(15)} [${TONE_LABEL[e.tone].toUpperCase()}]`.padEnd(25) + e.message),
    "",
    line,
  );
  return out.join("\r\n");
}

export function reportFileName(s: SimulationSummary) {
  return `kindbox-reporte-${s.mode === "5d" ? "5-dias" : "colapso"}-${s.startDate}.txt`;
}

/** Descarga un .txt en UTF-8 con BOM (para que el Bloc de notas muestre bien las tildes). */
export function downloadTextFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
