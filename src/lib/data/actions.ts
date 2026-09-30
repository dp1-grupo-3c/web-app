/**
 * ACCIONES (comandos hacia el backend).
 *
 * Estado actual: SIN BACKEND. Cada acción solo registra en consola lo que se
 * enviaría y responde { ok: true } para que los flujos de pantalla se puedan
 * recorrer. No modifica datos.
 *
 * Para conectar: implementar la llamada real y devolver { ok: false, message }
 * con un texto amable si el servidor rechaza la operación.
 */

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

async function notConnected<T>(action: string, payload?: unknown): Promise<ActionResult<T>> {
  console.info(`[KindBox] "${action}" aún no está conectado al backend.`, payload ?? "");
  return { ok: true };
}

export const registerOrder = (input: NewOrderInput) => notConnected<{ orderId: string }>("registerOrder", input);

export const registerBreakdown = (input: NewBreakdownInput) => notConnected("registerBreakdown", input);

export const uploadBreakdownFile = (file: File) =>
  notConnected<{ registered: number }>("uploadBreakdownFile", { name: file.name, size: file.size });

export const saveTrafficLight = (value: TrafficLight) => notConnected("saveTrafficLight", value);

export const startSimulation = (input: StartSimulationInput) => notConnected("startSimulation", input);

export const setSimulationPaused = (mode: SimulationMode, paused: boolean) =>
  notConnected("setSimulationPaused", { mode, paused });

export const setSimulationSpeed = (mode: SimulationMode, speed: number) =>
  notConnected("setSimulationSpeed", { mode, speed });

export const cancelSimulation = (mode: SimulationMode) => notConnected("cancelSimulation", { mode });
