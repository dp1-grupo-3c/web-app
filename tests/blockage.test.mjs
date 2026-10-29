import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const { endingWindow, endingIn } = load("src/lib/blockage.ts");

test("ventana de parpadeo: 25 % de la duración, entre 10 y 30 min simulados", () => {
  assert.equal(endingWindow(127), 30); // mediana del dataset → tope
  assert.equal(endingWindow(80), 20); // 25 %
  assert.equal(endingWindow(38), 10); // piso
  assert.equal(endingWindow(6), 6); // nunca más que el bloqueo
  assert.equal(endingWindow(240), 30);
});

test("un bloqueo parpadea solo en su tramo final y según el minuto mostrado", () => {
  const b = { id: "0", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, startMinute: 100, endMinute: 220 };
  assert.equal(endingIn(b, 150), null);
  assert.equal(endingIn(b, 190), 30);
  assert.equal(endingIn(b, 219), 1);
  assert.equal(endingIn(b, 220), null);
  assert.equal(endingIn(b, undefined), null);
  assert.equal(endingIn({ ...b, endMinute: undefined }, 200), null);
});
