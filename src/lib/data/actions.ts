/**
 * ACCIONES (comandos hacia el backend).
 *
 * Delegan en src/lib/data/store.ts, que mantiene el WebSocket y el sondeo
 * REST compartidos. `registerOrder` devuelve un error: el backend no tiene
 * ningún endpoint para crear pedidos (solo los trae el dataset del
 * escenario), así que no hay nada real que llamar todavía.
 *
 * Pausar y cambiar la velocidad se quitaron: el backend no los soporta
 * (ver GUIA_FLUJO_DATOS.md, "Lo que el backend no ofrece hoy").
 */

import * as store from "@/lib/data/store";
import type { BreakdownType, Coord, PriorityCode, SimulationMode, TrafficLight } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

export type NewOrderInput = {
  clientCode: string;
  clientName: string;
  clientPhone: string;
  destination: Coord;
  packages: number;
  priority: PriorityCode;
};

export type NewBreakdownInput = { plate: string; type: BreakdownType };

export type StartSimulationInput = { mode: SimulationMode; startDate: string; trafficLight: TrafficLight };

/** Sin endpoint en el backend: los pedidos vienen fijos del escenario de la corrida. */
export async function registerOrder(input: NewOrderInput): Promise<ActionResult<{ orderId: string }>> {
  void input;
  return { ok: false, message: "El registro de pedidos aún no está disponible. El pedido no se ha guardado." };
}

const BREAKDOWN_TIPO: Record<BreakdownType, 1 | 2 | 3> = { T1: 1, T2: 2, T3: 3 };
export const registerBreakdown = (input: NewBreakdownInput) => store.registrarAveria(input.plate, BREAKDOWN_TIPO[input.type]);

export const uploadBreakdownFile = (file: File) => store.cargarAveriasMasivo(file);

export const saveTrafficLight = (value: TrafficLight) => store.guardarSemaforo(value);

export const startSimulation = (input: StartSimulationInput) => store.arrancar(input.mode, { startDate: input.startDate, trafficLight: input.trafficLight });

export const cancelSimulation = () => store.cancelar();

/** Olvida la corrida terminada del lado del cliente para poder configurar una nueva (no llama al backend). */
export const forgetSimulation = () => store.olvidarCorrida();
