/**
 * Traduce los modelos del backend (español, en src/lib/backend/types.ts) al
 * dominio que consumen las pantallas (src/lib/types.ts). Aquí viven las
 * decisiones de mapeo que el contrato no resuelve 1:1; cada una lleva un
 * comentario con el porqué.
 */

import { PRIORITIES } from "@/lib/constants";
import { parseISODate } from "@/lib/format";
import type {
  Blockage,
  BreakdownType,
  Coord,
  FirstLateOrder,
  MapSnapshot,
  Metrics,
  Order,
  OrderStatus,
  PriorityAverage,
  PriorityCode,
  SimStamp,
  SimulationClock,
  SimulationMode,
  SimulationOutcome,
  SimulationSummary,
  TrafficLight,
  Vehicle,
  VehicleKind,
  VehicleStatus,
  Warehouse,
} from "@/lib/types";
import type {
  EstadoCorrida,
  FilaPedido,
  InstantaneaSimulacion,
  MetricasSimulacion,
  ResultadoSimulacion,
  ResumenCorrida,
  TipoEscenario,
  TipoUnidad,
  VistaAlmacen,
  VistaBloqueo,
  VistaParametros,
  VistaUnidad,
} from "@/lib/backend/types";

// ---- Escenario / modo ----------------------------------------------------

export const TIPO_POR_MODO: Record<SimulationMode, TipoEscenario> = { "5d": "SIMULACION_5D", colapso: "COLAPSO" };

export function modoPorTipo(tipo: TipoEscenario): SimulationMode | null {
  return tipo === "SIMULACION_5D" ? "5d" : tipo === "COLAPSO" ? "colapso" : null; // DIA_A_DIA usa la pantalla de operaciones.
}

const OUTCOME_POR_ESTADO: Partial<Record<EstadoCorrida, SimulationOutcome>> = {
  CULMINADA: "exito",
  CANCELADA: "cancelada",
  COLAPSADA: "colapso",
  FALLIDA: "fallida",
};
export const outcomePorEstado = (e: EstadoCorrida): SimulationOutcome | null => OUTCOME_POR_ESTADO[e] ?? null;

// ---- Vehículos -------------------------------------------------------------

const KIND_POR_TIPO: Record<TipoUnidad, VehicleKind> = { AUTO: "auto", MOTO: "moto", BICICLETA: "bicicleta" };

/** Conserva las pausas operativas; mantenimiento continúa fuera de servicio. */
const STATUS_POR_ESTADO: Record<VistaUnidad["estado"], VehicleStatus> = {
  DISPONIBLE: "disponible",
  EN_RUTA: "en_ruta",
  ENTREGANDO: "en_ruta",
  EN_ALIMENTACION: "en_alimentacion",
  ABASTECIENDO: "abasteciendo",
  AVERIADA: "averiado",
  EN_MANTENIMIENTO: "averiado",
};

const BREAKDOWN_POR_TIPO: Record<number, BreakdownType> = { 1: "T1", 2: "T2", 3: "T3" };

