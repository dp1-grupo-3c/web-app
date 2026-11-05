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
  BreakdownRecord,
  BreakdownType,
  Client,
  Coord,
  FirstLateOrder,
  FleetSettings,
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
  OpsClock,
} from "@/lib/types";
import type {
  Cliente,
  EstadoCorrida,
  FilaPedido,
  IncidenteOperacion,
  InstantaneaSimulacion,
  MetricasSimulacion,
  ParametrosOperacionInstantanea,
  PrioridadPedido,
  ResultadoSimulacion,
  ResumenCorrida,
  SolicitudFlota,
  SolicitudCliente,
  TipoEscenario,
  TipoUnidad,
  VistaAlmacen,
  VistaOperacion,
  VistaBloqueo,
  VistaParametros,
  VistaPedidoOperacion,
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
  DATOS_AGOTADOS: "sin_datos",
  FALLIDA: "fallida",
};
export const outcomePorEstado = (e: EstadoCorrida): SimulationOutcome | null => OUTCOME_POR_ESTADO[e] ?? null;

// ---- Vehículos -------------------------------------------------------------

const KIND_POR_TIPO: Record<TipoUnidad, VehicleKind> = { AUTO: "auto", MOTO: "moto", BICICLETA: "bicicleta" };
export const TIPO_POR_KIND: Record<VehicleKind, TipoUnidad> = { auto: "AUTO", moto: "MOTO", bicicleta: "BICICLETA" };

/** Conserva las pausas operativas; mantenimiento continúa fuera de servicio. */
const STATUS_POR_ESTADO: Record<VistaUnidad["estado"], VehicleStatus> = {
  DISPONIBLE: "disponible",
  EN_RUTA: "en_ruta",
  ENTREGANDO: "entregando",
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
    // Incluye las entregas de viajes posteriores a una recarga; `trip` las distingue de la carga real.
    orders: u.pedidosABordo.filter((p) => p.enLaUnidad > 0).map((p) => ({ orderId: String(p.idPedido), packagesInVehicle: p.enLaUnidad, packagesTotal: p.totalDelPedido, trip: p.viaje ?? 0 })),
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
  return { id: String(index), from: path[0], to: path[path.length - 1], path, startMinute: b.minutoInicio, endMinute: b.minutoFin };
}

// ---- Fotografía → MapSnapshot -------------------------------------------

export function instantaneaToMapSnapshot(i: InstantaneaSimulacion | null, almacenes: VistaAlmacen[], runId: string | null = null, durationMs?: number): MapSnapshot {
  const warehouses = almacenes.map(vistaAlmacenToWarehouse);
  return {
    warehouses,
    // Mantener también la flota en almacenes: puede estar alimentándose o abasteciendo.
    vehicles: i ? i.unidades.map(vistaUnidadToVehicle) : [],
    blockages: i ? i.bloqueosVigentes.map(vistaBloqueoToBlockage) : [],
    sample: i ? { runId, simulatedMinute: i.minutoSimulado, realMilliseconds: i.milisegundosReales, durationMs } : undefined,
  };
}

/** `minutoInicial`: minutoSimulado cuenta desde las 00:00 del primer día, no desde el arranque. */
export function instantaneaToClock(i: InstantaneaSimulacion, minutoInicial = 0): SimulationClock {
  return {
    simTime: i.fechaHoraSimulada,
    elapsedMinutes: Math.max(0, i.minutoSimulado - minutoInicial),
    realSeconds: Math.round(i.milisegundosReales / 1000),
    delivered: i.metricas.pedidosEntregados,
  };
}

// ---- Pedidos -------------------------------------------------------------

function priorityByHours(hours: number): PriorityCode {
  return PRIORITIES.find((p) => p.hours === hours)?.code ?? "N";
}

/**
/**
 * Vehículo que tiene el pedido en su itinerario y si ya lo lleva cargado.
 * Se prefiere el que lo lleva a bordo: un pedido partido puede estar en varios.
 */
