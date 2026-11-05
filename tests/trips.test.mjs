import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./load.mjs";

const t = load("src/lib/data/trips.ts");
const sel = load("src/lib/data/selectors.ts");
const WH = [{ id: "1", position: { x: 0, y: 0 } }, { id: "2", position: { x: 20, y: 0 } }];
const veh = (id, x, y, orders = [], status = "en_ruta") => ({ id, position: { x, y }, status, orders: orders.map(([orderId, packagesInVehicle]) => ({ orderId, packagesInVehicle })) });
const step = (log, minute, vehicles, runId = "r1") => t.observe(log, { runId, minute, vehicles, warehouses: WH, windowMin: 240 });

test("salida: origen = último almacén visto, hora = primera foto fuera de él", () => {
  let log = step(t.emptyTripLog(), 0, [veh("V1", 0, 0, [["10", 5]])]);
  assert.equal(log.vehicles.V1.atWarehouseId, "1");
  assert.equal(log.vehicles.V1.departedAt, null);
  log = step(log, 5, [veh("V1", 2, 0, [["10", 5]])]);
  assert.equal(log.vehicles.V1.originId, "1");
  assert.equal(log.vehicles.V1.departedAt, 5);
  assert.deepEqual(log.orders["10"], { originId: "1", departedAt: 5 });
  assert.equal(step(log, 5, [veh("V1", 9, 9)]), log, "misma foto: sin cambios");
});

test("entrega fuera de almacén; un trasvase a otro vehículo no cuenta", () => {
  let log = step(t.emptyTripLog(), 0, [veh("V1", 0, 0, [["10", 5], ["11", 3]]), veh("V2", 20, 0)]);
  log = step(log, 5, [veh("V1", 3, 0, [["10", 5], ["11", 3]]), veh("V2", 20, 0)]);
  log = step(log, 10, [veh("V1", 6, 0, [["11", 3]]), veh("V2", 20, 0)]);
  assert.deepEqual(log.deliveries.map((d) => [d.orderId, d.warehouseId, d.minute, d.packages]), [["10", "1", 10, 5]]);
  assert.equal(log.orders["10"], undefined, "el pedido entregado se olvida");
  // Avería: el pedido 11 pasa de V1 a V2.
  log = step(log, 15, [veh("V1", 6, 0, [], "averiado"), veh("V2", 6, 1, [["11", 3]])]);
  assert.equal(log.deliveries.length, 1);
});

test("ventana de 4 h simuladas y reinicio por corrida o retroceso", () => {
  let log = step(t.emptyTripLog(), 0, [veh("V1", 0, 0, [["10", 5]])]);
  log = step(log, 5, [veh("V1", 1, 0, [["10", 5]])]);
  log = step(log, 10, [veh("V1", 2, 0, [])]);
  assert.equal(log.deliveries.length, 1);
  log = step(log, 251, [veh("V1", 3, 0)]);
  assert.equal(log.deliveries.length, 0, "la entrega del minuto 10 salió de la ventana");
  log = step(log, 252, [veh("V1", 3, 0)], "r2");
  assert.equal(log.runId, "r2");
  assert.equal(log.vehicles.V1.originId, null);
  log = step(log, 100, [veh("V1", 3, 0)], "r2");
  assert.equal(log.minute, 100);
});

test("selectores: fila de vehículo, de almacén y de pedido", () => {
  let log = step(t.emptyTripLog(), 0, [veh("V1", 0, 0, [["10", 30]])]);
  log = step(log, 5, [veh("V1", 4, 0, [["10", 30]])]);
  const vehicle = {
    id: "V1", plate: "V1", kind: "moto", status: "en_ruta", position: { x: 4, y: 0 }, load: 30, capacity: 40,
    route: { traveled: [{ x: 0, y: 0 }, { x: 4, y: 0 }], pending: [{ x: 4, y: 0 }, { x: 4, y: 6 }] },
    etaMinutes: 12, destination: { x: 4, y: 6 }, orders: [{ orderId: "10", packagesInVehicle: 30, packagesTotal: 30 }],
  };
  const bands = { auto: { low: 25, high: 75 }, moto: { low: 25, high: 70 }, bicicleta: { low: 25, high: 75 } };
  const [row] = sel.selectVehicleRows([vehicle], log, 5, bands);
  assert.equal(row.occupancy, 75);
  assert.equal(row.tone, "crit", "usa los umbrales de su tipo");
  assert.deepEqual([row.traveledKm, row.remainingKm, row.fromOriginKm], [4, 6, 4]);
  assert.deepEqual([row.departureMinute, row.arrivalMinute, row.originId], [5, 17, "1"]);

  const warehouses = [
    { id: "1", name: "Central", kind: "principal", position: { x: 0, y: 0 } },
    { id: "2", name: "Norte", kind: "secundario", position: { x: 20, y: 0 }, stock: 30, capacity: 120 },
  ];
  const [central, norte] = sel.selectWarehouseRows(warehouses, [vehicle], log, { low: 25, high: 50 });
  assert.deepEqual([central.inTransit, central.toDepart, central.tone], [1, 0, null]);
  assert.deepEqual([norte.occupancy, norte.tone], [25, "crit"]);

  const order = { id: "10", packages: 30, destination: { x: 4, y: 6 }, priority: "P1", minutesLeft: 90, status: "en_ruta" };
  const [o] = sel.selectOrderRows([order], [vehicle], log, 5);
  assert.deepEqual(o.carriers.map((c) => c.plate), ["V1"]);
  assert.deepEqual([o.arrivalMinute, o.departureMinute, o.originId], [17, 5, "1"]);
  assert.deepEqual(o.currentPoint, { x: 4, y: 0 });

  assert.equal(sel.fleetOccupancy([vehicle, { ...vehicle, load: 0 }]), 37.5);
  assert.equal(sel.warehouseFill(warehouses), 25);
  assert.deepEqual(sel.clockAt("2026-03-01T23:50:00", 100, 120), { day: "2026-03-02", time: "00:10" });
});

test("las entregas de viajes posteriores a una recarga no cuentan como carga a bordo", () => {
  const withTrip = (id, x, orders) => ({ id, position: { x, y: 0 }, status: "en_ruta", orders: orders.map(([orderId, packagesInVehicle, trip]) => ({ orderId, packagesInVehicle, trip })) });
  let log = step(t.emptyTripLog(), 0, [withTrip("V1", 0, [["10", 5, 0], ["20", 4, 1]])]);
  log = step(log, 5, [withTrip("V1", 2, [["10", 5, 0], ["20", 4, 1]])]);
  assert.deepEqual(Object.keys(log.vehicles.V1.carried), ["10"]);
  assert.equal(log.orders["20"], undefined);
  log = step(log, 10, [withTrip("V1", 3, [["10", 5, 0]])]);
  assert.equal(log.deliveries.length, 0, "quitar una entrega futura del plan no es una entrega");
});
