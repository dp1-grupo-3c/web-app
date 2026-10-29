import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const pb = load("src/lib/data/playback.ts");
const cfg = { target: 4, fillTimeoutMs: 6000, catchUpRate: 3, gain: 0.5, shrinkMin: 0.75, stretchMax: 1.5, rateWindow: 16, fallbackMsPerMinute: 250, burstGapMs: 50 };
const f = (m, ms = m * 250) => ({ minutoSimulado: m, milisegundosReales: ms });
const feed = (s, frames) => frames.reduce((acc, x) => pb.receive(acc, x, cfg), s);
const minutes = (s) => s.queue.map((x) => x.minutoSimulado);

test("ordena, descarta duplicados y fotos anteriores a la mostrada", () => {
  let s = pb.start("r1", 0, cfg);
  s = feed(s, [f(5), f(15), f(10), f(15), f(10), f(20)]);
  assert.equal(s.played.minutoSimulado, 5); // la primera se muestra quieta mientras se llena
  assert.deepEqual(minutes(s), [10, 15, 20]);
  const same = pb.receive(s, f(5), cfg);
  assert.equal(same, s);
  assert.equal(pb.receive(s, f(3), cfg), s);
});

test("el llenado termina al alcanzar N o al vencer el tiempo máximo", () => {
  let s = feed(pb.start("r1", 0, cfg), [f(0), f(5), f(10)]);
  assert.equal(pb.advance(s, 1000, cfg).phase, "filling");
  assert.equal(pb.advance(feed(s, [f(15), f(20)]), 1000, cfg).phase, "playing");
  // Pocas fotos: no se queda bloqueado.
  const timedOut = pb.advance(s, 6000, cfg);
  assert.equal(timedOut.phase, "playing");
  // Sin ninguna foto también se cierra el llenado.
  assert.equal(pb.advance(pb.start("r2", 0, cfg), 6000, cfg).phase, "playing");
});

test("reproduce a ritmo uniforme aunque las fotos lleguen en ráfagas", () => {
  // Ráfagas: 3 fotos con el mismo milisegundosReales cada 4500 ms (300 ms/min).
  const frames = [];
  for (let i = 0; i < 12; i++) frames.push(f(i * 5, Math.floor(i / 3) * 4500));
  let s = feed(pb.start("r1", 0, cfg), frames);
  assert.ok(Math.abs(pb.msPerMinute(s, cfg) - 300) < 1);
  const durations = [];
  let now = 0;
  for (let i = 0; i < 6; i++) {
    s = pb.advance(s, now, cfg);
    durations.push(Math.round(s.durationMs));
    now = s.nextAt;
  }
  // Con la cola por encima del objetivo acorta (×0.75) y luego vuelve a ×1: sin pausas ni ceros.
  assert.ok(durations.slice(1).every((d) => d >= 1125 && d <= 1500), durations.join(","));
});

test("sin fotos se mantiene la última y luego se reanuda sin reproducir de golpe", () => {
  let s = feed(pb.start("r1", 0, cfg), [f(0), f(5), f(10), f(15), f(20)]);
  let now = 0;
  while (s.queue.length) { s = pb.advance(s, now, cfg); now = s.nextAt; }
  const held = pb.advance(s, now + 10_000, cfg);
  assert.equal(held.played.minutoSimulado, 20);
  s = feed(held, [f(25), f(30)]);
  s = pb.advance(s, now + 10_000, cfg);
  assert.equal(s.played.minutoSimulado, 25);
  assert.equal(pb.advance(s, now + 10_001, cfg).played.minutoSimulado, 25); // la 30 espera su turno
});

test("el alcance acelera hasta el minuto del cambio y luego vuelve al ritmo normal", () => {
  let s = feed(pb.start("r1", 0, cfg), [0, 5, 10, 15, 20, 25, 30].map((m) => f(m)));
  s = pb.advance(s, 0, cfg);
  const normal = s.durationMs;
  s = pb.requestCatchUp(s, 15);
  s = pb.advance(s, s.nextAt, cfg);
  assert.equal(s.played.minutoSimulado, 10);
  assert.ok(s.durationMs < normal / 2);
  s = pb.advance(s, s.nextAt, cfg);
  assert.equal(s.played.minutoSimulado, 15);
  s = pb.advance(s, s.nextAt, cfg);
  assert.equal(s.catchUpTo, null);
  assert.ok(s.durationMs > normal * 0.7);
});

test("una corrida nueva vacía la cola; una terminada se vacía rápido", () => {
  let s = feed(pb.start("r1", 0, cfg), [f(0), f(5), f(10)]);
  const fresh = pb.start("r2", 100, cfg);
  assert.equal(fresh.played, null);
  assert.deepEqual(fresh.queue, []);
  s = pb.advance(pb.markEnded(s), 0, cfg);
  assert.equal(s.phase, "playing");
  assert.ok(s.durationMs <= (5 * 250) / 3 + 1);
});

test("el desfase informado es estable: N fotos por su duración", () => {
  let s = feed(pb.start("r1", 0, cfg), [0, 5, 10, 15, 20].map((m) => f(m)));
  assert.equal(pb.expectedLagMs(s, cfg), 0); // aún llenando
  s = pb.advance(s, 0, cfg);
  assert.equal(pb.expectedLagMs(s, cfg), 4 * 5 * 250);
  while (s.queue.length) s = pb.advance(s, s.nextAt, cfg);
  assert.equal(pb.expectedLagMs(s, cfg), 4 * 5 * 250); // no cae a 0 con la cola vacía
});
