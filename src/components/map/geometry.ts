import { GRID } from "@/lib/constants";
import type { Coord } from "@/lib/types";

export type View = { zoom: number; pan: { x: number; y: number } };
/**
 * `cx`/`cy`: tamaño de celda en cada eje. Se escalan por separado para que la
 * retícula completa llene el recuadro del mapa sin franjas vacías; `cell` es el
 * menor de los dos y sirve para grosores.
 */
export type Geometry = { cx: number; cy: number; cell: number; ox: number; oy: number; width: number; height: number };

/** La retícula ocupa todo el recuadro con un margen mínimo; el resumen (HUD) y los controles flotan encima. */
const INSET = { left: 16, right: 16, top: 16, bottom: 16 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function computeGeometry(width: number, height: number, view: View): Geometry {
  const w = width - INSET.left - INSET.right;
  const h = height - INSET.top - INSET.bottom;
  const cx = Math.max(1, w / GRID.width) * view.zoom;
  const cy = Math.max(1, h / GRID.height) * view.zoom;
  return {
    cx,
    cy,
    cell: Math.min(cx, cy),
    width,
    height,
    ox: INSET.left + w / 2 - (GRID.width * cx) / 2 + view.pan.x,
    oy: INSET.top + h / 2 - (GRID.height * cy) / 2 + view.pan.y,
  };
}

/** Coordenada de la retícula → píxel (y crece hacia arriba en la retícula). */
export const project = (g: Geometry, c: Coord): [number, number] => [g.ox + c.x * g.cx, g.oy + (GRID.height - c.y) * g.cy];

export const toPath = (g: Geometry, pts: Coord[]) =>
  pts.map((p, i) => { const [x, y] = project(g, p); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");

/** Punto a media longitud de la polilínea, siempre sobre un tramo del bloqueo. */
export function polylineMidpoint(points: Coord[]): Coord {
  if (!points.length) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const fraction = remaining / lengths[i];
      return { x: points[i].x + fraction * (points[i + 1].x - points[i].x), y: points[i].y + fraction * (points[i + 1].y - points[i].y) };
    }
    remaining -= lengths[i];
  }
  return points[0];
}

/** Intersección más cercana a un píxel, o null si cae fuera de la retícula. */
export function nearestCoord(g: Geometry, px: number, py: number): Coord | null {
  const x = Math.round((px - g.ox) / g.cx);
  const y = Math.round(GRID.height - (py - g.oy) / g.cy);
  return x >= 0 && x <= GRID.width && y >= 0 && y <= GRID.height ? { x, y } : null;
}

export function zoomView(v: View, direction: 1 | -1): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(v.zoom * (direction > 0 ? 1.25 : 0.8)).toFixed(3)));
  const k = zoom / v.zoom;
  return { zoom, pan: zoom === MIN_ZOOM ? { x: 0, y: 0 } : { x: v.pan.x * k, y: v.pan.y * k } };
}
