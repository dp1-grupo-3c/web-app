import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Mismo cargador que actions.test.mjs: transpila los módulos reales con TypeScript.
function load(entry) {
  const cache = new Map();
  function req(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    });
    const requireLocal = (name) => req(
      (name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name)) + ".ts",
    );
    new Function("require", "exports", outputText)(requireLocal, exports);
    return exports;
  }
  return req(resolve(root, entry));
}

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
