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
  const operacion = load(resolve(root, "src/lib/data/operacion.ts"));
  const actions = load(resolve(root, "src/lib/data/actions.ts"));
  const adapters = load(resolve(root, "src/lib/data/adapters.ts"));
  const documento = load(resolve(root, "src/lib/documento.ts"));
  const clientes = load(resolve(root, "src/lib/data/clientes.ts"));
  operacion.ESPERA_COMANDO.intervaloMs = 1;
  return { api, store, operacion, actions, adapters, documento, clientes };
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

// ---- Operación diaria ----------------------------------------------------------

function vista(revision, extra = {}) {
  return {
    contextoId: "op-1", revision, estado: "EN_CURSO", zonaHoraria: "America/Lima",
    horaServidor: "2026-10-28T15:00:00Z", fechaHoraOperativa: "2026-10-28T10:00",
    configuracion: { zonaHoraria: "America/Lima", saltoMinutos: 30, algoritmo: "ALNS", semilla: 20262, presupuestoPlanificacionMs: 2000 },
    instantanea: { unidades: [], almacenes: [], bloqueosVigentes: [], metricas: {} },
    parametros: { umbralSemaforoAmbar: 250, umbralSemaforoVerde: 500 },
    pedidos: [], incidentes: [], avisos: [], calculando: false, planesDescartados: 0, error: null,
    ...extra,
  };
}

const pedido = {
  clientCode: "c123", clientName: "Ana Perez", clientPhone: "999111222", address: "Calle Uno",
  destination: { x: 28, y: 14 }, packages: 2, priority: "P2",
};

async function operacionIniciada() {
  const m = modules();
  m.api.iniciarOperacion = async () => vista(1);
  m.api.detalleOperacion = async () => vista(2);
  assert.equal((await m.actions.startOperation()).ok, true);
  return m;
}

test("sin operación iniciada no se envían comandos", async () => {
  const { api, actions } = modules();
  let llamadas = 0;
  api.altaPedidoOperacion = async () => { llamadas++; };
  const result = await actions.registerOrder(pedido);
  assert.equal(result.ok, false);
  assert.match(result.message, /No hay una operación diaria en curso/);
  assert.equal(llamadas, 0);
});

test("el alta envía el contrato operativo y espera a que el comando se aplique", async () => {
  const { api, actions } = await operacionIniciada();
  let cuerpo, ruta, consultas = 0;
  api.altaPedidoOperacion = async (id, s) => {
    ruta = id;
    cuerpo = s;
    return { comandoId: s.solicitudId, estado: "ACEPTADO", pedidoId: null, error: null };
  };
  api.comandoOperacion = async (id, comandoId) => {
    consultas++;
    return consultas < 2
      ? { comandoId, estado: "ACEPTADO", pedidoId: null, error: null }
      : { comandoId, estado: "APLICADO", pedidoId: 7, error: null };
  };
  const result = await actions.registerOrder(pedido);
  assert.deepEqual(result, { ok: true, data: { orderId: "7" } });
  assert.equal(ruta, "op-1");
  assert.equal(consultas, 2);
  const { solicitudId, ...resto } = cuerpo;
  assert.ok(solicitudId.length > 0);
  assert.deepEqual(resto, {
    codigoCliente: "c123", nombreCliente: "Ana Perez", telefonoCliente: "999111222", direccion: "Calle Uno",
    x: 28, y: 14, cantidad: 2, prioridad: "PRIORITARIO_2",
  });
});

test("un comando rechazado devuelve el motivo del servidor", async () => {
  const { api, actions } = await operacionIniciada();
  api.averiaOperacion = async (_id, s) => ({ comandoId: s.solicitudId, estado: "ACEPTADO" });
  api.comandoOperacion = async (_id, comandoId) => ({ comandoId, estado: "RECHAZADO", error: "La unidad ya esta deshabilitada" });
  const result = await actions.registerOperationBreakdown({ plate: "TA01", type: "T2" });
  assert.deepEqual(result, { ok: false, message: "La unidad ya esta deshabilitada" });
});

test("el semáforo se guarda en los parámetros de la operación, no en los globales", async () => {
  const { api, actions } = await operacionIniciada();
  let cuerpo, globales = 0;
  api.cambiarSemaforo = async () => { globales++; };
  api.parametrosOperacion = async (_id, s) => { cuerpo = s; return { comandoId: s.solicitudId, estado: "APLICADO" }; };
  const result = await actions.saveOperationTrafficLight({ redTo: 300, amberFrom: 300, amberTo: 600, greenFrom: 600 });
  assert.equal(result.ok, true);
  assert.equal(cuerpo.ambar, 300);
  assert.equal(cuerpo.verde, 600);
  assert.equal(globales, 0);
});

