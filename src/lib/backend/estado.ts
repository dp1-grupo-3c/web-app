/**
 * Reducer que combina los mensajes del WebSocket y las respuestas del
 * sondeo REST en un único estado por corrida, aplicando las reglas de
 * descarte del contrato (filtrar por id, quedarse con la fotografía más
 * nueva). Ver GUIA_FLUJO_DATOS.md § "Reglas y trampas".
 */

import type { DetalleCorrida, EstadoCorrida, InstantaneaSimulacion, MensajeVisualizador, ResultadoSimulacion, ResumenCorrida } from "./types";

export interface EstadoSim {
  idActual: string | null;
  corrida: ResumenCorrida | null;
  instantanea: InstantaneaSimulacion | null;
  resultado: ResultadoSimulacion | null;
  averias: string[];
}

export const inicial: EstadoSim = { idActual: null, corrida: null, instantanea: null, resultado: null, averias: [] };

export type Accion =
  | { t: "ws"; m: MensajeVisualizador }
  | { t: "detalle"; d: DetalleCorrida }
  | { t: "seleccionar"; id: string };

const masNueva = (a: InstantaneaSimulacion | null, b: InstantaneaSimulacion | null) =>
  !b ? a : !a || b.minutoSimulado >= a.minutoSimulado ? b : a;

export function reducir(s: EstadoSim, a: Accion): EstadoSim {
  switch (a.t) {
    case "seleccionar":
      return a.id === s.idActual ? s : { ...inicial, idActual: a.id };
    case "ws": {
      const { tipo, corrida: id, carga } = a.m;
      if (tipo === "corrida") {
        return id === s.idActual ? { ...s, corrida: carga } : { ...inicial, idActual: id, corrida: carga };
      }
      if (id !== s.idActual) return s;
      if (tipo === "instantanea") return { ...s, instantanea: masNueva(s.instantanea, carga) };
      return { ...s, resultado: carga };
    }
    case "detalle": {
      if (a.d.corrida.id !== s.idActual) return s;
      return {
        ...s,
        corrida: a.d.corrida,
        averias: a.d.averias,
        instantanea: masNueva(s.instantanea, a.d.instantanea),
        resultado: a.d.resultado ?? s.resultado,
      };
    }
  }
}

export const esFinal = (e?: EstadoCorrida) =>
  e === "CULMINADA" || e === "CANCELADA" || e === "COLAPSADA" || e === "FALLIDA";