function pairsToCoords(flat: number[]): Coord[] {
  const out: Coord[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

export function vistaUnidadToVehicle(u: VistaUnidad): Vehicle {
  const status = STATUS_POR_ESTADO[u.estado];
  const traveled = pairsToCoords(u.caminoRecorrido);
  const pending = pairsToCoords(u.caminoPendiente);
  return {
    id: u.codigo,
    plate: u.codigo,
    kind: KIND_POR_TIPO[u.tipo],
    status,
    position: { x: u.x, y: u.y },
    // Durante cualquier servicio destinoX vale -1; el itinerario sigue vigente.
    route: traveled.length || pending.length ? { traveled, pending } : undefined,
    load: u.cargaABordo,
    capacity: u.capacidad,
    etaMinutes: u.destinoX >= 0 ? u.minutosHastaDestino : undefined,
    destination: u.destinoX >= 0 && u.destinoY >= 0 ? { x: u.destinoX, y: u.destinoY } : undefined,
    breakdownType: BREAKDOWN_POR_TIPO[u.tipoAveria],
    // La exactitud del manifiesto depende del backend: no inferir carga física de la ruta.
    orders: u.pedidosABordo.filter((p) => p.enLaUnidad > 0).map((p) => ({ orderId: String(p.idPedido), packagesInVehicle: p.enLaUnidad, packagesTotal: p.totalDelPedido })),
  };
}

// ---- Almacenes ---------------------------------------------------------

/** -1 significa "ilimitado" en el backend (el almacén central); el frontend lo representa como "sin dato". */
const orUnlimited = (n: number) => (n < 0 ? undefined : n);

export function vistaAlmacenToWarehouse(a: VistaAlmacen): Warehouse {
  return {
    id: String(a.id),
    name: a.nombre,
    kind: a.central ? "principal" : "secundario",
    position: { x: a.x, y: a.y },
    stock: orUnlimited(a.disponible),
    capacity: orUnlimited(a.capacidad),
  };
}

// ---- Bloqueos ------------------------------------------------------------

export function vistaBloqueoToBlockage(b: VistaBloqueo, index: number): Blockage {
  const path = pairsToCoords(b.nodos);
  return { id: String(index), from: path[0], to: path[path.length - 1], path };
}

// ---- Fotografía → MapSnapshot -------------------------------------------

export function instantaneaToMapSnapshot(i: InstantaneaSimulacion | null, almacenes: VistaAlmacen[], runId: string | null = null): MapSnapshot {
  const warehouses = almacenes.map(vistaAlmacenToWarehouse);
  return {
    warehouses,
    // Mantener también la flota en almacenes: puede estar alimentándose o abasteciendo.
    vehicles: i ? i.unidades.map(vistaUnidadToVehicle) : [],
    blockages: i ? i.bloqueosVigentes.map(vistaBloqueoToBlockage) : [],
    sample: i ? { runId, simulatedMinute: i.minutoSimulado, realMilliseconds: i.milisegundosReales } : undefined,
  };
}

export function instantaneaToClock(i: InstantaneaSimulacion): SimulationClock {
  return {
    simTime: i.fechaHoraSimulada,
    elapsedMinutes: i.minutoSimulado,
    realSeconds: Math.round(i.milisegundosReales / 1000),
    delivered: i.metricas.pedidosEntregados,
  };
}

// ---- Pedidos -------------------------------------------------------------

function priorityByHours(hours: number): PriorityCode {
  return PRIORITIES.find((p) => p.hours === hours)?.code ?? "N";
}

/**
 * El backend solo da `entregado`. "en_ruta" se infiere cruzando con los
 * pedidos a bordo de la flota; sin ese cruce, o si no está entregado ni a
 * bordo, se muestra "en_almacen" (no hay forma de distinguir "por_asignar"
 * con los datos disponibles hoy).
 */
export function filaPedidoToOrder(f: FilaPedido, vehicles: Vehicle[]): Order {
  const carrier = vehicles.find((v) => v.orders.some((o) => o.orderId === String(f.id)));
  const status: OrderStatus = f.entregado ? "entregado" : carrier ? "en_ruta" : "en_almacen";
  return {
    id: String(f.id),
    packages: f.paquetes,
    destination: { x: f.x, y: f.y },
    priority: priorityByHours(f.plazoHoras),
    minutesLeft: f.holguraMinutos,
    status,
    vehiclePlate: carrier?.plate,
  };
}

// ---- Métricas --------------------------------------------------------------

const distanceKmFromBackend = (k: Record<TipoUnidad, number>): Record<VehicleKind, number> => ({
  auto: k.AUTO ?? 0,
  moto: k.MOTO ?? 0,
  bicicleta: k.BICICLETA ?? 0,
});

function avgDeliveryByPriority(promediosPorPlazo: Record<string, number>, entregasPorPlazo: Record<string, number>): PriorityAverage[] {
  // EstadoSimulacion.metricas() ya divide la suma entre el número de pedidos completos.
  // Omitir prioridades sin muestras y claves desconocidas, sin fabricar promedios de cero.
  return PRIORITIES.flatMap(({ code, hours }) => {
    const average = promediosPorPlazo[String(hours)];
    return entregasPorPlazo[String(hours)] > 0 && Number.isFinite(average) && average >= 0
      ? [{ priority: code, avgMinutes: average }]
      : [];
  });
}

/**
 * El backend no separa "entregado a tiempo" de "entregado tarde": se
 * aproxima con entregados / (entregados + incumplidos), es decir, la
 * fracción de pedidos que llegaron a un estado final sin romper su plazo.
 */
function onTimeRate(m: MetricasSimulacion): number {
  const total = m.pedidosEntregados + m.pedidosIncumplidos;
  return total > 0 ? m.pedidosEntregados / total : 0;
}

export function metricasToMetrics(m: MetricasSimulacion): Metrics {
  const k = distanceKmFromBackend(m.kilometrosPorTipo);
  return {
    delivered: m.pedidosEntregados,
    onTimeRate: onTimeRate(m),
    accumulatedCost: m.costoAcumulado,
    distanceKm: k.auto + k.moto + k.bicicleta,
    avgDeliveryByPriority: avgDeliveryByPriority(m.minutosEntregaPorPlazo, m.entregasPorPlazo),
  };
}

// ---- Semáforo (umbral global) --------------------------------------------

/**
 * El backend solo guarda 2 umbrales (ambar, verde); el frontend modela 4
 * campos pero los enlaza en pares (greenFrom=amberTo, amberFrom=redTo), así
 * que la equivalencia es exacta, no una aproximación.
 */
export function parametrosToTrafficLight(p: VistaParametros): TrafficLight {
  return { redTo: p.umbralSemaforoAmbar, amberFrom: p.umbralSemaforoAmbar, amberTo: p.umbralSemaforoVerde, greenFrom: p.umbralSemaforoVerde };
}
export const trafficLightToSemaforoBody = (t: TrafficLight) => ({ ambar: t.redTo, verde: t.amberTo });

// ---- Resultado / resumen --------------------------------------------------

function fechaToSimStamp(fecha: string, primerDia: string): SimStamp {
  const [fechaParte, horaParte] = fecha.split("T");
  const dias = Math.round((parseISODate(fechaParte).getTime() - parseISODate(primerDia).getTime()) / 86_400_000);
  return { day: dias + 1, time: (horaParte ?? "00:00:00").slice(0, 5) };
}

export function filaPedidoToFirstLate(f: FilaPedido, primerDia: string): FirstLateOrder {
  return {
    orderId: String(f.id),
    packages: f.paquetes,
    destination: { x: f.x, y: f.y },
    priority: priorityByHours(f.plazoHoras),
    registeredAt: fechaToSimStamp(f.registro, primerDia),
    dueAt: fechaToSimStamp(f.limite, primerDia),
  };
}

export function buildSummary(
  corrida: ResumenCorrida,
  resultado: ResultadoSimulacion,
  trafficLight: TrafficLight,
  firstLateOrder?: FirstLateOrder,
): SimulationSummary {
  const mode = modoPorTipo(corrida.tipo) ?? "5d";
  const m = resultado.metricas;
  const k = distanceKmFromBackend(m.kilometrosPorTipo);
  return {
    outcome: outcomePorEstado(resultado.estado) ?? "cancelada",
    mode,
    startDate: corrida.primerDia,
    delivered: m.pedidosEntregados,
    onTimeRate: onTimeRate(m),
    simulatedMinutes: resultado.minutoFinal,
    executionSeconds: Math.round(resultado.milisegundosReales / 1000),
    distanceKm: k,
    totalCost: m.costoAcumulado,
    avgDeliveryByPriority: avgDeliveryByPriority(m.minutosEntregaPorPlazo, m.entregasPorPlazo),
    trafficLight,
    // El backend no expone una bitácora de eventos genérica (solo averías sueltas y
    // activaciones de semáforo); se deja vacío en vez de fabricar una línea de tiempo.
    events: [],
    firstLateOrder,
  };
}
