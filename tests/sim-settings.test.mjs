import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const s = load("src/lib/sim-settings.ts");

test("valores por defecto: averías 2 h / 4 h / 2 días, 00:00 y 25/75 por tipo", () => {
  const d = s.defaultSimSettings();
  assert.deepEqual(d.breakdownDurations, { T1: 2, T2: 4, T3: 2 });
  assert.equal(d.startTime, "00:00");
  for (const k of ["auto", "moto", "bicicleta"]) assert.deepEqual(d.vehicleOccupancy[k], { low: 25, high: 75 });
  assert.deepEqual(s.validateSimSettings(d), {});
  d.vehicleOccupancy.auto.low = 99;
  assert.equal(s.defaultSimSettings().vehicleOccupancy.auto.low, 25, "cada llamada devuelve una copia");
});

test("hora de inicio HH:MM", () => {
  assert.equal(s.parseTimeOfDay("00:00"), 0);
  assert.equal(s.parseTimeOfDay("7:05"), 425);
  assert.equal(s.parseTimeOfDay("23:59"), 1439);
  assert.equal(s.parseTimeOfDay("24:00"), null);
  assert.equal(s.parseTimeOfDay("12:60"), null);
  assert.equal(s.timeOfDay(""), null);
  assert.match(s.timeOfDay("8h"), /HH:MM/);
  assert.equal(s.formatTimeOfDay(425), "07:05");
});

test("umbrales coherentes y duraciones enteras en rango", () => {
  assert.equal(s.validateBands({ low: 25, high: 75 }), null);
  assert.match(s.validateBands({ low: 75, high: 75 }).message, /menor/);
  assert.deepEqual(s.validateBands({ low: -1, high: 101 }).keys, ["low", "high"]);
  assert.equal(s.validateBands({ low: 2.5, high: 50 }).keys[0], "low");
  assert.equal(s.breakdownDuration("T1", "2"), null);
  assert.match(s.breakdownDuration("T1", "0"), /entre 1 y 72/);
  assert.match(s.breakdownDuration("T3", "1.5"), /entero/);
  assert.match(s.breakdownDuration("T3", "31"), /entre 1 y 30/);
  assert.equal(s.breakdownMinutes("T2", 4), 240);
  assert.equal(s.breakdownMinutes("T3", 2), 2880);
  const bad = s.defaultSimSettings();
  bad.startTime = "99:99";
  bad.warehouseFill = { low: 60, high: 40 };
  assert.deepEqual(Object.keys(s.validateSimSettings(bad)).sort(), ["startTime", "warehouseFill"]);
});
