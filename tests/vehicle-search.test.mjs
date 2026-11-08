import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const s = load("src/lib/vehicle-search.ts");

const llegando = { remainingKm: 6, etaMinutes: 12, fromOriginKm: 9, fromOriginMinutes: 20, phase: "llegando" };
const saliendo = { remainingKm: 14, etaMinutes: null, fromOriginKm: 0, fromOriginMinutes: null, phase: "saliendo" };
const quieto = { remainingKm: 0, etaMinutes: null, fromOriginKm: null, fromOriginMinutes: null, phase: null };

test("distancia al destino y desde el origen, en km y minutos", () => {
  assert.equal(s.rowDistance(llegando, "destino", "km"), 6);
  assert.equal(s.rowDistance(llegando, "destino", "min"), 12);
  assert.equal(s.rowDistance(llegando, "origen", "km"), 9);
  assert.equal(s.rowDistance(llegando, "origen", "min"), 20);
  // Detenido en una parada con ruta pendiente: hay km al destino aunque no haya hora.
  assert.equal(s.rowDistance(saliendo, "destino", "km"), 14);
  assert.equal(s.rowDistance(quieto, "destino", "km"), null, "sin ruta no hay destino");
});

test("filtra por distancia máxima y distingue llegada de salida", () => {
  const filas = [llegando, saliendo, quieto];
  const q = (patch) => filas.filter((r) => s.matchesDistance(r, { ...s.NO_DISTANCE_QUERY, ...patch }));
  assert.deepEqual(q({}), filas);
  assert.deepEqual(q({ max: 10 }), [llegando]);
  assert.deepEqual(q({ max: 20 }), [llegando, saliendo]);
  assert.deepEqual(q({ phase: "saliendo" }), [saliendo]);
  assert.deepEqual(q({ phase: "llegando", max: 5 }), []);
  assert.deepEqual(q({ ref: "origen", max: 0 }), [saliendo]);
  assert.deepEqual(q({ ref: "origen", unit: "min", max: 30 }), [llegando]);
});

test("el campo hasta acepta vacío, decimales con coma y rechaza lo inválido", () => {
  assert.equal(s.parseMaxDistance(""), null);
  assert.equal(s.parseMaxDistance(" 12 "), 12);
  assert.equal(s.parseMaxDistance("2,5"), 2.5);
  assert.equal(s.parseMaxDistance("-1"), undefined);
  assert.equal(s.parseMaxDistance("diez"), undefined);
});
