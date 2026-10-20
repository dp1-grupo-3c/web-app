"use client";

import { useEffect, useRef, useState } from "react";
import type { Coord, Vehicle } from "@/lib/types";

/**
 * Transición corta entre fotografías: el vehículo recorre en unos cientos de
 * milisegundos el tramo que avanzó entre una fotografía y la siguiente, y luego
 * se queda quieto hasta la próxima. No es un movimiento continuo: solo evita el
 * salto brusco de una intersección a otra.
 */
const MAX_MS = 650;
const MIN_MS = 150;
/** Fracción del intervalo entre fotografías que dura la transición (el resto queda en reposo). */
const SHARE = 0.6;
/** Un salto mayor (p. ej. cambio de corrida) no se anima. */
const MAX_JUMP = 40;

type Track = { pts: Coord[]; lengths: number[]; total: number; start: number; duration: number };

const same = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;
const dist = (a: Coord, b: Coord) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Tramo entre la posición mostrada y la nueva, siguiendo las calles: se toma
 * del camino recorrido lo que hay después de la posición anterior, para que el
 * vehículo doble en las esquinas en vez de cortar en diagonal.
 */
function pathBetween(shown: Coord, prev: Coord | undefined, v: Vehicle): Coord[] {
  const traveled = v.route?.traveled ?? [];
  let from = -1;
  if (prev) for (let i = traveled.length - 1; i >= 0; i--) if (same(traveled[i], prev)) { from = i; break; }
  const middle = from >= 0 ? traveled.slice(from + 1).filter((c) => !same(c, v.position)) : [];
  return [shown, ...middle, v.position];
}

function pointAt(t: Track, progress: number): Coord {
  let d = t.total * progress;
  for (let i = 0; i < t.lengths.length; i++) {
    if (d <= t.lengths[i] || i === t.lengths.length - 1) {
      const k = t.lengths[i] ? Math.min(1, d / t.lengths[i]) : 1;
      const a = t.pts[i], b = t.pts[i + 1];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    d -= t.lengths[i];
  }
  return t.pts[t.pts.length - 1];
}

/** Posición a dibujar de cada vehículo (coordenadas fraccionarias durante la transición). */
export function useVehicleMotion(vehicles: Vehicle[]): Record<string, Coord> {
  const [shown, setShown] = useState<Record<string, Coord>>({});
  const shownRef = useRef(shown);
  const targets = useRef<Record<string, Coord>>({});
  const tracks = useRef<Record<string, Track>>({});
  const lastChange = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    const now = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = lastChange.current ? now - lastChange.current : MAX_MS / SHARE;
    const duration = Math.max(MIN_MS, Math.min(MAX_MS, interval * SHARE));
    const next: Record<string, Coord> = {};
    let moved = false;

    for (const v of vehicles) {
      const prev = targets.current[v.id];
      const current = shownRef.current[v.id] ?? v.position;
      if (prev && same(prev, v.position)) { next[v.id] = current; continue; }
      if (reduced || !prev || dist(current, v.position) > MAX_JUMP) {
        delete tracks.current[v.id];
        next[v.id] = v.position;
        continue;
      }
      const pts = pathBetween(current, prev, v);
      const lengths = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
      tracks.current[v.id] = { pts, lengths, total: lengths.reduce((a, b) => a + b, 0), start: now, duration };
      next[v.id] = current;
      moved = true;
    }
    targets.current = Object.fromEntries(vehicles.map((v) => [v.id, v.position]));
    for (const id of Object.keys(tracks.current)) if (!(id in targets.current)) delete tracks.current[id];
    if (moved) lastChange.current = now;

    const step = (t: number) => {
      const out: Record<string, Coord> = { ...next };
      let pending = false;
      for (const [id, track] of Object.entries(tracks.current)) {
        const p = Math.min(1, (t - track.start) / track.duration);
        out[id] = pointAt(track, easeOut(p));
        if (p < 1) pending = true;
        else delete tracks.current[id];
      }
      shownRef.current = out;
      setShown(out);
      if (pending) frame.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(frame.current);
    step(now);
    return () => cancelAnimationFrame(frame.current);
  }, [vehicles]);

  return shown;
}
