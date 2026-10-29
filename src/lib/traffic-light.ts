import { TRAFFIC_LIGHT_MAX } from "./constants";
import type { StatusTone, TrafficLight } from "./types";

export type TrafficLightKey = keyof TrafficLight;

/** Los límites contiguos se enlazan: verde.desde = ámbar.hasta y ámbar.desde = rojo.hasta. */
const LINKED: Record<TrafficLightKey, TrafficLightKey> = {
  greenFrom: "amberTo",
  amberTo: "greenFrom",
  amberFrom: "redTo",
  redTo: "amberFrom",
};

/** NaN marca un límite que el usuario dejó vacío o con un valor inválido (se conserva para bloquear el guardado). */
export function setLimit(value: TrafficLight, key: TrafficLightKey, n: number): TrafficLight {
  const v = Number.isNaN(n) ? NaN : Math.max(0, Math.min(TRAFFIC_LIGHT_MAX, Math.round(n)));
  return { ...value, [key]: v, [LINKED[key]]: v };
}

export const linkedKey = (key: TrafficLightKey) => LINKED[key];

/** Devuelve un mensaje de error amable o null si los rangos son válidos. */
export function validateTrafficLight(t: TrafficLight): { message: string; keys: TrafficLightKey[] } | null {
  const bad = (Object.keys(LINKED) as TrafficLightKey[]).filter((k) => !Number.isInteger(t[k]));
  if (bad.length)
    return { message: `Completa los límites con números enteros de 0 a ${TRAFFIC_LIGHT_MAX}.`, keys: bad };
  if (!(t.redTo > 0 && t.redTo < t.amberTo))
    return { message: `El límite del rojo debe estar entre 1 y ${t.amberTo - 1}.`, keys: ["redTo", "amberFrom"] };
  if (!(t.amberTo < TRAFFIC_LIGHT_MAX))
    return { message: `El límite del ámbar debe ser menor que ${TRAFFIC_LIGHT_MAX}.`, keys: ["amberTo", "greenFrom"] };
  return null;
}

export function warehouseTone(stock: number, t: TrafficLight): StatusTone {
  if (stock >= t.greenFrom) return "ok";
  if (stock > t.redTo) return "warn";
  return "crit";
}

export const sameTrafficLight = (a: TrafficLight, b: TrafficLight) =>
  a.greenFrom === b.greenFrom && a.amberFrom === b.amberFrom && a.amberTo === b.amberTo && a.redTo === b.redTo;

/** Estado de una prioridad según qué parte del plazo consume el tiempo promedio. */
export function deliveryTone(avgMinutes: number, plazoHours: number): { tone: StatusTone; ratio: number } {
  const ratio = avgMinutes / (plazoHours * 60);
  return { ratio, tone: ratio < 0.7 ? "ok" : ratio <= 1 ? "warn" : "crit" };
}
export const DELIVERY_TONE_LABEL: Record<StatusTone, string> = {
  ok: "A tiempo",
  warn: "Cerca del límite",
  crit: "Excede el plazo",
};
