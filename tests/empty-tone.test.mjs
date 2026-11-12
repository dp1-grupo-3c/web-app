import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const sel = load("src/lib/data/selectors.ts");
const occ = load("src/lib/occupancy.ts");

const BANDS = { low: 25, high: 75 };
const bands = { auto: BANDS, moto: BANDS, bicicleta: BANDS };
const NO_TRIPS = { vehicles: {}, orders: {}, deliveries: [] };
const vehicle = (id, load, capacity = 24) => ({ id, plate: id, kind: "auto", status: "en_ruta", position: { x: 0, y: 0 }, load, capacity, orders: [] });
const count = (rows) => ({
  ok: rows.filter((r) => r.tone === "ok").length,
  warn: rows.filter((r) => r.tone === "warn").length,
  crit: rows.filter((r) => r.tone === "crit").length,
  empty: rows.filter((r) => r.empty).length,
});

test("un vehículo al 0 % es Vacío, no Verde, y los cuatro chips suman el total", () => {
  const rows = sel.selectVehicleRows([vehicle("V0", 0), vehicle("V1", 2), vehicle("V2", 12), vehicle("V3", 22), vehicle("V4", 0)], NO_TRIPS, 0, bands);
  assert.deepEqual(rows.map((r) => [r.id, r.tone, r.empty]), [
    ["V0", null, true], ["V1", "ok", false], ["V2", "warn", false], ["V3", "crit", false], ["V4", null, true],
  ]);
  const c = count(rows);
  assert.deepEqual(c, { ok: 1, warn: 1, crit: 1, empty: 2 });
  assert.equal(c.ok + c.warn + c.crit + c.empty, rows.length);
  // El mismo criterio que pinta el marcador gris del mapa.
  assert.equal(occ.vehicleTone(vehicle("V0", 0), BANDS), "empty");
});

test("un almacén intermedio sin stock es Vacío, no Rojo; el central no tiene semáforo", () => {
  const warehouses = [
    { id: "1", name: "Central", kind: "principal", position: { x: 0, y: 0 } },
    { id: "2", name: "Norte", kind: "secundario", position: { x: 1, y: 0 }, stock: 0, capacity: 1000 },
    { id: "3", name: "Este", kind: "secundario", position: { x: 2, y: 0 }, stock: 100, capacity: 1000 },
    { id: "4", name: "Sur", kind: "secundario", position: { x: 3, y: 0 }, stock: 800, capacity: 1000 },
  ];
  const rows = sel.selectWarehouseRows(warehouses, [], NO_TRIPS, { low: 25, high: 50 });
  assert.deepEqual(rows.map((r) => [r.id, r.tone, r.empty]), [["1", null, false], ["2", null, true], ["3", "crit", false], ["4", "ok", false]]);
  const c = count(rows);
  assert.equal(c.ok + c.warn + c.crit + c.empty, rows.filter((r) => r.kind !== "principal").length);
});
