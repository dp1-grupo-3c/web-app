import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const d = load("src/lib/warehouse-departures.ts");

const envio = (idPedido, codigoUnidad, cantidad, fechaHoraSalida) => ({
  idPedido, envio: { codigoUnidad, cantidad, fechaHoraSalida, fechaHoraLlegada: null },
});
const AHORA = "2026-11-14T10:00:00";

test("solo las salidas dentro de las próximas X h desde la hora mostrada, de la más próxima a la más lejana", () => {
  const rows = d.departuresFrom({
    porSalir: [
      envio(31, "TA02", 6, "2026-11-14T13:30:00"),
      envio(30, "TM01", 4, "2026-11-14T10:20:00"),
      envio(32, "TA03", 9, "2026-11-14T14:01:00"), // fuera de las 4 h
      envio(33, "TB01", 2, null),                   // sin hora de salida conocida
    ],
    // El servidor va por delante: ya salió para él, pero no a la hora mostrada.
    enTransito: [envio(29, "TA01", 5, "2026-11-14T10:05:00"), envio(28, "TA04", 3, "2026-11-14T09:50:00")],
  }, AHORA, 4);
  assert.deepEqual(rows.map((r) => [r.orderId, r.plate, r.packages, r.departsAt, r.minutesAhead]), [
    ["29", "TA01", 5, "10:05", 5],
    ["30", "TM01", 4, "10:20", 20],
    ["31", "TA02", 6, "13:30", 210],
  ]);
});

test("una salida de otro día muestra la fecha, y los totales cuentan pedidos distintos", () => {
  const rows = d.departuresFrom({
    porSalir: [envio(40, "TA01", 8, "2026-11-15T01:00:00"), envio(40, "TM02", 2, "2026-11-15T02:00:00")],
    enTransito: [],
  }, "2026-11-14T22:00:00", 6);
  assert.deepEqual(rows.map((r) => r.departsAt), ["15/11 01:00", "15/11 02:00"]);
  assert.deepEqual(d.departureTotals(rows), { orders: 1, packages: 10 });
});

test("sin salidas en la ventana la lista queda vacía", () => {
  assert.deepEqual(d.departuresFrom({ porSalir: [], enTransito: [] }, AHORA, 4), []);
  assert.deepEqual(d.departureTotals([]), { orders: 0, packages: 0 });
});
