/**
 * Modelo de dominio que consumen las pantallas.
 * El backend deberá entregar (o adaptarse a) estas formas; ver src/lib/data.
 */

/** Intersección de la retícula: x ∈ [0, 70], y ∈ [0, 50], origen abajo a la izquierda. */
export type Coord = { x: number; y: number };

export type VehicleKind = "auto" | "moto" | "bicicleta";
export type VehicleStatus = "en_ruta" | "disponible" | "averiado" | "en_alimentacion" | "abasteciendo";
export type BreakdownType = "T1" | "T2" | "T3";
export type PriorityCode = "P1" | "P2" | "P3" | "P4" | "N";
export type StatusTone = "ok" | "warn" | "crit";

export type VehicleOrderLoad = { orderId: string; packagesInVehicle: number; packagesTotal: number };

export type Vehicle = {
  id: string;
  plate: string;
  kind: VehicleKind;
  status: VehicleStatus;
  position: Coord;
  /** Tramo recorrido y tramo pendiente, como secuencias de intersecciones. */
  route?: { traveled: Coord[]; pending: Coord[] };
  load: number;
  capacity: number;
  etaMinutes?: number;
  /** Destino inmediato; puede faltar durante el servicio aunque exista ruta pendiente. */
  destination?: Coord;
  breakdownType?: BreakdownType;
  orders: VehicleOrderLoad[];
};

export type Warehouse = {
  id: string;
  name: string;
  kind: "principal" | "secundario";
  position: Coord;
  /** Paquetes en stock (solo almacenes secundarios). */
  stock?: number;
  capacity?: number;
  vehiclesAtBase?: number;
};

export type Blockage = {
  id: string;
  from: Coord;
  to: Coord;
  until?: string;
  /** Polilínea completa (nodo a nodo). `from`/`to` son su primer y último punto. */
  path?: Coord[];
};

export type MotionSample = { runId: string | null; simulatedMinute: number; realMilliseconds: number };
export type MapSnapshot = { warehouses: Warehouse[]; vehicles: Vehicle[]; blockages: Blockage[]; sample?: MotionSample };

export type OrderStatus = "por_asignar" | "en_almacen" | "en_ruta" | "entregado";

export type Order = {
  id: string;
  packages: number;
  destination: Coord;
  priority: PriorityCode;
  /** Minutos que faltan para que venza el plazo. */
  minutesLeft: number;
  status: OrderStatus;
  vehiclePlate?: string;
  etaMinutes?: number;
};

export type ConnectionState = "live" | "reconnecting" | "offline" | "waiting";

export type FleetCount = Record<VehicleKind, number>;

/** Cantidad de vehículos y velocidad (km/h) configuradas para cada tipo. */
export type FleetSettings = Record<VehicleKind, { quantity: number; speed: number }>;

export type OpsKpis = { fleet: FleetCount; activeOrders: number; deliveredToday: number; alerts: number };

export type PriorityAverage = { priority: PriorityCode; avgMinutes: number };

export type Metrics = {
  delivered: number;
  /** 0–1 */
  onTimeRate: number;
  accumulatedCost: number;
  distanceKm: number;
  avgDeliveryByPriority: PriorityAverage[];
};

/** Rangos del semáforo en paquetes (escala 0–1000). */
export type TrafficLight = { greenFrom: number; amberFrom: number; amberTo: number; redTo: number };

export type BreakdownRecord = {
  id: string;
  plate: string;
  vehicleKind: VehicleKind;
  type: BreakdownType;
  status: "activa" | "resuelta";
  /** Texto relativo ya formateado por el backend o calculado en el adaptador. */
  when: string;
  reassignedOrders?: number;
};

export type VehiclePlates = Record<VehicleKind, string[]>;

export type SimulationMode = "5d" | "colapso";
/** "fallida" = error interno del backend (sin resumen; se muestra el mensaje de la corrida). */
export type SimulationOutcome = "exito" | "cancelada" | "colapso" | "fallida";

export type SimulationClock = {
  /** Fecha y hora simulada (ISO 8601). */
  simTime: string;
  elapsedMinutes: number;
  realSeconds: number;
  delivered: number;
};

/** Marca de tiempo dentro de la simulación: día (1 = primer día) y hora "HH:MM". */
export type SimStamp = { day: number; time: string };

export type SimulationEvent = { tone: StatusTone; message: string; at: SimStamp };

export type FirstLateOrder = {
  orderId: string;
  packages: number;
  destination: Coord;
  priority: PriorityCode;
  registeredAt: SimStamp;
  dueAt: SimStamp;
  vehiclePlate?: string;
  /** Distancia que le faltaba al vehículo cuando venció el plazo, en km. */
  remainingKm?: number;
};

export type SimulationSummary = {
  outcome: SimulationOutcome;
  mode: SimulationMode;
  /** Fecha de inicio (YYYY-MM-DD). */
  startDate: string;
  delivered: number;
  onTimeRate: number;
  simulatedMinutes: number;
  executionSeconds: number;
  distanceKm: Record<VehicleKind, number>;
  totalCost: number;
  avgDeliveryByPriority: PriorityAverage[];
  trafficLight: TrafficLight;
  events: SimulationEvent[];
  /** Obligatorio cuando outcome === "colapso": el primer pedido que no llegó a tiempo. */
  firstLateOrder?: FirstLateOrder;
};

/** Qué conjunto de datos se consulta. */
export type DataScope = { kind: "live" } | { kind: "client" } | { kind: "sim"; mode: SimulationMode };

export type EntityRef = { type: "vehicle" | "warehouse" | "blockage"; id: string };
