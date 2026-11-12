import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const { idsMatching } = load("src/lib/list-tools.ts");

const rows = [{ id: "TA02", tone: "ok" }, { id: "TA01", tone: "crit" }, { id: "TM01", tone: "warn" }];
const rojos = (r) => r.tone === "crit";

test("sin chips activos el mapa dibuja todo", () => {
  assert.equal(idsMatching(rows, false, rojos), null);
});

test("con chips activos el mapa dibuja solo los que cumplen el filtro, en orden estable", () => {
  assert.deepEqual(idsMatching(rows, true, (r) => r.tone !== "warn"), ["TA01", "TA02"]);
  assert.deepEqual(idsMatching(rows, true, () => false), []);
});

test("el vehículo fijado se dibuja aunque no cumpla el filtro", () => {
  assert.deepEqual(idsMatching(rows, true, rojos, "TM01"), ["TA01", "TM01"]);
});