test("se descartan las vistas con revisión igual o anterior y se adopta otro contexto", async () => {
  const { operacion } = modules();
  operacion.aplicar(vista(5));
  operacion.aplicar(vista(4, { calculando: true }));
  operacion.aplicar(vista(5, { calculando: true }));
  assert.equal(operacion.getSnapshot().vista.calculando, false);
  operacion.aplicar(vista(6, { calculando: true }));
  assert.equal(operacion.getSnapshot().vista.revision, 6);
  // Una respuesta tardía de otro contexto no reemplaza al seguido; /actual sí.
  operacion.aplicar(vista(1, { contextoId: "op-2" }));
  assert.equal(operacion.getSnapshot().vista.contextoId, "op-1");
  operacion.aplicar(vista(1, { contextoId: "op-2" }), true);
  assert.equal(operacion.getSnapshot().vista.contextoId, "op-2");
});

test("un 404 en /actual deja la pantalla sin operación", async () => {
  const { api, operacion } = modules();
  api.operacionActual = async () => { throw new api.ErrorServicio(404, "No hay ninguna operacion registrada"); };
  await operacion.sincronizar();
  assert.equal(operacion.getSnapshot().cargado, true);
  assert.equal(operacion.getSnapshot().vista, null);
});

test("un inicio en conflicto (409) se informa sin adoptar nada", async () => {
  const { api, actions, operacion } = modules();
  api.iniciarOperacion = async () => { throw new api.ErrorServicio(409, "Hay una simulacion en curso"); };
  const result = await actions.startOperation();
  assert.deepEqual(result, { ok: false, message: "Hay una simulacion en curso" });
  assert.equal(operacion.getSnapshot().vista, null);
});

test("detener solo actúa sobre la operación confirmada", async () => {
  const { api, actions } = await operacionIniciada();
  let detenidas = 0;
  api.detenerOperacion = async (id) => { detenidas++; return vista(9, { contextoId: id, estado: "DETENIDA" }); };
  assert.equal((await actions.stopOperation("otra")).ok, false);
  assert.equal(detenidas, 0);
  assert.equal((await actions.stopOperation("op-1")).ok, true);
  assert.equal(detenidas, 1);
});

test("el estado del pedido operativo y su holgura se traducen al dominio", () => {
  const { adapters } = modules();
  const base = {
    id: 3, codigoCliente: "c", nombreCliente: "n", telefonoCliente: "t", direccion: "d", x: 1, y: 2,
    cantidad: 4, pendiente: 4, prioridad: "PRIORITARIO_1", incumplido: false,
    registro: "2026-10-28T09:00", limite: "2026-10-28T13:00", transiciones: [],
  };
  const order = (estado, vehicles = []) => adapters.pedidoOperacionToOrder({ ...base, estado }, vehicles, "2026-10-28T10:30");
  assert.equal(order("REGISTRADO").status, "por_asignar");
  assert.equal(order("PLANIFICADO").status, "en_almacen");
  assert.equal(order("EN_TRANSITO").status, "en_ruta");
  assert.equal(order("ENTREGADO").status, "entregado");
  const carrier = { plate: "TA01", orders: [{ orderId: "3" }] };
  assert.equal(order("EN_REPLANIFICACION", [carrier]).vehiclePlate, "TA01");
  assert.equal(order("REGISTRADO").priority, "P1");
  assert.equal(order("REGISTRADO").minutesLeft, 150);
  assert.equal(adapters.minutosEntre("2026-10-31T23:30", "2026-11-01T00:15:30"), 45);
  assert.equal(adapters.pedidoActivo({ ...base, estado: "CANCELADO" }), false);
});

