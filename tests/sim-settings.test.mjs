import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const s = load("src/lib/sim-settings.ts");

test("valores por defecto: averías 2 h / 4 h y 1 turno / 4 h y 2 días, 00:00 y 25/75 por tipo", () => {
  const d = s.defaultSimSettings();
  assert.deepEqual(d.breakdownDurations, { T1: 2, T2: 4, T2Shifts: 1, T3OnSite: 4, T3: 2 });
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
  assert.match(s.breakdownDuration("T1", "0"), /entre 1 y 24/);
  assert.match(s.breakdownDuration("T2", "9"), /entre 1 y 8/);
  assert.match(s.breakdownDuration("T2Shifts", "10"), /entre 1 y 9/);
  assert.match(s.breakdownDuration("T3", "1.5"), /entero/);
  assert.match(s.breakdownDuration("T3", "15"), /entre 1 y 14/);
  const bad = s.defaultSimSettings();
  bad.startTime = "99:99";
  bad.warehouseFill = { low: 60, high: 40 };
  assert.deepEqual(Object.keys(s.validateSimSettings(bad)).sort(), ["startTime", "warehouseFill"]);
});

const FICHAS = [
  { tipo: 1, atributos: { minutosEnElLugar: 120, turnosHastaReincorporacion: 1, diasMantenimiento: 2 } },
  { tipo: 2, atributos: { minutosEnElLugar: 240, turnosHastaReincorporacion: 1, diasMantenimiento: 2 } },
  { tipo: 3, atributos: { minutosEnElLugar: 240, turnosHastaReincorporacion: 1, diasMantenimiento: 2 } },
];

test("averías al servidor: cada tipo lleva solo lo que usa su regla, con las horas en minutos", () => {
  assert.deepEqual(s.breakdownRequests({ T1: 3, T2: 5, T2Shifts: 2, T3OnSite: 6, T3: 4 }), [
    { tipo: 1, minutosEnElLugar: 180 },
    { tipo: 2, minutosEnElLugar: 300, turnosHastaReincorporacion: 2 },
    { tipo: 3, minutosEnElLugar: 360, diasMantenimiento: 4 },
  ]);
});

test("averías vigentes: se leen en las unidades del formulario y solo se reescribe lo que cambia", () => {
  const vigentes = s.breakdownDurationsFrom(FICHAS);
  assert.deepEqual(vigentes, { T1: 2, T2: 4, T2Shifts: 1, T3OnSite: 4, T3: 2 });
  assert.equal(s.breakdownDurationsFrom(undefined), null);
  assert.deepEqual(s.changedBreakdownRequests(vigentes, FICHAS), []);
  assert.deepEqual(s.changedBreakdownRequests({ ...vigentes, T3: 3 }, FICHAS), [{ tipo: 3, minutosEnElLugar: 240, diasMantenimiento: 3 }]);
  assert.equal(s.changedBreakdownRequests(vigentes, undefined).length, 3);
});

test("semáforo de un vehículo: vacío, verde, ámbar, rojo y sin dato", () => {
  const occ = load("src/lib/occupancy.ts");
  const bands = { low: 25, high: 75 };
  assert.equal(occ.vehicleTone({ load: 0, capacity: 24 }, bands), "empty");
  assert.equal(occ.vehicleTone({ load: 5, capacity: 24 }, bands), "ok");
  assert.equal(occ.vehicleTone({ load: 6, capacity: 24 }, bands), "warn");
  assert.equal(occ.vehicleTone({ load: 18, capacity: 24 }, bands), "warn");
  assert.equal(occ.vehicleTone({ load: 19, capacity: 24 }, bands), "crit");
  assert.equal(occ.vehicleTone({ load: 3, capacity: 0 }, bands), null);
});

test("inicio de la corrida: fecha y hora al minuto, sin segundos", () => {
  const d = s.defaultSimSettings();
  assert.deepEqual(s.runStartFields(d, "2026-09-02", { startTime: false }), {});
  d.startTime = "";
  assert.deepEqual(s.runStartFields(d, "2026-09-02", { startTime: true }), { inicio: "2026-09-02T00:00" });
  d.startTime = "7:05";
  assert.deepEqual(s.runStartFields(d, "2026-09-02", { startTime: true }), { inicio: "2026-09-02T07:05" });
});
