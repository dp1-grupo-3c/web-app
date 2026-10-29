"use client";

/**
 * LECTURAS — punto único de conexión con el backend.
 *
 * Todas las funciones leen del store compartido (src/lib/data/store.ts),
 * que mantiene un único WebSocket + sondeo REST (solo puede haber una
 * corrida activa a la vez en el backend). Cada hook conserva su firma
 * original; lo que cambia es que ya no devuelven datos vacíos.
 *
 * La operación diaria tiene su propio store (src/lib/data/operacion.ts) y
 * sus hooks al final de este archivo.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as api from "@/lib/backend/api";
import type { FilaPedido, VistaUnidad } from "@/lib/backend/types";
import {
  buildSummary,
  filaPedidoToOrder,
  incidenteToBreakdown,
  instantaneaToClock,
  instantaneaToMapSnapshot,
  metricasToMetrics,
  outcomePorEstado,
  parametrosOperacionToTrafficLight,
  parametrosToTrafficLight,
  pedidoActivo,
  pedidoOperacionToOrder,
  TIPO_POR_MODO,
  vistaUnidadToVehicle,
} from "@/lib/data/adapters";
import * as clientes from "@/lib/data/clientes";
import * as operacion from "@/lib/data/operacion";
import * as store from "@/lib/data/store";
import { esFinal } from "@/lib/backend/estado";
import { DEFAULT_TRAFFIC_LIGHT } from "@/lib/constants";
import type {
  BreakdownRecord,
  BreakdownType,
  Client,
  ConnectionState,
  DataScope,
  MapSnapshot,
  Metrics,
  OpsKpis,
  Order,
  SimulationClock,
  SimulationMode,
  SimulationOutcome,
  SimulationSummary,
  TrafficLight,
  VehiclePlates,
} from "@/lib/types";

const EMPTY_ORDERS: Order[] = [];
const EMPTY_BREAKDOWNS: BreakdownRecord[] = [];
const EMPTY_PLATES: VehiclePlates = { auto: [], moto: [], bicicleta: [] };

function useStoreState() {
  useEffect(() => { store.ensureStarted(); }, []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** true si la corrida activa del store es la que le corresponde a este modo de simulación. */
const matchesSim = (s: store.Store, mode: SimulationMode) => s.estado.corrida?.tipo === TIPO_POR_MODO[mode];
const matchesScope = (s: store.Store, scope: DataScope) => scope.kind === "client"
  || (scope.kind === "live" ? s.estado.corrida?.tipo === "DIA_A_DIA" : matchesSim(s, scope.mode));

/**
 * Corrida actual del backend, sea del tipo que sea: solo hay una a la vez.
 * Al montar la pantalla vuelve a consultar /salud para no depender de lo que
 * el store supiera antes de navegar.
 */
export function useActiveRun() {
  const s = useStoreState();
  useEffect(() => { store.sincronizarActiva(); }, []);
  const corrida = s.estado.corrida;
  return {
    id: s.estado.idActual,
    corrida,
    running: !!s.estado.idActual && !esFinal(corrida?.estado),
  };
}

/** Estado de la conexión en tiempo real. "waiting" = aún no hay fuente de datos. */
export function useConnection(scope: DataScope): ConnectionState {
  const s = useStoreState();
  if (!matchesScope(s, scope)) return "waiting";
  if (!s.estado.corrida) return s.canal === "desconectado" ? "offline" : "waiting";
  if (s.canal === "conectado") return "live";
  if (s.canal === "reconectando") return "reconnecting";
  if (s.canal === "desconectado") return "offline";
  return "waiting";
}

/** Almacenes, vehículos (con rutas) y bloqueos para dibujar en la retícula. */
export function useMapSnapshot(scope: DataScope): MapSnapshot {
  const s = useStoreState();
  return useMemo(() => {
    const active = matchesScope(s, scope);
    return instantaneaToMapSnapshot(active ? s.estado.instantanea : null, active ? (s.estado.instantanea?.almacenes ?? s.almacenes) : s.almacenes, active ? s.estado.idActual : null);
  }, [scope, s]);
}