test("solo la carga actual (viaje 0) marca un pedido de la simulación como en ruta", () => {
  const { adapters } = modules();
  const unidad = (codigo, viaje) => adapters.vistaUnidadToVehicle({
    codigo, tipo: "AUTO", estado: "EN_RUTA", x: 0, y: 0, cargaABordo: 5, capacidad: 24,
    caminoRecorrido: [], caminoPendiente: [], destinoX: -1, destinoY: -1, minutosHastaDestino: 0,
    pedidosABordo: [{ idPedido: 7, enLaUnidad: 5, totalDelPedido: 10, viaje }], tipoAveria: 0,
  });
  const fila = { id: 7, cliente: "c", paquetes: 10, pendientes: 10, x: 1, y: 2, plazoHoras: 4,
    registro: "2026-01-01T00:00:00", limite: "2026-01-01T04:00:00", holguraMinutos: 60, entregado: false, semaforo: "VERDE" };
  assert.equal(unidad("TA01", 2).orders[0].trip, 2);
  const despues = adapters.filaPedidoToOrder(fila, [unidad("TA01", 1)]);
  assert.equal(despues.status, "en_almacen", "espera una recarga: todavía no va a bordo");
  assert.equal(despues.vehiclePlate, "TA01", "pero ya tiene vehículo asignado");
  const partido = adapters.filaPedidoToOrder(fila, [unidad("TA01", 1), unidad("TA02", 0)]);
  assert.equal(partido.status, "en_ruta");
  assert.equal(partido.vehiclePlate, "TA02", "se informa el vehículo que lo lleva a bordo");
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

const fleet = (autoSpeed, autoQuantity) => ({
  auto: { quantity: autoQuantity, speed: autoSpeed },
  moto: { quantity: 15, speed: 25 },
  bicicleta: { quantity: 12, speed: 12 },
});

test("la flota solo envía las velocidades que cambiaron", async () => {
  const { api, store } = modules();
  const sent = [];
  api.cambiarVelocidad = async (tipo, kmPorHora) => { sent.push([tipo, kmPorHora]); return { version: 2 }; };
  api.cambiarFlota = async () => { throw new Error("no debe llamarse sin cambio de cantidad"); };
  assert.equal((await store.guardarFlota(fleet(35.5, 10), fleet(40, 10))).ok, true);
  assert.deepEqual(sent, [["AUTO", 35.5]]);
});

test("sin endpoint de cantidad se informa el guardado parcial sin anunciar éxito", async () => {
  const { api, store } = modules();
  let body;
  api.cambiarVelocidad = async () => ({ version: 2 });
  api.cambiarFlota = async (s) => { body = s; throw new api.ErrorServicio(404, "No static resource"); };
  const result = await store.guardarFlota(fleet(35, 20), fleet(40, 10));
  assert.equal(result.ok, false);
  assert.match(result.message, /Guardamos las velocidades, pero no la cantidad: el cambio de cantidad aún no está disponible/);
  assert.deepEqual(body.unidades.AUTO, { cantidad: 20, kmPorHora: 35 });
  assert.equal(store.getSnapshot().cantidadesFlota, null);
});

// ---- Clientes --------------------------------------------------------------------

const persona = {
  kind: "persona", document: "45678912", name: "Ana Perez", phone: "999111222",
  address: "Calle Uno 123", location: { x: 28, y: 14 },
};

test("DNI y RUC se validan como en el backend, incluido el dígito verificador", () => {
  const { documento } = modules();
  assert.equal(documento.kindForDocument("45678912"), "persona");
  assert.equal(documento.kindForDocument("20600000005"), "empresa");
  assert.equal(documento.kindForDocument("4567891"), null);
  assert.equal(documento.documentError("persona", "45678912"), undefined);
  assert.match(documento.documentError("persona", "4567891"), /8 dígitos/);
  assert.equal(documento.documentError("empresa", "20600000005"), undefined);
  assert.equal(documento.documentError("empresa", "10456789019"), undefined);
  assert.match(documento.documentError("empresa", "20600000006"), /no es válido/);
  assert.match(documento.documentError("empresa", "30600000005"), /10 o 20/);
  assert.match(documento.documentError("empresa", "456789"), /11 dígitos/);
});

test("registrar un cliente envía el contrato del backend y lo incorpora a la lista", async () => {
  const { api, actions, clientes } = modules();
  let cuerpo;
  api.registrarCliente = async (s) => { cuerpo = s; return { ...s, registrado: "t", actualizado: "t" }; };
  const result = await actions.registerClient({ ...persona, contact: "no aplica a personas" });
  assert.equal(result.ok, true);
  assert.deepEqual(cuerpo, {
    tipo: "PERSONA", documento: "45678912", nombre: "Ana Perez", telefono: "999111222",
    contacto: null, direccion: "Calle Uno 123", x: 28, y: 14,
  });
  assert.deepEqual(clientes.getSnapshot().clientes.map((c) => c.document), ["45678912"]);
});

test("buscar distingue un cliente no registrado de un backend sin la ruta", async () => {
  const { api, actions } = modules();
  api.buscarCliente = async () => { throw new api.ErrorServicio(404, "No hay ningun cliente", "RECURSO_NO_ENCONTRADO"); };
  assert.deepEqual(await actions.findClient("12345678"), { ok: true, data: null });
  api.buscarCliente = async () => { throw new api.ErrorServicio(404, "No existe el extremo", "RUTA_NO_ENCONTRADA"); };
  assert.equal((await actions.findClient("12345678")).ok, false);
  api.buscarCliente = async () => ({
    tipo: "EMPRESA", documento: "20600000005", nombre: "Comercial Andina SAC", telefono: "014567890",
    contacto: "Luis Rojas", direccion: "Av. Industrial 450", x: 60, y: 40, registrado: "t", actualizado: "t",
  });
  const encontrado = await actions.findClient("20600000005");
  assert.deepEqual(encontrado.data, {
    kind: "empresa", document: "20600000005", name: "Comercial Andina SAC", phone: "014567890",
    contact: "Luis Rojas", address: "Av. Industrial 450", location: { x: 60, y: 40 },
  });
});

test("un conflicto al registrar se informa con el mensaje del servidor", async () => {
  const { api, actions, clientes } = modules();
  api.registrarCliente = async () => { throw new api.ErrorServicio(409, "Ya existe un cliente con el documento 45678912"); };
  assert.deepEqual(await actions.registerClient(persona), { ok: false, message: "Ya existe un cliente con el documento 45678912" });
  assert.equal(clientes.getSnapshot().clientes.length, 0);
});
