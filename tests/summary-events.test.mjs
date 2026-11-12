import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const adapters = load("src/lib/data/adapters.ts");
const report = load("src/lib/report.ts");

const corrida = { tipo: "SIMULACION_5D", primerDia: "2026-11-12" };
const resultado = {
  estado: "COLAPSADA", minutoFinal: 4765, milisegundosReales: 1_220_000, pedidoDelPrimerIncumplimiento: 2816,
  metricas: {
    pedidosEntregados: 618, pedidosRegistrados: 619, pedidosIncumplidos: 1, costoAcumulado: 70769,
    kilometrosPorTipo: { AUTO: 5476, MOTO: 3012, BICICLETA: 2963 }, minutosEntregaPorPlazo: {}, entregasPorPlazo: {},
  },
};
const eventos = [
  { fecha: "2026-11-14T22:30:00", tono: "AMBAR", mensaje: "La planificación con ALNS dejó 1 pedido sin asignar" },
  { fecha: "2026-11-15T07:25:00", tono: "ROJO", mensaje: "El pedido 2816 venció su plazo con 8 paquetes sin entregar" },
];

test("la bitácora del backend llega al resumen con el día contado desde el inicio", () => {
  const s = adapters.buildSummary(corrida, resultado, {}, undefined, eventos);
  assert.deepEqual(s.events, [
    { tone: "warn", message: eventos[0].mensaje, at: { day: 3, time: "22:30" } },
    { tone: "crit", message: eventos[1].mensaje, at: { day: 4, time: "07:25" } },
  ]);
});

test("el reporte .txt lista los eventos bajo su sección", () => {
  const s = adapters.buildSummary(corrida, resultado, {}, undefined, eventos);
  const bandas = { low: 25, high: 75 };
  const texto = report.buildReportText(s, {
    vehicleOccupancy: { auto: bandas, moto: bandas, bicicleta: bandas }, warehouseFill: bandas,
  }, new Date(2026, 10, 12, 11, 46));
  const lineas = texto.split("\r\n");
  const inicio = lineas.indexOf("EVENTOS DE LA SIMULACIÓN");
  assert.ok(inicio >= 0);
  assert.match(lineas[inicio + 2], /^Día 3 · 22:30\s+\[ÁMBAR\]\s+La planificación con ALNS dejó 1 pedido sin asignar$/);
  assert.match(lineas[inicio + 3], /^Día 4 · 07:25\s+\[ROJO\]\s+El pedido 2816 venció su plazo/);
});

test("sin bitácora el resumen sigue funcionando con la lista vacía", () => {
  assert.deepEqual(adapters.buildSummary(corrida, resultado, {}).events, []);
});
