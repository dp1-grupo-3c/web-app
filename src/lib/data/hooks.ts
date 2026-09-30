"use client";

/**
 * LECTURAS — punto único de conexión con el backend.
 *
 * Estado actual: SIN BACKEND. Cada hook devuelve un estado vacío y estable
 * (listas vacías o null), por lo que las pantallas muestran sus estados vacíos.
 * No se generan datos de ejemplo.
 *
 * Para conectar: reemplazar el cuerpo de cada hook (fetch, polling, SSE o
 * WebSocket) manteniendo la firma y los tipos de src/lib/types.ts.
 */

import { DEFAULT_TRAFFIC_LIGHT } from "@/lib/constants";
import type {
  BreakdownRecord,
  ConnectionState,
  DataScope,
  MapSnapshot,
  Metrics,
  OpsKpis,
  Order,
  SimulationClock,
  SimulationMode,
  SimulationSummary,
  TrafficLight,
  VehiclePlates,
} from "@/lib/types";

const EMPTY_MAP: MapSnapshot = { warehouses: [], vehicles: [], blockages: [] };
const EMPTY_ORDERS: Order[] = [];
const EMPTY_BREAKDOWNS: BreakdownRecord[] = [];
const EMPTY_PLATES: VehiclePlates = { auto: [], moto: [], bicicleta: [] };

/** Estado de la conexión en tiempo real. "waiting" = aún no hay fuente de datos. */
export function useConnection(scope: DataScope): ConnectionState {
  void scope; // TODO(backend)
  return "waiting";
}

/** Almacenes, vehículos (con rutas) y bloqueos para dibujar en la retícula. */
export function useMapSnapshot(scope: DataScope): MapSnapshot {
  void scope; // TODO(backend)
  return EMPTY_MAP;
}

/** KPIs del resumen superior de operaciones diarias. */
export function useOpsKpis(): OpsKpis | null {
  return null; // TODO(backend)
}

/** Pedidos activos. En el alcance "client" deben ser solo los del cliente. */
export function useOrders(scope: DataScope): Order[] {
  void scope; // TODO(backend)
  return EMPTY_ORDERS;
}

export function useMetrics(scope: DataScope): Metrics | null {
  void scope; // TODO(backend)
  return null;
}

/** Averías recientes (activas y resueltas). */
export function useBreakdowns(scope: DataScope): BreakdownRecord[] {
  void scope; // TODO(backend)
  return EMPTY_BREAKDOWNS;
}

/** Placas disponibles para registrar averías, agrupadas por tipo de vehículo. */
export function useVehiclePlates(scope: DataScope): VehiclePlates {
  void scope; // TODO(backend)
  return EMPTY_PLATES;
}

/** Rangos del semáforo guardados para operaciones diarias. */
export function useSavedTrafficLight(): TrafficLight {
  return DEFAULT_TRAFFIC_LIGHT; // TODO(backend): valor persistido
}

/**
 * Avance de la simulación en curso. `summary` llega cuando la simulación
 * termina (éxito, colapso o después de una cancelación).
 */
export function useSimulationFeed(mode: SimulationMode): { clock: SimulationClock | null; summary: SimulationSummary | null } {
  void mode; // TODO(backend)
  return { clock: null, summary: null };
}
