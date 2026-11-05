import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const { acumularVistos, ordersAtShownTime, RETENCION_SONDEOS } = load("src/lib/data/sync.ts");

const fila = (id, registro, limite) => ({ id, cliente: "c", paquetes: 5, pendientes: 5, x: id, y: 1, plazoHoras: 4,
  registro, limite, holguraMinutos: 999, entregado: false, semaforo: "VERDE" });
const unidad = (...ids) => ({ codigo: "TA01", tipo: "AUTO", estado: "EN_RUTA", x: 0, y: 0, cargaABordo: 5, capacidad: 24,
  caminoRecorrido: [], caminoPendiente: [], destinoX: -1, destinoY: -1, minutosHastaDestino: 0, tipoAveria: 0,
  pedidosABordo: ids.map((idPedido) => ({ idPedido, enLaUnidad: 5, totalDelPedido: 5, viaje: 0 })) });
const foto = (fecha, ...unidades) => ({ fechaHoraSimulada: fecha, unidades });

test("un pedido entregado en el servidor sigue listado mientras el vehículo mostrado lo tenga pendiente", () => {
  let vistos = acumularVistos(new Map(), [fila(1, "2026-01-01T08:00:00", "2026-01-01T12:00:00"), fila(2, "2026-01-01T08:00:00", "2026-01-01T13:00:00")]);
  vistos = acumularVistos(vistos, [fila(2, "2026-01-01T08:00:00", "2026-01-01T13:00:00")]); // el servidor entregó el 1
  const enCamino = ordersAtShownTime(vistos, foto("2026-01-01T10:00:00", unidad(1, 2)));
  assert.deepEqual(enCamino.map((o) => o.id), ["1", "2"]);
  assert.equal(enCamino[0].status, "en_ruta");
  const llego = ordersAtShownTime(vistos, foto("2026-01-01T10:45:00", unidad(2)));
  assert.deepEqual(llego.map((o) => o.id), ["2"], "desaparece cuando el vehículo mostrado lo entrega");
});

test("'Vence en' se mide desde la hora mostrada y no se listan pedidos registrados después", () => {
  const vistos = acumularVistos(new Map(), [fila(1, "2026-01-01T08:00:00", "2026-01-01T12:00:00"), fila(2, "2026-01-01T10:30:00", "2026-01-01T14:30:00")]);
  const orders = ordersAtShownTime(vistos, foto("2026-01-01T10:00:00"));
  assert.deepEqual(orders.map((o) => [o.id, o.minutesLeft]), [["1", 120]]);
});

test("un pedido ausente se olvida tras la retención y sin foto se usa la lista del servidor", () => {
  let vistos = acumularVistos(new Map(), [fila(1, "2026-01-01T08:00:00", "2026-01-01T12:00:00")]);
  assert.deepEqual(ordersAtShownTime(acumularVistos(vistos, []), null), []);
  for (let i = 0; i < RETENCION_SONDEOS; i++) vistos = acumularVistos(vistos, []);
  assert.equal(vistos.size, 1);
  assert.equal(acumularVistos(vistos, []).size, 0);
});
