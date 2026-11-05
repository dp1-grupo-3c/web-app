/**
 * ACCIONES (comandos hacia el backend).
 *
 * Las de simulación delegan en src/lib/data/store.ts; las de la operación
 * diaria, en src/lib/data/operacion.ts (/api/operaciones), que espera a que
 * cada comando quede APLICADO o RECHAZADO antes de responder.
 *
 * Pausar y cambiar la velocidad se quitaron: el backend no los soporta
 * (ver GUIA_FLUJO_DATOS.md, "Lo que el backend no ofrece hoy").
 */

import * as clientes from "@/lib/data/clientes";
import * as operacion from "@/lib/data/operacion";
import * as store from "@/lib/data/store";
import type { BreakdownType, Client, Coord, FleetSettings, PriorityCode, SimSettings, SimulationMode, TrafficLight } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };

export type NewOrderInput = {
  clientCode: string;
  clientName: string;
  clientPhone: string;
  address: string;
  destination: Coord;
  packages: number;
  priority: PriorityCode;
};

export type NewBreakdownInput = { plate: string; type: BreakdownType };

/** `settings` y `fleet` son opcionales: sin ellos se inicia como antes. */
export type StartSimulationInput = { mode: SimulationMode; startDate: string; trafficLight: TrafficLight; settings?: SimSettings; fleet?: FleetSettings };

const BREAKDOWN_TIPO: Record<BreakdownType, 1 | 2 | 3> = { T1: 1, T2: 2, T3: 3 };

// ---- Simulación ----------------------------------------------------------------

export const registerBreakdown = (input: NewBreakdownInput) => store.registrarAveria(input.plate, BREAKDOWN_TIPO[input.type]);

export const uploadBreakdownFile = (file: File) => store.cargarAveriasMasivo(file);

/** Cantidad y velocidad por tipo de vehículo; la cantidad depende de un endpoint pendiente (ver store.guardarFlota). */
export const saveFleet = (next: FleetSettings, previous: FleetSettings) => store.guardarFlota(next, previous);

export const startSimulation = ({ mode, ...input }: StartSimulationInput) => store.arrancar(mode, input);

export const cancelSimulation = (expectedId?: string) => store.cancelar(expectedId);

/** Olvida la corrida terminada del lado del cliente para poder configurar una nueva (no llama al backend). */
export const forgetSimulation = () => store.olvidarCorrida();

// ---- Operación diaria ----------------------------------------------------------

export const startOperation = () => operacion.iniciar();

export const stopOperation = (expectedId: string) => operacion.detener(expectedId);

/** Alta en la operación en curso. `orderId` falta si el comando sigue en cola al vencer la espera. */
export const registerOrder = (input: NewOrderInput): Promise<ActionResult<{ orderId?: string }>> => operacion.registrarPedido(input);

export const registerOperationBreakdown = (input: NewBreakdownInput) => operacion.registrarAveria(input.plate, BREAKDOWN_TIPO[input.type]);

export const saveOperationTrafficLight = (value: TrafficLight) => operacion.guardarSemaforo(value);

// ---- Clientes ------------------------------------------------------------------

export const registerClient = (client: Client) => clientes.registrar(client);

/** El documento y el tipo no cambian: identifican al cliente. */
export const updateClient = (client: Client) => clientes.actualizar(client);

/** `data` es null si el documento no está registrado. */
export const findClient = (document: string) => clientes.buscar(document);
