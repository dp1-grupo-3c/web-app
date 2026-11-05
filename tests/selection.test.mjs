import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const { assignedDestinations } = load("src/components/map/selection.ts");

const vehicle = (...ids) => ({ orders: ids.map((orderId) => ({ orderId, packagesInVehicle: 1, packagesTotal: 1, trip: 0 })) });
const order = (id, x, y, status = "en_ruta") => ({ id, destination: { x, y }, status });

test("el destino se mantiene mientras el vehículo mostrado lo tenga pendiente, aunque el servidor ya lo entregó", () => {
  // El servidor ya no lista el pedido 1 (entregado), pero la foto reproducida aún lo tiene.
  const known = new Map([["1", { x: 5, y: 5 }], ["2", { x: 9, y: 2 }]]);
  const d = assignedDestinations(vehicle("1", "2"), [order("2", 9, 2)], known);
  assert.deepEqual(d.map((x) => x.key), ["5,5", "9,2"], "en el orden de la ruta");
});

test("un pedido entregado en la lista actual no se oculta si el vehículo mostrado aún no llegó", () => {
  const d = assignedDestinations(vehicle("1"), [order("1", 5, 5, "entregado")]);
  assert.deepEqual(d.map((x) => x.orderIds), [["1"]]);
});

test("el destino desaparece cuando la foto mostrada ya no lo lista y agrupa por intersección", () => {
  const orders = [order("1", 5, 5), order("2", 5, 5), order("3", 7, 1)];
  assert.deepEqual(assignedDestinations(vehicle("2", "1"), orders), [{ key: "5,5", position: { x: 5, y: 5 }, orderIds: ["2", "1"] }]);
  assert.deepEqual(assignedDestinations(vehicle(), orders), []);
});
