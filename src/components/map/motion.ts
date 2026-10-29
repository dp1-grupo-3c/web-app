"use client";

import { useEffect, useRef, useState } from "react";
import type { Coord, MotionSample, Vehicle } from "@/lib/types";
import { makeTrack, routeBetween, samePoint, trackAt, type Track } from "./trajectory";

export type VehicleMotion = { positions: Record<string, Coord>; remaining: Record<string, Coord[]> };

/**
 * Reproduce el trayecto observado durante el intervalo completo entre muestras,
 * con un retraso visual de una muestra. No extrapola movimiento sin confirmar.
 * REST/WS duplicados y cambios ajenos al mapa no reinician las animaciones.
 */
export function useVehicleMotion(vehicles: Vehicle[], sample?: MotionSample): VehicleMotion {
  const [motion, setMotion] = useState<VehicleMotion>({ positions: {}, remaining: {} });
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
      setMotion({ positions, remaining });
      if (Object.keys(tracks.current).length) frame.current = requestAnimationFrame(tick);
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
    if (reset) { tracks.current = {}; shown.current = {}; previous.current = {}; }

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
  }, [vehicles, sample]);

  return motion;
}
