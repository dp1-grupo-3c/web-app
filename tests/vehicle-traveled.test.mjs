import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const adapters = load("src/lib/data/adapters.ts");
const sel = load("src/lib/data/selectors.ts");
const lt = load("src/lib/list-tools.ts");

const BANDS = { low: 25, high: 75 };
const bands = { auto: BANDS, moto: BANDS, bicicleta: BANDS };
const unidad = (codigo, extra = {}) => ({
  codigo, tipo: "AUTO", estado: "EN_RUTA", x: 1, y: 0, cargaABordo: 4, capacidad: 24, color: "VERDE",
  // Recién replanificada: el itinerario vigente aún no tiene camino recorrido.
  caminoRecorrido: [], caminoPendiente: [1, 0, 2, 0], destinoX: 2, destinoY: 0, minutosHastaDestino: 2,
  pedidosABordo: [], tipoAveria: 0, ...extra,
});
const rows = (unidades) => sel.selectVehicleRows(unidades.map(adapters.vistaUnidadToVehicle), { vehicles: {}, orders: {}, deliveries: [] }, 10, bands, []);

test("Recorrido es el acumulado de la corrida que envía el backend, no el camino del itinerario vigente", () => {
  const [r] = rows([unidad("TA01", { kilometrosRecorridos: 57 })]);
  assert.equal(r.traveledKm, 57);
});

test("sin el dato del backend se usa el camino recorrido del itinerario", () => {
  const [r] = rows([unidad("TA01", { caminoRecorrido: [0, 0, 1, 0] })]);
  assert.equal(r.traveledKm, 1);
});

test("el orden por Recorrido usa el acumulado", () => {
  const r = rows([unidad("TA01", { kilometrosRecorridos: 12 }), unidad("TA02", { kilometrosRecorridos: 80 }), unidad("TA03", { kilometrosRecorridos: 35 })]);
  assert.deepEqual(lt.sortBy(r, (x) => x.traveledKm, "desc").map((x) => x.id), ["TA02", "TA03", "TA01"]);
});
