/**
 * Modelo de dominio que consumen las pantallas.
 * El backend deberá entregar (o adaptarse a) estas formas; ver src/lib/data.
 */

/** Intersección de la retícula: x ∈ [0, 70], y ∈ [0, 50], origen abajo a la izquierda. */
export type Coord = { x: number; y: number };

export type VehicleKind = "auto" | "moto" | "bicicleta";
/** "entregando": detenido en el destino durante la hora de acondicionamiento de la entrega. */
export type VehicleStatus = "en_ruta" | "disponible" | "averiado" | "en_alimentacion" | "entregando" | "abasteciendo";
export type BreakdownType = "T1" | "T2" | "T3";
export type PriorityCode = "P1" | "P2" | "P3" | "P4" | "N";
export type StatusTone = "ok" | "warn" | "crit";

/** `trip` 0 = va a bordo; 1, 2… = se cargará tras esa cantidad de recargas en almacén. */
export type VehicleOrderLoad = { orderId: string; packagesInVehicle: number; packagesTotal: number; trip: number };

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
  // Del servidor: si va llegando a una parada o espera salir de ella.
  phase?: VehiclePhase;
  // Último almacén donde cargó y minuto simulado en que salió de él.
  originWarehouseId?: string;
  originDepartureMinute?: number;
};

export type VehiclePhase = "llegando" | "saliendo";

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
  /** Inicio y fin programados, en minutos simulados de la corrida. */
  startMinute?: number;
  endMinute?: number;
};

/** `durationMs`: duración de la transición que fijó el buffer de reproducción (si la hay). */
/** `simTime`: fecha y hora simuladas de la misma foto que `simulatedMinute`. */
export type MotionSample = { runId: string | null; simulatedMinute: number; realMilliseconds: number; durationMs?: number; simTime?: string };
export type MapSnapshot = { warehouses: Warehouse[]; vehicles: Vehicle[]; blockages: Blockage[]; sample?: MotionSample };

export type ClientKind = "persona" | "empresa";

/** Cliente registrado. `document` (DNI o RUC) lo identifica; `location` es su nodo de entrega habitual. */
export type Client = {
  kind: ClientKind;
  document: string;
  name: string;
  phone: string;
  contact?: string;
  address: string;
  location: Coord;
};

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
  /** Hora simulada de entrega ya formateada ("HH:MM" o "dd/mm HH:MM"); solo en la lista de entregados. */
  deliveredAt?: string;
  /** Placas de los vehículos que lo entregaron; solo en la lista de entregados. */
  deliveredBy?: string[];
  /** Minutos hasta que se complete la entrega (llegada estimada del último envío); sin dato si falta planificar parte del pedido. */
  minutesToDelivery?: number;
  /** Esa llegada estimada, ya formateada ("HH:MM" o "dd/mm HH:MM"). */
  expectedDeliveryAt?: string;
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
/**
 * "fallida" = error interno del backend (sin resumen; se muestra el mensaje de la corrida).
 * "sin_datos" = el colapso agotó los datos de ventas sin que venciera ningún pedido: no hay
 * instante de colapso, solo la cota de que la flota aguantó hasta ahí.
 */
export type SimulationOutcome = "exito" | "cancelada" | "colapso" | "sin_datos" | "fallida";

export type SimulationClock = {
  /** Fecha y hora simulada (ISO 8601). */
  simTime: string;
  elapsedMinutes: number;
  realSeconds: number;
  delivered: number;
};

/** Relojes de la operación diaria, a nivel de minuto. Las fechas están en la zona de la operación. */
export type OpsClock = {
  simTime: Date;
  simElapsedMinutes: number;
  now: Date;
  realElapsedMinutes: number;
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
export type DataScope = { kind: "live" } | { kind: "client" } | { kind: "sim"; mode: SimulationMode } | { kind: "ops" };

export type EntityRef = { type: "vehicle" | "warehouse" | "blockage"; id: string };

// ---- Configuración ampliada de la simulación ---------------------------------

/** Límites de un semáforo en % (0–100), con 0 ≤ low < high ≤ 100. Ver src/lib/occupancy.ts. */
export type PercentBands = { low: number; high: number };

/** T1 y T2 en horas; T3 en días. */
export type BreakdownDurations = Record<BreakdownType | "T2Shifts" | "T3OnSite", number>;
export type BreakdownField = keyof BreakdownDurations;

/** Lo que se configura antes de comenzar; todo tiene un valor por defecto (DEFAULT_SIM_SETTINGS). */
export type SimSettings = {
  /** Hora de inicio "HH:MM" del día elegido. */
  startTime: string;
  breakdownDurations: BreakdownDurations;
  /** Semáforo de ocupación por tipo de vehículo (verde = poco cargado). */
  vehicleOccupancy: Record<VehicleKind, PercentBands>;
  /** Semáforo de llenado de almacenes intermedios (verde = mucho stock). */
  warehouseFill: PercentBands;
};

export type DistanceBand = "0-10" | "10-20" | "20-40" | "40+";
