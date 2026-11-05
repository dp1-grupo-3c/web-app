import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const o = load("src/lib/occupancy.ts");
const BANDS = { low: 25, high: 75 };

test("semáforo de ocupación: verde < 25 %, ámbar 25–75 %, rojo > 75 %", () => {
  assert.equal(o.percentTone(0, BANDS), "ok");
  assert.equal(o.percentTone(24.9, BANDS), "ok");
  assert.equal(o.percentTone(25, BANDS), "warn");
  assert.equal(o.percentTone(75, BANDS), "warn");
  assert.equal(o.percentTone(75.1, BANDS), "crit");
  assert.equal(o.percentTone(130, BANDS), "crit");
  assert.equal(o.percentTone(NaN, BANDS), null);
});

test("semáforo de llenado (más stock = verde), mismos bordes que el de paquetes", () => {
  const W = { low: 25, high: 50 };
  assert.equal(o.percentTone(10, W, "highIsGreen"), "crit");
  assert.equal(o.percentTone(25, W, "highIsGreen"), "crit");
  assert.equal(o.percentTone(26, W, "highIsGreen"), "warn");
  assert.equal(o.percentTone(50, W, "highIsGreen"), "ok");
  assert.equal(o.percentTone(100, W, "highIsGreen"), "ok");
});

test("ocupación de vehículo y almacén, sin dividir entre cero", () => {
  assert.equal(o.vehicleOccupancy({ load: 30, capacity: 120 }), 25);
  assert.ok(Number.isNaN(o.vehicleOccupancy({ load: 3, capacity: 0 })));
  assert.equal(o.warehouseOccupancy({ kind: "secundario", stock: 80, capacity: 160 }), 50);
  assert.ok(Number.isNaN(o.warehouseOccupancy({ kind: "principal", stock: 80, capacity: 160 })));
  assert.ok(Number.isNaN(o.warehouseOccupancy({ kind: "secundario" })));
  assert.equal(o.aggregateOccupancy([{ used: 10, capacity: 20 }, { used: 30, capacity: 60 }, { used: 5 }]), 50);
  assert.ok(Number.isNaN(o.aggregateOccupancy([])));
});

test("distancias por calles y rangos 0–10, 10–20, 20–40, 40+", () => {
  assert.equal(o.manhattan({ x: 0, y: 0 }, { x: 3, y: 4 }), 7);
  assert.equal(o.pathKm([{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 4, y: 5 }]), 9);
  assert.equal(o.pathKm(undefined), 0);
  assert.equal(o.distanceBand(0), "0-10");
  assert.equal(o.distanceBand(9.9), "0-10");
  assert.equal(o.distanceBand(10), "10-20");
  assert.equal(o.distanceBand(20), "20-40");
  assert.equal(o.distanceBand(39), "20-40");
  assert.equal(o.distanceBand(40), "40+");
  assert.equal(o.distanceBand(500), "40+");
  assert.equal(o.distanceBand(-1), null);
  assert.equal(o.distanceBand(undefined), null);
});