/** KPIs del resumen superior de operaciones diarias. */
export function useOpsKpis(): OpsKpis | null {
  const s = useStoreState();
  const i = s.estado.instantanea;
  const c = s.estado.corrida;
  if (c?.tipo !== "DIA_A_DIA" || !i) return null;
  return {
    fleet: { auto: c.unidadesActivasPorTipo.AUTO, moto: c.unidadesActivasPorTipo.MOTO, bicicleta: c.unidadesActivasPorTipo.BICICLETA },
    activeOrders: i.metricas.pedidosPendientes + i.metricas.pedidosIncumplidos,
    deliveredToday: i.metricas.pedidosEntregados,
    alerts: i.unidades.filter((u) => u.tipoAveria > 0).length,
  };
}

/** Pedidos activos: sondeo REST independiente (no viajan por WebSocket). */
export function useOrders(scope: DataScope): Order[] {
  const s = useStoreState();
  const id = matchesScope(s, scope) ? s.estado.idActual : null;
  const [result, setResult] = useState<{ id: string; filas: FilaPedido[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    const ciclo = async () => {
      try {
        // Completar la lista: los destinos del vehículo seleccionado pueden
        // pertenecer a páginas posteriores a los primeros 500 pedidos.
        const first = await api.paginaPedidos(id, { pagina: 0, tamano: 500, soloActivos: true });
        const filas = [...first.filas];
        for (let page = 1; vivo && page < first.totalPaginas; page++) {
          const next = await api.paginaPedidos(id, { pagina: page, tamano: 500, soloActivos: true });
          filas.push(...next.filas);
        }
        if (vivo) setResult({ id, filas: [...new Map(filas.map((f) => [f.id, f])).values()] });
      } catch {
        // se mantiene la última lista conocida
      } finally {
        if (vivo) timer = setTimeout(ciclo, 3000);
      }
    };
    ciclo();
    return () => { vivo = false; clearTimeout(timer); };
  }, [id]);

  const vehicles = useMemo(() => s.estado.instantanea?.unidades.map(vistaUnidadToVehicle) ?? [], [s.estado.instantanea]);
  return useMemo(() => (id && result?.id === id ? result.filas.map((f) => filaPedidoToOrder(f, vehicles)) : EMPTY_ORDERS), [id, result, vehicles]);
}

export function useMetrics(scope: DataScope): Metrics | null {
  const s = useStoreState();
  return useMemo(() => {
    if (!matchesScope(s, scope)) return null;
    const m = s.estado.instantanea?.metricas ?? s.estado.resultado?.metricas;
    return m ? metricasToMetrics(m) : null;
  }, [scope, s]);
}

/**
 * Averías recientes. El backend no expone un listado estructurado (solo
 * texto libre en el detalle de la corrida), así que se reconstruye con las
 * respuestas reales de cada registro hecho desde esta sesión — no incluye
 * averías cargadas antes de conectarse ni las de la carga masiva.
 */
export function useBreakdowns(scope: DataScope): BreakdownRecord[] {
  const s = useStoreState();
  return useMemo(() => {
    if (!matchesScope(s, scope)) return EMPTY_BREAKDOWNS;
    const minuto = s.estado.instantanea?.minutoSimulado ?? 0;
    const unidades = s.estado.instantanea?.unidades ?? [];
    return s.averiasSesion.map((r, i): BreakdownRecord => {
      const unidad = unidades.find((u) => u.codigo === r.placa);
      return {
        id: `${r.placa}-${r.minutoSimulado}-${i}`,
        plate: r.placa,
        vehicleKind: unidad ? vistaUnidadToVehicle(unidad).kind : "auto",
        type: (["T1", "T2", "T3"][r.tipo - 1] ?? "T1") as BreakdownType,
        status: minuto >= r.minutoReincorporacion ? "resuelta" : "activa",
        when: `Minuto ${r.minutoSimulado} de la simulación`,
      };
    });
  }, [scope, s]);
}

/** Placas disponibles para registrar averías, agrupadas por tipo de vehículo. */
export function useVehiclePlates(scope: DataScope): VehiclePlates {
  const s = useStoreState();
  return useMemo(() => {
    if (!matchesScope(s, scope)) return EMPTY_PLATES;
    const plates: VehiclePlates = { auto: [], moto: [], bicicleta: [] };
    for (const u of s.estado.instantanea?.unidades ?? []) {
      if (u.tipoAveria === 0) plates[vistaUnidadToVehicle(u).kind].push(u.codigo);
    }
    return plates;
  }, [scope, s]);
}