function carrierOf(vehicles: Vehicle[], orderId: string): { carrier?: Vehicle; loaded: boolean } {
  const loadedBy = vehicles.find((v) => v.orders.some((o) => o.orderId === orderId && o.trip === 0));
  if (loadedBy) return { carrier: loadedBy, loaded: true };
  return { carrier: vehicles.find((v) => v.orders.some((o) => o.orderId === orderId)), loaded: false };
}

/**
 * El backend solo da `entregado`. "en_ruta" se infiere cruzando con los
 * pedidos a bordo de la flota: solo cuenta la carga actual (viaje 0), no las
 * entregas que esperan una recarga. Sin ese cruce, o si no está entregado ni
 * a bordo, se muestra "en_almacen" (no hay forma de distinguir "por_asignar"
 * con los datos disponibles hoy). El vehículo se informa en ambos casos.
 */
export function filaPedidoToOrder(f: FilaPedido, vehicles: Vehicle[]): Order {
  const { carrier, loaded } = carrierOf(vehicles, String(f.id));
  const status: OrderStatus = f.entregado ? "entregado" : loaded ? "en_ruta" : "en_almacen";
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

// ---- Flota ------------------------------------------------------------------

/**
 * Velocidades vigentes del backend y cantidades de la corrida (unidades
 * activas por tipo). Sin corrida, o sin parámetros aún, se usan los valores
 * del enunciado: el backend todavía no expone la cantidad configurada.
 */
export function fleetSettings(p: VistaParametros | null, c: ResumenCorrida | null, defaults: FleetSettings): FleetSettings {
  const out = {} as FleetSettings;
  for (const [kind, tipo] of Object.entries(TIPO_POR_KIND) as [VehicleKind, TipoUnidad][]) {
    out[kind] = {
      quantity: c?.unidadesActivasPorTipo?.[tipo] ?? defaults[kind].quantity,
      speed: p?.velocidades?.[tipo] ?? defaults[kind].speed,
    };
  }
  return out;
}

/** Cuerpo del endpoint de flota propuesto (ver cambiarFlota en src/lib/backend/api.ts). */
export const fleetToFlotaBody = (f: FleetSettings): SolicitudFlota => ({
  unidades: Object.fromEntries(
    (Object.entries(TIPO_POR_KIND) as [VehicleKind, TipoUnidad][]).map(([kind, tipo]) => [tipo, { cantidad: f[kind].quantity, kmPorHora: f[kind].speed }]),
  ) as SolicitudFlota["unidades"],
});

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

// ---- Operaciones diarias ---------------------------------------------------

export const PRIORIDAD_POR_CODIGO: Record<PriorityCode, PrioridadPedido> = {
  P1: "PRIORITARIO_1", P2: "PRIORITARIO_2", P3: "PRIORITARIO_3", P4: "PRIORITARIO_4", N: "NORMAL",
};
const CODIGO_POR_PRIORIDAD = Object.fromEntries(
  Object.entries(PRIORIDAD_POR_CODIGO).map(([codigo, prioridad]) => [prioridad, codigo]),
) as Record<PrioridadPedido, PriorityCode>;

/**
 * Las fechas operativas son LocalDateTime de la zona de la operación. Se leen
 * como UTC solo para restarlas entre sí: así la zona del navegador (y sus
 * cambios de horario) no altera la diferencia.
 */
const instanteLocal = (fecha: string) => Date.parse(fecha.slice(0, 19) + "Z");
export const minutosEntre = (desde: string, hasta: string) => Math.floor((instanteLocal(hasta) - instanteLocal(desde)) / 60_000);

/** Fecha y hora de un instante en la zona indicada, sin depender de la zona del navegador. */
export function fechaEnZona(instante: string, zona: string): Date {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(instante));
  const p = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((x) => x.type === tipo)?.value);
  return new Date(p("year"), p("month") - 1, p("day"), p("hour"), p("minute"));
}

/**
 * Relojes de la operación: lo simulado sale del motor (fechaHoraOperativa, que
 * puede ir por detrás mientras planifica) y lo real del reloj del servidor.
 */
