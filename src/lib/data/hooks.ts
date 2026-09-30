"use client";

/**
 * LECTURAS — punto único de conexión con el backend.
 *
 * Todas las funciones leen del store compartido (src/lib/data/store.ts),
 * que mantiene un único WebSocket + sondeo REST (solo puede haber una
 * corrida activa a la vez en el backend). Cada hook conserva su firma
 * original; lo que cambia es que ya no devuelven datos vacíos.
 *
 * Scope "live" (operaciones diarias) sigue sin conectar: el backend no
 * tiene un modo "en vivo" independiente de una corrida (ver GUIA_FLUJO_DATOS.md,
 * "Lo que el backend no ofrece hoy"). Falta decidir si esa pantalla arranca
 * una corrida DIA_A_DIA automáticamente.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as api from "@/lib/backend/api";
import type { FilaPedido } from "@/lib/backend/types";
import {
  buildSummary,
  filaPedidoToOrder,
  instantaneaToClock,
  instantaneaToMapSnapshot,
  metricasToMetrics,
  outcomePorEstado,
  parametrosToTrafficLight,
  TIPO_POR_MODO,
  vistaUnidadToVehicle,
} from "@/lib/data/adapters";
import * as store from "@/lib/data/store";
import { esFinal } from "@/lib/backend/estado";
import { DEFAULT_TRAFFIC_LIGHT } from "@/lib/constants";
import type {
  BreakdownRecord,
  BreakdownType,
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

const EMPTY_MAP: MapSnapshot = { warehouses: [], vehicles: [], blockages: [] };
const EMPTY_ORDERS: Order[] = [];
const EMPTY_BREAKDOWNS: BreakdownRecord[] = [];
const EMPTY_PLATES: VehiclePlates = { auto: [], moto: [], bicicleta: [] };

function useStoreState() {
  useEffect(() => { store.ensureStarted(); }, []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** true si la corrida activa del store es la que le corresponde a este modo de simulación. */
const matchesSim = (s: store.Store, mode: SimulationMode) => s.estado.corrida?.tipo === TIPO_POR_MODO[mode];

/** Estado de la conexión en tiempo real. "waiting" = aún no hay fuente de datos. */
export function useConnection(scope: DataScope): ConnectionState {
  const s = useStoreState();
  if (scope.kind === "live") return "waiting"; // TODO(backend): sin modo "en vivo" independiente de una corrida
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
    if (scope.kind === "live") return EMPTY_MAP; // TODO(backend)
    const active = scope.kind === "client" || matchesSim(s, scope.mode);
    return instantaneaToMapSnapshot(active ? s.estado.instantanea : null, s.almacenes);
  }, [scope, s]);
}

/** KPIs del resumen superior de operaciones diarias. */
export function useOpsKpis(): OpsKpis | null {
  return null; // TODO(backend): pantalla "operaciones diarias" pendiente
}

/** Pedidos activos: sondeo REST independiente (no viajan por WebSocket). */
export function useOrders(scope: DataScope): Order[] {
  const s = useStoreState();
  const id = scope.kind === "live" ? null : scope.kind === "client" ? s.estado.idActual : matchesSim(s, scope.mode) ? s.estado.idActual : null;
  const [filas, setFilas] = useState<FilaPedido[]>([]);

  useEffect(() => {
    if (!id) return; // la lectura de abajo ya devuelve vacío cuando no hay id
    let vivo = true;
    const ciclo = async () => {
      try {
        const pagina = await api.paginaPedidos(id, { tamano: 500, soloActivos: true });
        if (vivo) setFilas(pagina.filas);
      } catch {
        // se mantiene la última lista conocida
      }
    };
    ciclo();
    const t = setInterval(ciclo, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [id]);

  const vehicles = useMemo(() => s.estado.instantanea?.unidades.map(vistaUnidadToVehicle) ?? [], [s.estado.instantanea]);
  return useMemo(() => (id ? filas.map((f) => filaPedidoToOrder(f, vehicles)) : EMPTY_ORDERS), [id, filas, vehicles]);
}

export function useMetrics(scope: DataScope): Metrics | null {
  const s = useStoreState();
  return useMemo(() => {
    if (scope.kind === "live") return null; // TODO(backend)
    if (scope.kind === "sim" && !matchesSim(s, scope.mode)) return null;
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
    if (scope.kind === "live") return EMPTY_BREAKDOWNS; // TODO(backend)
    if (scope.kind === "sim" && !matchesSim(s, scope.mode)) return EMPTY_BREAKDOWNS;
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
    if (scope.kind === "live") return EMPTY_PLATES; // TODO(backend)
    if (scope.kind === "sim" && !matchesSim(s, scope.mode)) return EMPTY_PLATES;
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
