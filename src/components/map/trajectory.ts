import type { Coord, Vehicle } from "@/lib/types";

export type Track = { points: Coord[]; lengths: number[]; total: number; start: number; duration: number };
export const samePoint = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

const compact = (points: Coord[]) => points.filter((p, i) => !i || !samePoint(p, points[i - 1]));
const onRoad = (points: Coord[]) => points.every((p, i) => !i || p.x === points[i - 1].x || p.y === points[i - 1].y);

/** Recupera el movimiento de las geometrías publicadas, nunca inventa una diagonal. */
export function routeBetween(previous: Vehicle, next: Vehicle): Coord[] | null {
  if (samePoint(previous.position, next.position)) return [next.position];
  const traveled = next.route?.traveled ?? [];
  const pending = previous.route?.pending ?? [];
  const candidates = [traveled, pending];
  // Una replanificación puede reemplazar el camino recorrido: enlazar las
  // geometrías en el origen del nuevo itinerario si aparece en el anterior.
  const origin = traveled[0];
  if (origin) {
    const join = pending.findIndex((p) => samePoint(p, origin));
    if (join >= 0) candidates.push([...pending.slice(0, join), ...traveled]);
  }
  for (const points of candidates) {
    for (let from = points.length - 1; from >= 0; from--) {
      if (!samePoint(points[from], previous.position)) continue;
      const to = points.findIndex((p, i) => i > from && samePoint(p, next.position));
      if (to < 0) continue;
      const path = compact(points.slice(from, to + 1));
      if (onRoad(path)) return path;
    }
  }
  return null;
}

export function makeTrack(points: Coord[], start: number, duration: number): Track {
  const path = compact(points);
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
  return { points: path, lengths, total: lengths.reduce((sum, n) => sum + n, 0), start, duration };
}

/** Velocidad uniforme por distancia: no frenar artificialmente en cada instantánea. */
export function trackAt(track: Track, now: number): { position: Coord; remaining: Coord[]; done: boolean } {
  const progress = Math.min(1, Math.max(0, (now - track.start) / track.duration));
  let distance = track.total * progress;
  for (let i = 0; i < track.lengths.length; i++) {
    if (distance <= track.lengths[i] || i === track.lengths.length - 1) {
      const ratio = track.lengths[i] ? Math.min(1, distance / track.lengths[i]) : 1;
      const a = track.points[i], b = track.points[i + 1];
      const position = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
      return { position, remaining: compact([position, ...track.points.slice(i + 1)]), done: progress >= 1 };
    }
    distance -= track.lengths[i];
  }
  const position = track.points[track.points.length - 1];
  return { position, remaining: [position], done: true };
}

/** Ruta pendiente visual: comienza en el marcador interpolado, no en su futuro destino. */
export function pendingFromShown(shown: Coord, vehicle: Vehicle, remaining?: Coord[]): Coord[] {
  const pending = vehicle.route?.pending ?? [];
  const tail = remaining ?? [shown];
  if (pending.length && !samePoint(tail[tail.length - 1], pending[0])) return remaining ?? [];
  return compact([...tail, ...pending]);
}
