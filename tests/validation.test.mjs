import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const v = load("src/lib/validation.ts");
const tl = load("src/lib/traffic-light.ts");
const RANGE = { from: "2026-01-01", to: "2028-12-31" };

test("fechas: calendario real con años bisiestos", () => {
  assert.equal(v.isoFromParts(29, 2, 2028), "2028-02-29");
  assert.equal(v.isoFromParts(29, 2, 2027), null);
  assert.equal(v.isoFromParts(30, 2, 2028), null);
  assert.equal(v.isoFromParts(31, 4, 2026), null);
  assert.equal(v.calendarDate("30/02/2026"), "Esa fecha no existe en el calendario.");
  assert.equal(v.calendarDate("12/03"), v.INCOMPLETE_DATE);
  assert.equal(v.calendarDate(""), null);
  assert.equal(v.calendarDate("29/02/2028"), null);
});

test("fechas: dentro del periodo con datos, y 5 días completos", () => {
  assert.equal(v.isoDateInRange("2026-01-01", RANGE), null);
  assert.equal(v.isoDateInRange("2028-12-31", RANGE), null);
  assert.match(v.isoDateInRange("2025-12-31", RANGE), /periodo con datos/);
  assert.match(v.isoDateInRange("2029-01-01", RANGE), /periodo con datos/);
  assert.equal(v.simulationStart("2028-12-27", 5, RANGE), null);
  assert.match(v.simulationStart("2028-12-28", 5, RANGE), /inicio hasta el 27\/12\/2028/);
  assert.equal(v.simulationStart("2028-12-31", 1, RANGE), null);
});

const MUNDO = {
  version: 1,
  mapa: { largoKm: 70, anchoKm: 50 },
  almacenes: [
    { id: 0, nombre: "Central", x: 27, y: 14, central: true, capacidad: null },
    { id: 1, nombre: "Nor-Oeste", x: 12, y: 38, central: false, capacidad: 1000 },
  ],
  ejecucionActiva: null,
};

test("mundo: el borrador va y vuelve sin cambiar los valores, y el central no lleva capacidad", () => {
  const d = v.worldDraft(MUNDO);
  assert.deepEqual(v.validateWorld(d), {});
  assert.deepEqual(v.worldRequest(d), {
    mapa: { largoKm: 70, anchoKm: 50 },
    almacenes: [{ id: 0, x: 27, y: 14 }, { id: 1, x: 12, y: 38, capacidad: 1000 }],
  });
});

test("mundo: mapa en rango, almacenes dentro del mapa, en lugares distintos y con capacidad", () => {
  const con = (cambio) => {
    const d = v.worldDraft(MUNDO);
    cambio(d);
    return v.validateWorld(d);
  };
  assert.match(con((d) => { d.width = "0"; }).width, /entre 1 y 500/);
  assert.match(con((d) => { d.height = "501"; }).height, /entre 1 y 500/);
  assert.match(con((d) => { d.width = "20"; }).warehouses[0], /^X: /);
  assert.match(con((d) => { d.height = "30"; }).warehouses[1], /^Y: /);
  assert.match(con((d) => { d.warehouses[1].capacity = "0"; }).warehouses[1], /^Capacidad: /);
  assert.match(con((d) => { d.warehouses[1].x = "27"; d.warehouses[1].y = "14"; }).warehouses[1], /otro almacén/);
});

test("nodos de un bloqueo: pares x,y con tramos rectos dentro del mapa", () => {
  const grid = { width: 70, height: 50 };
  assert.deepEqual(v.blockageNodes("12,20  13,20 13,25", grid), { nodes: [{ x: 12, y: 20 }, { x: 13, y: 20 }, { x: 13, y: 25 }], error: null });
  assert.equal(v.blockageNodes("  ", grid).error, v.REQUIRED_MESSAGE);
  assert.match(v.blockageNodes("12,20", grid).error, /al menos dos/);
  assert.match(v.blockageNodes("12;20 13,20", grid).error, /no es un nodo/);
  assert.match(v.blockageNodes("12,20 13,21", grid).error, /diagonal/);
  assert.match(v.blockageNodes("12,20 71,20", grid).error, /fuera del mapa/);
  assert.match(v.blockageNodes("1,1 1,5 1,1", grid).error, /repetido/);
});

test("números: enteros, negativos, vacíos y no numéricos", () => {
  assert.equal(v.integerInRange("10", 0, 100000), null);
  assert.equal(v.integerInRange("", 0, 10), v.REQUIRED_MESSAGE);
  assert.equal(v.integerInRange("abc", 0, 10), "Escribe solo números.");
  assert.equal(v.integerInRange("1.5", 0, 10), "Debe ser un número entero.");
  assert.equal(v.integerInRange("-1", 0, 10), "No puede ser negativo.");
  assert.match(v.integerInRange("100001", 0, 100000), /entre 0 y 100,000/);
  assert.match(v.integerInRange("0", 1, 1000), /entre 1 y 1,000/);
});

test("números: decimales con mínimo excluido y límite de decimales", () => {
  const speed = { min: 0, minExclusive: true, max: 100000, decimals: 1 };
  assert.equal(v.decimalInRange("12,5", speed), null);
  assert.equal(v.decimalInRange("0.1", speed), null);
  assert.equal(v.decimalInRange("0", speed), "Debe ser mayor que 0.");
  assert.equal(v.decimalInRange("-3", speed), "No puede ser negativo.");
  assert.equal(v.decimalInRange("12.55", speed), "Usa como máximo 1 decimal.");
  assert.match(v.decimalInRange("100000.1", speed), /como máximo 100,000/);
  assert.equal(v.decimalInRange("1e3", speed), "Escribe solo números.");
});

test("texto y teléfono", () => {
  assert.equal(v.textMax("  ", 10), v.REQUIRED_MESSAGE);
  assert.equal(v.textMax("Ana", 10), null);
  assert.match(v.textMax("x".repeat(11), 10), /como máximo 10/);
  assert.equal(v.phone("987 654 321", 7, 15), null);
  assert.match(v.phone("98a7654321", 7, 15), /solo dígitos/);
  assert.match(v.phone("12345", 7, 15), /solo dígitos/);
});

test("semáforo: límites vacíos y orden de los umbrales", () => {
  const ok = { redTo: 250, amberFrom: 250, amberTo: 500, greenFrom: 500 };
  assert.equal(tl.validateTrafficLight(ok), null);
  const empty = tl.setLimit(ok, "redTo", NaN);
  assert.ok(Number.isNaN(empty.amberFrom));
  assert.match(tl.validateTrafficLight(empty).message, /números enteros/);
  assert.match(tl.validateTrafficLight({ ...ok, redTo: 600, amberFrom: 600 }).message, /rojo/);
  assert.match(tl.validateTrafficLight({ ...ok, amberTo: 1000, greenFrom: 1000 }).message, /ámbar/);
});