export function vistaOperacionToClock(v: VistaOperacion): OpsClock {
  return {
    simTime: new Date(v.fechaHoraOperativa),
    simElapsedMinutes: Math.max(0, minutosEntre(v.fechaHoraInicio, v.fechaHoraOperativa)),
    now: fechaEnZona(v.horaServidor, v.zonaHoraria),
    realElapsedMinutes: v.minutosTranscurridos,
  };
}

/** "2026-10-28T14:05:00" → "28/10 14:05", sin pasar por la zona del navegador. */
export const formatoFechaOperativa = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)} ${fecha.slice(11, 16)}`;

/** Un pedido sigue activo mientras le quede cantidad por entregar; los incumplidos conservan su remanente. */
export const pedidoActivo = (p: VistaPedidoOperacion) => p.pendiente > 0 && p.estado !== "ENTREGADO" && p.estado !== "CANCELADO";

/**
 * A diferencia de la simulación, el backend operativo sí informa el estado.
 * PLANIFICADO tiene ruta pero aún no sale cargado, así que se muestra "en
 * almacén". En replanificación se muestra en ruta solo si alguna unidad lo
 * lleva a bordo. CANCELADO no llega a la lista: se filtra con pedidoActivo.
 */
export function pedidoOperacionToOrder(p: VistaPedidoOperacion, vehicles: Vehicle[], fechaHoraOperativa: string): Order {
  const { carrier, loaded } = carrierOf(vehicles, String(p.id));
  const status: OrderStatus =
    p.estado === "ENTREGADO" ? "entregado"
    : p.estado === "EN_TRANSITO" || p.estado === "ENTREGADO_PARCIALMENTE" || loaded ? "en_ruta"
    : p.estado === "PLANIFICADO" ? "en_almacen"
    : "por_asignar";
  return {
    id: String(p.id),
    packages: p.cantidad,
    destination: { x: p.x, y: p.y },
    priority: CODIGO_POR_PRIORIDAD[p.prioridad] ?? "N",
    minutesLeft: minutosEntre(fechaHoraOperativa, p.limite),
    status,
    vehiclePlate: carrier?.plate,
  };
}

/** El historial de incidentes es compartido: incluye las averías registradas desde cualquier sesión. */
export function incidenteToBreakdown(i: IncidenteOperacion, unidades: VistaUnidad[]): BreakdownRecord {
  const unidad = unidades.find((u) => u.codigo === i.placa);
  return {
    id: i.comandoId,
    plate: i.placa,
    vehicleKind: unidad ? KIND_POR_TIPO[unidad.tipo] : "auto",
    type: BREAKDOWN_POR_TIPO[i.tipo] ?? "T1",
    status: i.resuelto ? "resuelta" : "activa",
    when: `Desde ${formatoFechaOperativa(i.inicio)}${i.reincorporacion ? ` · vuelve ${formatoFechaOperativa(i.reincorporacion)}` : ""}`,
  };
}

export const parametrosOperacionToTrafficLight = (p: ParametrosOperacionInstantanea): TrafficLight =>
  ({ redTo: p.umbralSemaforoAmbar, amberFrom: p.umbralSemaforoAmbar, amberTo: p.umbralSemaforoVerde, greenFrom: p.umbralSemaforoVerde });

// ---- Clientes ----------------------------------------------------------------

export function clienteToClient(c: Cliente): Client {
  return {
    kind: c.tipo === "EMPRESA" ? "empresa" : "persona",
    document: c.documento,
    name: c.nombre,
    phone: c.telefono,
    contact: c.contacto ?? undefined,
    address: c.direccion,
    location: { x: c.x, y: c.y },
  };
}

export const clientToSolicitud = (c: Client): SolicitudCliente => ({
  tipo: c.kind === "empresa" ? "EMPRESA" : "PERSONA",
  documento: c.document,
  nombre: c.name,
  telefono: c.phone,
  contacto: c.kind === "empresa" ? c.contact ?? null : null,
  direccion: c.address,
  x: c.location.x,
  y: c.location.y,
});

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
