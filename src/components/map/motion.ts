"use client";

import { useEffect, useRef, useState } from "react";
import type { Blockage, Coord, MotionSample, Vehicle } from "@/lib/types";
import { makeTrack, routeBetween, samePoint, trackAt, type Track } from "./trajectory";

/**
 * `minute`: minuto simulado que la animación está mostrando, entre la muestra
 * anterior y la actual. `blockages`: bloqueos de ambas muestras, para filtrarlos
 * por ese minuto; así un bloqueo aparece cuando la animación llega a su inicio y
 * no mientras el vehículo todavía recorre, en pantalla, el tramo previo.
 */
export type VehicleMotion = {
  positions: Record<string, Coord>;
  remaining: Record<string, Coord[]>;
  minute?: number;
  blockages: Blockage[];
};

/** Identidad de un bloqueo entre muestras: el índice que trae cada foto no es estable. */
export const blockageKey = (b: Blockage) => `${b.startMinute}:${b.endMinute}:${(b.path ?? [b.from, b.to]).map((c) => `${c.x},${c.y}`).join(";")}`;

type MinuteWindow = { from: number; to: number; start: number; duration: number };
const minuteAt = (w: MinuteWindow | null, now: number) =>
  !w ? undefined : w.from + (w.to - w.from) * Math.min(1, Math.max(0, (now - w.start) / w.duration));

/**
 * Reproduce el trayecto observado durante el intervalo completo entre muestras,
 * con un retraso visual de una muestra. No extrapola movimiento sin confirmar.
 * REST/WS duplicados y cambios ajenos al mapa no reinician las animaciones.
 */
export function useVehicleMotion(vehicles: Vehicle[], sample?: MotionSample, blockages: Blockage[] = []): VehicleMotion {
  const [motion, setMotion] = useState<VehicleMotion>({ positions: {}, remaining: {}, blockages: [] });
  const minuteWindow = useRef<MinuteWindow | null>(null);
  const shownBlockages = useRef<Blockage[]>([]);
  const lastBlockages = useRef<Blockage[]>([]);
  const shown = useRef<Record<string, Coord>>({});
  const previous = useRef<Record<string, Vehicle>>({});
  const tracks = useRef<Record<string, Track>>({});
  const lastSample = useRef<MotionSample | undefined>(undefined);
  const lastArrival = useRef(0);
  const frame = useRef(0);
  const initialized = useRef(false);
  const wakeRef = useRef<() => void>(() => {});

  // Un solo bucle RAF; los cambios de props no cancelan tramos en curso.
  useEffect(() => {
    let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      const positions = { ...shown.current };
      const remaining: Record<string, Coord[]> = {};
      for (const [id, track] of Object.entries(tracks.current)) {
        const value = trackAt(track, now);
        positions[id] = value.position;
        remaining[id] = value.remaining;
        if (value.done) delete tracks.current[id];
      }
      shown.current = positions;
      const w = minuteWindow.current;
      setMotion({ positions, remaining, minute: minuteAt(w, now), blockages: shownBlockages.current });
      const windowOpen = !!w && now < w.start + w.duration;
      if (Object.keys(tracks.current).length || windowOpen) frame.current = requestAnimationFrame(tick);
      else frame.current = 0;
    };
    const wake = () => { if (!frame.current) frame.current = requestAnimationFrame(tick); };
    wakeRef.current = wake;
    wake();
    return () => { alive = false; cancelAnimationFrame(frame.current); frame.current = 0; };
  }, []);

  useEffect(() => {
    const before = lastSample.current;
    if (sample && before && sample.runId === before.runId && sample.simulatedMinute === before.simulatedMinute) return;
    const now = performance.now();
    const reset = !initialized.current || sample?.runId !== before?.runId ||
      (sample && before && sample.simulatedMinute < before.simulatedMinute);
    // Con buffer, la reproducción fija la duración de cada transición; sin él,
    // se usa el tiempo real entre muestras.
    const elapsed = sample?.durationMs || (sample && before ? sample.realMilliseconds - before.realMilliseconds : now - lastArrival.current);
    const duration = elapsed > 0 ? elapsed : 1000;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reset) { tracks.current = {}; shown.current = {}; previous.current = {}; lastBlockages.current = []; }

    // Bloqueos: la animación recorre [muestra anterior, muestra actual], así que se
    // ofrecen los de ambas y GridMap muestra los vigentes en el minuto animado.
    const union = new Map<string, Blockage>();
    for (const b of [...lastBlockages.current, ...blockages]) union.set(blockageKey(b), { ...b, id: blockageKey(b) });
    shownBlockages.current = [...union.values()];
    lastBlockages.current = blockages;
    minuteWindow.current = sample && before && !reset && !reduced
      ? { from: before.simulatedMinute, to: sample.simulatedMinute, start: now, duration }
      : sample ? { from: sample.simulatedMinute, to: sample.simulatedMinute, start: now, duration: 0 } : null;

    const ids = new Set(vehicles.map((v) => v.id));
    for (const id of Object.keys(previous.current)) if (!ids.has(id)) {
      delete previous.current[id]; delete tracks.current[id]; delete shown.current[id];
    }
    for (const vehicle of vehicles) {
      const prev = previous.current[vehicle.id];
      if (!prev || reduced) {
        shown.current[vehicle.id] = vehicle.position;
        delete tracks.current[vehicle.id];
        previous.current[vehicle.id] = vehicle;
        continue;
      }
      const track = tracks.current[vehicle.id];
      const tail = track ? trackAt(track, now).remaining : [shown.current[vehicle.id] ?? prev.position];
      const path = routeBetween(prev, vehicle);
      if (path) {
        const points = [...tail, ...path.slice(1)];
        if (points.length > 1 && !points.every((p) => samePoint(p, points[0]))) {
          tracks.current[vehicle.id] = makeTrack(points, now, duration);
        } else {
          shown.current[vehicle.id] = vehicle.position;
          delete tracks.current[vehicle.id];
        }
        previous.current[vehicle.id] = vehicle;
      }
      // Si falta geometría, conservar la última posición verificable. No
      // atravesar calles/bloqueos con una recta ni inventar una trayectoria.
    }
    initialized.current = true;
    lastSample.current = sample;
    lastArrival.current = now;
    wakeRef.current();
  }, [vehicles, sample, blockages]);

  return motion;
}
