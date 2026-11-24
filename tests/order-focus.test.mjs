import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const { orderCarriers, splitAtDelivery, reassignmentMessage } = load("src/components/map/order-focus.ts");

const p = (x, y) => ({ x, y });
const vehicle = (id, ...loads) => ({ id, plate: id, orders: loads.map(([orderId, trip = 0, packagesInVehicle = 1]) => ({ orderId, trip, packagesInVehicle, packagesTotal: 1 })) });

test("los vehículos del pedido salen de la foto; con varias cargas, el viaje más próximo y la suma de paquetes", () => {
  const c = orderCarriers([vehicle("A", ["1", 1, 2], ["1", 0, 3]), vehicle("B", ["2"]), vehicle("C", ["1", 2])], "1");
  assert.deepEqual(c.map((x) => [x.vehicle.id, x.trip, x.packages]), [["A", 0, 5], ["C", 2, 1]]);
});

test("la ruta se corta en la parada de entrega", () => {
  const path = [p(0, 0), p(2, 0), p(2, 3), p(5, 3)];
  const s = splitAtDelivery(path, p(2, 3), 0, []);
  assert.deepEqual(s.toDelivery, [p(0, 0), p(2, 0), p(2, 3)]);
  assert.deepEqual(s.after, [p(2, 3), p(5, 3)]);
});

test("tras una recarga, el paso previo por el destino no cuenta como entrega", () => {
  // Pasa por (2, 0), recarga en el almacén (4, 0) y vuelve a (2, 0) a entregar.
  const path = [p(0, 0), p(2, 0), p(4, 0), p(2, 0), p(2, 2)];
  const s = splitAtDelivery(path, p(2, 0), 1, [p(4, 0)]);
  assert.equal(s.toDelivery.length, 4);
  assert.deepEqual(s.after, [p(2, 0), p(2, 2)]);
});

test("sin la parada en la ruta, toda la ruta lleva a la entrega", () => {
  const path = [p(0, 0), p(1, 0)];
  assert.deepEqual(splitAtDelivery(path, p(9, 9), 0, []), { toDelivery: path, after: [] });
});

test("la posición animada (fraccionaria) también reconoce el destino", () => {
  const s = splitAtDelivery([p(0.4, 0), p(3, 0), p(3, 1)], p(3, 0), 0, []);
  assert.equal(s.toDelivery.length, 2);
});

test("aviso de reasignación solo cuando aparece otra placa", () => {
  assert.equal(reassignmentMessage("7", ["A"], ["B"]), "El pedido 7 ahora lo lleva B.");
  assert.equal(reassignmentMessage("7", ["A"], ["A", "B", "C"]), "El pedido 7 ahora lo llevan B, C.");
  assert.equal(reassignmentMessage("7", ["A", "B"], ["A"]), null, "una entrega parcial no es un cambio");
  assert.equal(reassignmentMessage("7", [], ["A"]), null, "primera asignación");
  assert.equal(reassignmentMessage("7", ["A"], []), null, "entregado");
});
