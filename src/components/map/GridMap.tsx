"use client";

import { Crosshair, Focus, MapPin as MapPinIcon, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button, ControlButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { GRID } from "@/lib/constants";
import { formatCoord } from "@/lib/format";
import type { Coord, EntityRef, MapSnapshot, TrafficLight } from "@/lib/types";
import { BlockagePopover, POPOVER_WIDTH, VehiclePopover, WarehousePopover } from "./EntityPopover";
import { computeGeometry, nearestCoord, project, toPath, zoomView, type View } from "./geometry";
import { BlockageIcon, PINK, vehicleAppearance, warehouseAppearance, type MapLayers } from "./layers";
import { MapPin } from "./MapPin";

type GridMapProps = {
  snapshot: MapSnapshot;
  trafficLight: TrafficLight;
  layers: MapLayers;
  /** Espacio superior reservado para el resumen (HUD). */
  topInset: number;
  /** Almacenes sin semáforo (simulación aún no iniciada). */
  neutralWarehouses?: boolean;
  /** Intersección destacada (pedido seleccionado o destino elegido). */
  highlight?: Coord | null;
  selected: EntityRef | null;
  onSelect: (ref: EntityRef | null) => void;
  pickMode?: boolean;
  onPick?: (c: Coord) => void;
  onCancelPick?: () => void;
  /** Mensaje cuando no hay datos que dibujar. */
  emptyMessage?: ReactNode;
};

const TICK_COLOR = "#8c939c";

export function GridMap({ snapshot, trafficLight, layers, topInset, neutralWarehouses = false, highlight, selected, onSelect, pickMode, onPick, onCancelPick, emptyMessage }: GridMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [hover, setHover] = useState<Coord | null>(null);
  const [dragging, setDragging] = useState(false);
  const ready = size.w > 0 && size.h > 0;

  // Tamaño del contenedor
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zoom con la rueda (listener no pasivo para poder evitar el scroll de la página)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => zoomView(v, e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready]);

  // Escape cancela el modo "elegir punto"
  useEffect(() => {
    if (!pickMode || !onCancelPick) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancelPick();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickMode, onCancelPick]);

  const g = computeGeometry(size.w, size.h, topInset, view);
  const local = (e: PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || (e.target as Element).closest("[data-pin]")) return;
    const [x, y] = local(e);
    drag.current = { sx: x, sy: y, px: view.pan.x, py: view.pan.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const [x, y] = local(e);
    const d = drag.current;
    if (d) {
      const dx = x - d.sx, dy = y - d.sy;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) { d.moved = true; setDragging(true); }
      if (d.moved) setView((v) => ({ ...v, pan: { x: d.px + dx, y: d.py + dy } }));
      return;
    }
    setHover(nearestCoord(g, x, y));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.moved) return;
    const c = nearestCoord(g, ...local(e));
    if (pickMode) { if (c) onPick?.(c); }
    else onSelect(null);
  };

  const idle = neutralWarehouses;
  const isEmpty = snapshot.warehouses.length + snapshot.vehicles.length + snapshot.blockages.length === 0;

  // Anclaje de la ventana de detalle
  let popover: ReactNode = null;
  if (ready && selected) {
    const close = () => onSelect(null);
    const anchorFor = (c: Coord) => {
      const [x, y] = project(g, c);
      return { x, y, above: y > size.h * 0.5, left: Math.max(16, Math.min(size.w - POPOVER_WIDTH - 16, x - POPOVER_WIDTH / 2)) };
    };
    if (selected.type === "vehicle") {
      const v = snapshot.vehicles.find((x) => x.id === selected.id);
      if (v && !idle) popover = <VehiclePopover vehicle={v} anchor={anchorFor(v.position)} onClose={close} mapHeight={size.h} />;
    } else if (selected.type === "warehouse") {
      const w = snapshot.warehouses.find((x) => x.id === selected.id);
      if (w) popover = <WarehousePopover warehouse={w} trafficLight={trafficLight} neutral={idle} anchor={anchorFor(w.position)} onClose={close} mapHeight={size.h} />;
    } else {
      const b = snapshot.blockages.find((x) => x.id === selected.id);
      if (b && !idle) popover = <BlockagePopover blockage={b} anchor={anchorFor(midpoint(b.from, b.to))} onClose={close} mapHeight={size.h} />;
    }
  }

  const [x0, y0] = project(g, { x: 0, y: GRID.height });
  const [x1, y1] = project(g, { x: GRID.width, y: 0 });
  const step = view.zoom >= 2 ? 5 : 10;
  const minor = Math.max(0.8, g.cell * 0.07);
  const major = Math.max(1.6, g.cell * 0.14);

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      {ready && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          role="application"
          aria-label={`Mapa: retícula de ${GRID.width} por ${GRID.height}. Arrastra para moverte y usa la rueda para acercar.`}
          className={cn("absolute inset-0 touch-none select-none", pickMode ? "cursor-crosshair" : dragging ? "cursor-grabbing" : "cursor-grab")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          <rect x={x0 - g.cell * 0.7} y={y0 - g.cell * 0.7} width={x1 - x0 + g.cell * 1.4} height={y1 - y0 + g.cell * 1.4} rx={10} fill="#1e2833" stroke="#2b3643" />
          <g aria-hidden>
            {Array.from({ length: GRID.width + 1 }, (_, i) => (
              <line key={`v${i}`} x1={x0 + i * g.cell} y1={y0} x2={x0 + i * g.cell} y2={y1} stroke={i % 10 ? "#2c3845" : "#3f4c5c"} strokeWidth={i % 10 ? minor : major} />
            ))}
            {Array.from({ length: GRID.height + 1 }, (_, j) => (
              <line key={`h${j}`} x1={x0} y1={y1 - j * g.cell} x2={x1} y2={y1 - j * g.cell} stroke={j % 10 ? "#2c3845" : "#3f4c5c"} strokeWidth={j % 10 ? minor : major} />
            ))}
            {Array.from({ length: Math.floor(GRID.width / step) + 1 }, (_, k) => (
              <text key={`tx${k}`} x={x0 + k * step * g.cell} y={y1 + 24} textAnchor="middle" fill={TICK_COLOR} fontSize={11}>{k * step}</text>
            ))}
            {Array.from({ length: Math.floor(GRID.height / step) + 1 }, (_, k) => (
              <text key={`ty${k}`} x={x0 - 16} y={y1 - k * step * g.cell + 4} textAnchor="end" fill={TICK_COLOR} fontSize={11}>{k * step}</text>
            ))}
            <text x={x1 + 14} y={y1 + 24} fill="#626c7a" fontSize={11} fontWeight={600}>x</text>
            <text x={x0 - 16} y={y0 - 16} textAnchor="end" fill="#626c7a" fontSize={11} fontWeight={600}>y</text>
          </g>

          {!idle && layers.bloqueos && snapshot.blockages.map((b) => (
            <path key={`bl-${b.id}`} d={toPath(g, [b.from, b.to])} stroke="var(--color-critic)" strokeWidth={Math.max(5, g.cell * 0.3)} strokeLinecap="round" />
          ))}

          {!idle && layers.rutas && snapshot.vehicles.map((v) => {
            if (!v.route) return null;
            const { color } = vehicleAppearance(v);
            const dest = v.route.pending.at(-1);
            const [dx, dy] = dest ? project(g, dest) : [0, 0];
            return (
              <g key={`rt-${v.id}`} aria-hidden>
                {v.route.traveled.length > 1 && <path d={toPath(g, v.route.traveled)} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                {v.route.pending.length > 1 && <path d={toPath(g, v.route.pending)} stroke={color} strokeWidth={4} fill="none" strokeDasharray="8 7" strokeLinejoin="round" />}
                {dest && <circle cx={dx} cy={dy} r={7} fill={color} stroke="#161d25" strokeWidth={2.5} />}
              </g>
            );
          })}

          {layers.almacenes && snapshot.warehouses.map((w) => {
            const a = warehouseAppearance(w, trafficLight, idle);
            const [x, y] = project(g, w.position);
            return <MapPin key={`wh-${w.id}`} x={x} y={y} scale={0.9} color={a.color} Icon={a.Icon} label={`${w.name} ${formatCoord(w.position)}`} onActivate={() => onSelect({ type: "warehouse", id: w.id })} />;
          })}

          {!idle && layers.bloqueos && snapshot.blockages.map((b) => {
            const [x, y] = project(g, midpoint(b.from, b.to));
            return <MapPin key={`bp-${b.id}`} x={x} y={y} scale={0.72} color="var(--color-critic)" Icon={BlockageIcon} label="Vía bloqueada" onActivate={() => onSelect({ type: "blockage", id: b.id })} />;
          })}

          {!idle && layers.flota && snapshot.vehicles.map((v) => {
            const { color, Icon, meta } = vehicleAppearance(v);
            const [x, y] = project(g, v.position);
            return <MapPin key={`vh-${v.id}`} x={x} y={y} color={color} Icon={Icon} label={`${meta.label} ${v.plate}${v.status === "averiado" ? " (averiado)" : ""}`} onActivate={() => onSelect({ type: "vehicle", id: v.id })} />;
          })}

          {highlight && (() => { const [x, y] = project(g, highlight); return <MapPin x={x} y={y} scale={0.9} ring color={PINK} Icon={MapPinIcon} label={`Destino ${formatCoord(highlight)}`} />; })()}

          {hover && !dragging && (() => {
            const [x, y] = project(g, hover);
            return (
              <g transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden>
                <circle r={8} fill="none" stroke="var(--color-warning)" strokeWidth={2} />
                <circle r={2.5} fill="var(--color-warning)" />
              </g>
            );
          })()}
        </svg>
      )}

      {popover}

      {pickMode && (
        <div className="absolute top-4 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-craft py-2 pr-2 pl-4 font-semibold whitespace-nowrap text-night shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
          <Crosshair className="size-5" aria-hidden /> Haz clic en una intersección para fijar el destino
          <Button size="xs" className="bg-night/15 text-night hover:bg-night/25" onClick={onCancelPick}>Cancelar</Button>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[3] flex items-end gap-2.5">
        <div className="flex flex-col rounded-xl border border-line bg-panel/95 p-1 shadow-[0_8px_24px_rgb(0_0_0/0.3)]">
          <ControlButton label="Acercar" onClick={() => setView((v) => zoomView(v, 1))}><Plus className="size-[22px]" /></ControlButton>
          <hr className="mx-1.5 my-0.5 border-line-strong" />
          <ControlButton label="Alejar" onClick={() => setView((v) => zoomView(v, -1))}><Minus className="size-[22px]" /></ControlButton>
          <hr className="mx-1.5 my-0.5 border-line-strong" />
          <ControlButton label="Ver toda la retícula" onClick={() => setView({ zoom: 1, pan: { x: 0, y: 0 } })}><Focus className="size-[22px]" /></ControlButton>
        </div>
        <div aria-live="off" className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel/95 px-3 text-[13px] whitespace-nowrap text-n200 tabular-nums">
          <Crosshair className="size-4" aria-hidden />
          {hover ? <span>x <b className="font-semibold text-white">{hover.x}</b> · y <b className="font-semibold text-white">{hover.y}</b></span> : <span>Pasa el cursor por el mapa</span>}
        </div>
        <span className="flex h-8 items-center text-xs text-n500">{Math.round(view.zoom * 100)} %</span>
        {ready && isEmpty && emptyMessage && (
          <div role="status" className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel/95 px-3 text-[13px] whitespace-nowrap text-n300">
            <span className="size-2 rounded-full bg-n700" aria-hidden />
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function midpoint(a: Coord, b: Coord): Coord {
  return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
}