/** Rangos del semáforo guardados (global, PUT /api/parametros/semaforo). */
export function useSavedTrafficLight(): TrafficLight {
  const s = useStoreState();
  return s.parametros ? parametrosToTrafficLight(s.parametros) : DEFAULT_TRAFFIC_LIGHT;
}

/**
 * Avance de la simulación en curso. `summary` llega cuando el backend envía
 * el resultado; `outcome`/`error` quedan disponibles incluso sin resultado
 * (caso FALLIDA, donde el backend puede no enviarlo nunca).
 */
export function useSimulationFeed(mode: SimulationMode): {
  clock: SimulationClock | null;
  summary: SimulationSummary | null;
  outcome: SimulationOutcome | null;
  error: string | null;
} {
  const s = useStoreState();
  return useMemo(() => {
    if (!matchesSim(s, mode) || !s.estado.corrida) return { clock: null, summary: null, outcome: null, error: null };
    const clock = s.estado.instantanea ? instantaneaToClock(s.estado.instantanea) : null;
    const trafficLight = s.parametros ? parametrosToTrafficLight(s.parametros) : DEFAULT_TRAFFIC_LIGHT;
    const summary = s.estado.resultado ? buildSummary(s.estado.corrida, s.estado.resultado, trafficLight, s.firstLateOrder ?? undefined) : null;
    const outcome = summary?.outcome ?? (esFinal(s.estado.corrida.estado) ? outcomePorEstado(s.estado.corrida.estado) : null);
    return { clock, summary, outcome, error: s.estado.corrida.error };
  }, [s, mode]);
}

const DEMO_ORDERS = 10;

