import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Ejecuta los módulos reales con un cliente HTTP sustituible y un store nuevo
// por prueba. Usa TypeScript, ya instalado, sin otro framework de pruebas.
function modules() {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    });
    const requireLocal = (name) => load(
      (name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name)) + ".ts",
    );
    new Function("require", "exports", outputText)(requireLocal, exports);
    return exports;
  }
  const api = load(resolve(root, "src/lib/backend/api.ts"));
  const store = load(resolve(root, "src/lib/data/store.ts"));
  const actions = load(resolve(root, "src/lib/data/actions.ts"));
  return { api, store, actions };
}

const input = {
  startDate: "2026-09-01",
  trafficLight: { redTo: 250, amberTo: 500, amberFrom: 250, greenFrom: 500 },
};

function fakeApi(api) {
  const calls = { start: 0, cancel: 0, parameters: 0 };
  api.cambiarSemaforo = async () => { calls.parameters++; return {}; };
  api.cancelarCorrida = async () => { calls.cancel++; return {}; };
  api.arrancarCorrida = async () => {
    calls.start++;
    return { id: "corrida-compartida", estado: "EN_CURSO", tipo: "SIMULACION_5D" };
  };
  return calls;
}

test("iniciar respeta la corrida conocida sin cancelarla ni cambiar sus parámetros", async () => {
  const { api, store } = modules();
  const calls = fakeApi(api);
  assert.equal((await store.arrancar("5d", input)).ok, true);
  assert.equal((await store.arrancar("colapso", input)).ok, false);
  assert.deepEqual(calls, { start: 1, cancel: 0, parameters: 1 });
  assert.equal(store.getSnapshot().estado.idActual, "corrida-compartida");
});

test("un 409 de otra sesión se informa sin cancelar ni reintentar el arranque", async () => {
  const { api, store } = modules();
  const calls = fakeApi(api);
  api.arrancarCorrida = async () => {
    calls.start++;
    throw new api.ErrorServicio(409, "Ya hay una simulación en curso", "ESTADO");
  };
  api.obtenerSalud = async () => ({ corridaActiva: "corrida-ajena" });
  const result = await store.arrancar("5d", input);
  assert.equal(result.ok, false);
  assert.equal(result.message, "Ya hay una simulación en curso");
  assert.equal(calls.start, 1);
  assert.equal(calls.cancel, 0);
});

test("la cancelación explícita sigue disponible", async () => {
  const { api, store } = modules();
  const calls = fakeApi(api);
  await store.arrancar("5d", input);
  api.cancelarCorrida = async (id) => {
    calls.cancel++;
    return { id, estado: "CANCELADA", tipo: "SIMULACION_5D" };
  };
  assert.equal((await store.cancelar()).ok, true);
  assert.equal(calls.cancel, 1);
  assert.equal(store.getSnapshot().estado.corrida.estado, "CANCELADA");
  assert.equal((await store.arrancar("5d", input)).ok, true);
});

test("un pedido sin servicio de registro nunca se anuncia como guardado", async () => {
  const { actions } = modules();
  const result = await actions.registerOrder({
    clientCode: "C1", clientName: "Cliente", clientPhone: "123456789",
    destination: { x: 1, y: 2 }, packages: 3, priority: "N",
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /no se ha guardado/);
});

test("día a día solicita una sola jornada sin averías aleatorias ni cambios globales", async () => {
  const { api, store } = modules();
  const calls = fakeApi(api);
  let request;
  api.arrancarCorrida = async (body) => {
    request = body;
    calls.start++;
    return { id: "operacion", estado: "EN_CURSO", tipo: "DIA_A_DIA" };
  };
  assert.equal((await store.arrancarDia("2026-09-30")).ok, true);
  assert.deepEqual(request, {
    tipo: "DIA_A_DIA", primerDia: "2026-09-30", ultimoDia: "2026-09-30",
    generarAverias: false, minutosEntreFotografias: 1,
  });
  assert.equal((await store.arrancar("5d", input)).ok, false);
  assert.equal((await store.arrancarDia("2026-10-01")).ok, false);
  assert.deepEqual(calls, { start: 1, cancel: 0, parameters: 0 });
});

test("un control diario obsoleto no cancela otra corrida", async () => {
  const { api, store } = modules();
  const calls = fakeApi(api);
  await store.arrancar("5d", input);
  assert.equal((await store.cancelarDia("operacion-anterior")).ok, false);
  assert.equal((await store.cancelarDia("corrida-compartida")).ok, false);
  assert.equal(calls.cancel, 0);
});

test("se adopta la corrida activa que reporta el servidor aunque la haya iniciado otra sesión", async () => {
  const { api, store } = modules();
  api.obtenerSalud = async () => ({ corridaActiva: "corrida-ajena" });
  await store.sincronizarActiva();
  assert.equal(store.getSnapshot().estado.idActual, "corrida-ajena");
});

test("una corrida terminada y descartada no se vuelve a adoptar", async () => {
  const { api, store } = modules();
  fakeApi(api);
  await store.arrancar("5d", input);
  store.olvidarCorrida();
  api.obtenerSalud = async () => ({ corridaActiva: "corrida-compartida" });
  await store.sincronizarActiva();
  assert.equal(store.getSnapshot().estado.idActual, null);
  api.obtenerSalud = async () => ({ corridaActiva: "corrida-nueva" });
  await store.sincronizarActiva();
  assert.equal(store.getSnapshot().estado.idActual, "corrida-nueva");
});

test("detener no cancela una corrida distinta a la que se confirmó", async () => {
  const { api, store } = modules();
  const calls = fakeApi(api);
  await store.arrancar("5d", input);
  assert.equal((await store.cancelar("otra-corrida")).ok, false);
  assert.equal(calls.cancel, 0);
  assert.equal((await store.cancelar("corrida-compartida")).ok, true);
  assert.equal(calls.cancel, 1);
});
