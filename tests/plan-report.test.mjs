import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const r = load("src/lib/plan-report.ts");

const parada = (tipo, extra = {}) => ({
  tipo, x: 10, y: 20, idPedido: -1, idAlmacen: -1, cantidad: 0, minutoLlegada: 0, minutoSalida: 0,
  fechaHoraLlegada: "2026-09-02T10:30:00", fechaHoraSalida: "2026-09-02T10:45:00", ...extra,
});

const plan = {
  minuto: 630, fechaHora: "2026-09-02T10:30:00", algoritmo: "ALNS", kilometros: 42, costo: 18.5, paquetesPlanificados: 9,
  sinAsignar: { 31: 4, 32: 2 },
  rutas: [
    { codigoUnidad: "TA01", tipoUnidad: "AUTO", kilometros: 30, costo: 12, paradas: [
      parada("ABASTECIMIENTO", { idAlmacen: 1 }),
      parada("ENTREGA", { idPedido: 7, cantidad: 5 }),
      parada("ENTREGA", { idPedido: 7, cantidad: 1 }),
      parada("ALIMENTACION"),
    ] },
    { codigoUnidad: "TM02", tipoUnidad: "MOTO", kilometros: 12, costo: 6.5, paradas: [parada("ENTREGA", { idPedido: 8, cantidad: 3 })] },
    { codigoUnidad: "TB03", tipoUnidad: "BICICLETA", kilometros: 0, costo: 0, paradas: [] },
  ],
};

test("totales del plan: solo rutas con paradas, entregas y lo que quedó sin asignar", () => {
  assert.deepEqual(r.planTotals(plan), { routes: 2, deliveries: 3, orders: 2, unassignedOrders: 2, unassignedPackages: 6 });
});

test("hora y paradas se leen sin depender de la zona horaria", () => {
  assert.equal(r.planStamp("2026-09-02T10:30:00"), "02/09 10:30");
  assert.equal(r.planStamp(""), "—");
  assert.equal(r.stopLabel(parada("ENTREGA", { idPedido: 7, cantidad: 5 })), "Entrega del pedido 7 · 5 paq.");
  assert.equal(r.stopLabel(parada("ABASTECIMIENTO", { idAlmacen: 2 })), "Carga en el almacén 2");
  assert.equal(r.stopLabel(parada("ABASTECIMIENTO", { idAlmacen: 0 }), { 0: "Almacen Central" }), "Carga en Almacen Central");
  assert.equal(r.stopLabel(parada("ALIMENTACION")), "Pausa de alimentación");
});

test("el texto del reporte lista cada ruta con sus paradas y avisa si no hubo plan", () => {
  const lines = r.planReportLines({ id: "sim-001", escenario: "SIMULACION_5D", estado: "CULMINADA", terminado: true, fechaHora: "", plan, metricas: {} });
  assert.equal(lines[0], "ÚLTIMA PLANIFICACIÓN ESTABLE");
  assert.ok(lines.some((l) => l.includes("02/09 10:30 con ALNS")));
  assert.ok(lines.some((l) => l.startsWith("Auto TA01 · 30 km")));
  assert.ok(lines.some((l) => l.includes("Entrega del pedido 8 · 3 paq.")));
  assert.ok(!lines.some((l) => l.includes("TB03")), "la unidad sin paradas no es una ruta");
  const vacio = r.planReportLines({ id: "op-1", escenario: "OPERACION_DIARIA", estado: "DETENIDA", terminado: true, fechaHora: "", plan: null, metricas: {} });
  assert.match(vacio.at(-1), /Sin planificación/);
});