/** Orden pseudoaleatorio estable para un cliente (FNV-1a): la muestra no cambia entre consultas. */
function demoRank(clientId: string, orderId: number) {
  let h = 2166136261;
  for (const ch of `${clientId}:${orderId}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  // Mezcla final: sin ella, IDs consecutivos quedan en orden casi consecutivo.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Pedidos del cliente — SIMULADO. El backend aún no relaciona pedidos con el
 * cliente que consulta, así que se toman 10 pedidos al azar de la corrida en
 * curso (fijos para cada ID) y se sigue su estado con cada consulta.
 */
export function useClientDemoOrders(clientId: string): { orders: Order[]; running: boolean; loading: boolean } {
  const s = useStoreState();
  const id = s.estado.idActual;
  const running = !!id && !esFinal(s.estado.corrida?.estado);
  const [data, setData] = useState<{ key: string; picked: number[]; filas: FilaPedido[] } | null>(null);
  const key = `${id}:${clientId}`;

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    const ciclo = async () => {
      try {
        const pagina = await api.paginaPedidos(id, { tamano: 500, soloActivos: false });
        if (!vivo) return;
        setData((prev) => {
          // Se conservan los ya elegidos y, mientras falten, se completan con los siguientes en el orden del cliente.
          const picked = prev?.key === key ? prev.picked.filter((p) => pagina.filas.some((f) => f.id === p)) : [];
          const rest = pagina.filas.filter((f) => !picked.includes(f.id)).sort((a, b) => demoRank(clientId, a.id) - demoRank(clientId, b.id));
          picked.push(...rest.slice(0, DEMO_ORDERS - picked.length).map((f) => f.id));
          return { key, picked, filas: pagina.filas };
        });
      } catch {
        // se mantiene la última lista conocida
      }
    };
    ciclo();
    const t = setInterval(ciclo, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [id, clientId, key]);

  const vehicles = useMemo(() => s.estado.instantanea?.unidades.map(vistaUnidadToVehicle) ?? [], [s.estado.instantanea]);
  const orders = useMemo(() => {
    if (!id || data?.key !== key) return EMPTY_ORDERS;
    return data.filas.filter((f) => data.picked.includes(f.id)).map((f) => filaPedidoToOrder(f, vehicles));
  }, [id, key, data, vehicles]);
  return { orders, running, loading: !!id && data?.key !== key };
}

// ---- Operación diaria (/api/operaciones) --------------------------------------

function useOperacionState() {
  useEffect(() => { operacion.ensureStarted(); }, []);
  return useSyncExternalStore(operacion.subscribe, operacion.getSnapshot, operacion.getServerSnapshot);
}

const enServicio = (u: VistaUnidad) => u.estado !== "AVERIADA" && u.estado !== "EN_MANTENIMIENTO";

/** Operación seguida por esta sesión. `cargado` es false hasta la primera respuesta de /actual. */
export function useOperacion() {
  const s = useOperacionState();
  return { vista: s.vista, cargado: s.cargado, running: operacion.enCurso(s.vista) };
}

export function useOperacionConnection(): ConnectionState {
  const s = useOperacionState();
  if (!s.vista) return "waiting";
  if (s.canal === "conectado") return "live";
  if (s.canal === "reconectando") return "reconnecting";
  if (s.canal === "desconectado") return "offline";
  return "waiting";
}

export function useOperacionMapSnapshot(): MapSnapshot {
  const s = useOperacionState();
  return useMemo(() => {
    const i = s.vista?.instantanea ?? null;
    return instantaneaToMapSnapshot(i, i?.almacenes ?? s.almacenes, s.vista?.contextoId ?? null);
  }, [s.vista, s.almacenes]);
}

/** Pedidos activos. La vista operativa ya trae el registro completo, sin sondeo aparte. */
export function useOperacionOrders(): Order[] {
  const { vista } = useOperacionState();
  return useMemo(() => {
    if (!vista) return EMPTY_ORDERS;
    const vehicles = vista.instantanea.unidades.map(vistaUnidadToVehicle);
    return vista.pedidos.filter(pedidoActivo).map((p) => pedidoOperacionToOrder(p, vehicles, vista.fechaHoraOperativa));
  }, [vista]);
}

export function useOperacionKpis(): OpsKpis | null {
  const { vista } = useOperacionState();
  return useMemo(() => {
    if (!vista) return null;
    const fleet = { auto: 0, moto: 0, bicicleta: 0 };
    for (const u of vista.instantanea.unidades) if (enServicio(u)) fleet[vistaUnidadToVehicle(u).kind]++;
    const hoy = vista.fechaHoraOperativa.slice(0, 10);
    return {
      fleet,
      activeOrders: vista.pedidos.filter(pedidoActivo).length,
      deliveredToday: vista.pedidos.filter((p) => p.estado === "ENTREGADO" && p.transiciones.some((t) => t.estado === "ENTREGADO" && t.fechaHora.startsWith(hoy))).length,
      alerts: vista.incidentes.filter((i) => !i.resuelto).length,
    };
  }, [vista]);
}

export function useOperacionMetrics(): Metrics | null {
  const { vista } = useOperacionState();
  return useMemo(() => (vista ? metricasToMetrics(vista.instantanea.metricas) : null), [vista]);
}

/** Más recientes primero. */
export function useOperacionBreakdowns(): BreakdownRecord[] {
  const { vista } = useOperacionState();
  return useMemo(
    () => (vista ? vista.incidentes.map((i) => incidenteToBreakdown(i, vista.instantanea.unidades)).reverse() : EMPTY_BREAKDOWNS),
    [vista],
  );
}

/** El backend rechaza averías de unidades ya deshabilitadas; no se ofrecen. */
export function useOperacionPlates(): VehiclePlates {
  const { vista } = useOperacionState();
  return useMemo(() => {
    if (!vista || !operacion.enCurso(vista)) return EMPTY_PLATES;
    const plates: VehiclePlates = { auto: [], moto: [], bicicleta: [] };
    for (const u of vista.instantanea.unidades) {
      if (u.tipoAveria === 0 && enServicio(u)) plates[vistaUnidadToVehicle(u).kind].push(u.codigo);
    }
    return plates;
  }, [vista]);
}

/** Umbrales propios de la operación en curso. */
export function useOperacionTrafficLight(): TrafficLight {
  const { vista } = useOperacionState();
  return useMemo(() => (vista ? parametrosOperacionToTrafficLight(vista.parametros) : DEFAULT_TRAFFIC_LIGHT), [vista]);
}

// ---- Clientes (/api/clientes) -------------------------------------------------

/** Clientes registrados, ordenados por nombre. Se vuelven a pedir al montar el componente que los usa. */
export function useClients(): { clients: Client[]; loaded: boolean } {
  useEffect(() => { clientes.refrescar(); }, []);
  const s = useSyncExternalStore(clientes.subscribe, clientes.getSnapshot, clientes.getServerSnapshot);
  return { clients: s.clientes, loaded: s.cargado };
}
