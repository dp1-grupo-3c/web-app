import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const l = load("src/lib/list-tools.ts");
const rows = [
  { id: "a", n: 3, t: "ok" },
  { id: "b", n: null, t: "warn" },
  { id: "c", n: 1, t: "crit" },
  { id: "d", n: 3, t: "ok" },
  { id: "e", n: NaN, t: null },
];

test("orden por un criterio, ascendente o descendente, estable y con vacíos al final", () => {
  assert.deepEqual(l.sortBy(rows, (r) => r.n, "asc").map((r) => r.id), ["c", "a", "d", "b", "e"]);
  assert.deepEqual(l.sortBy(rows, (r) => r.n, "desc").map((r) => r.id), ["a", "d", "c", "b", "e"]);
  assert.deepEqual(l.sortBy([{ p: "V10" }, { p: "V2" }], (r) => r.p).map((r) => r.p), ["V2", "V10"]);
  assert.equal(rows[0].id, "a", "no muta la entrada");
});

test("filtros combinados; un conjunto vacío no filtra", () => {
  const byTone = l.inSet(new Set(["ok", "crit"]), (r) => r.t);
  assert.deepEqual(l.filterBy(rows, [byTone]).map((r) => r.id), ["a", "c", "d"]);
  assert.deepEqual(l.filterBy(rows, [byTone, (r) => r.n === 3]).map((r) => r.id), ["a", "d"]);
  assert.equal(l.inSet(new Set(), (r) => r.t), null);
  assert.equal(l.filterBy(rows, [null]).length, rows.length);
  assert.deepEqual([...l.toggleIn(new Set(["ok"]), "ok")], []);
  assert.deepEqual([...l.toggleIn(new Set(["ok"]), "warn")], ["ok", "warn"]);
});
