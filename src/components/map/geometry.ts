import { GRID } from "@/lib/constants";
import type { Coord } from "@/lib/types";

export type View = { zoom: number; pan: { x: number; y: number } };
export type Geometry = { cell: number; ox: number; oy: number; width: number; height: number };

/** Márgenes: a la izquierda y abajo quedan libres los controles; arriba, el resumen (HUD). */
const INSET = { left: 104, right: 48, bottom: 84 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function computeGeometry(width: number, height: number, top: number, view: View): Geometry {
  const w = width - INSET.left - INSET.right;
  const h = height - top - INSET.bottom;
  const cell = Math.max(1, Math.min(w / GRID.width, h / GRID.height)) * view.zoom;
  return {
    cell,
    width,
    height,
    ox: INSET.left + w / 2 - (GRID.width * cell) / 2 + view.pan.x,
    oy: top + h / 2 - (GRID.height * cell) / 2 + view.pan.y,
  };
}

/** Coordenada de la retícula → píxel (y crece hacia arriba en la retícula). */
export const project = (g: Geometry, c: Coord): [number, number] => [g.ox + c.x * g.cell, g.oy + (GRID.height - c.y) * g.cell];

export const toPath = (g: Geometry, pts: Coord[]) =>
  pts.map((p, i) => { const [x, y] = project(g, p); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");

/** Intersección más cercana a un píxel, o null si cae fuera de la retícula. */
export function nearestCoord(g: Geometry, px: number, py: number): Coord | null {
  const x = Math.round((px - g.ox) / g.cell);
  const y = Math.round(GRID.height - (py - g.oy) / g.cell);
  return x >= 0 && x <= GRID.width && y >= 0 && y <= GRID.height ? { x, y } : null;
}

export function zoomView(v: View, direction: 1 | -1): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(v.zoom * (direction > 0 ? 1.25 : 0.8)).toFixed(3)));
  const k = zoom / v.zoom;
  return { zoom, pan: zoom === MIN_ZOOM ? { x: 0, y: 0 } : { x: v.pan.x * k, y: v.pan.y * k } };
}
