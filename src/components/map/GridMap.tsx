"use client";

import { Crosshair, Flag, Focus, Hourglass, MapPin as MapPinIcon, Minus, Package, Plus, Utensils } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Button, ControlButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { BLOCKAGE_BLINK_PERIOD_MS, VEHICLE_OCCUPANCY_DEFAULTS } from "@/config/simulacion";
import { endingIn } from "@/lib/blockage";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { GRID } from "@/lib/constants";
import { formatCoord } from "@/lib/format";
import type { Coord, EntityRef, MapSnapshot, Order, PercentBands, TrafficLight, Vehicle, VehicleKind } from "@/lib/types";
import { BlockagePopover, POPOVER_WIDTH, VehiclePopover, WarehousePopover } from "./EntityPopover";
import { computeGeometry, nearestCoord, polylineMidpoint, project, toPath, zoomView, type View } from "./geometry";
import { BlockageIcon, PINK, VEHICLE_STATUS_LABEL, vehicleAppearance, warehouseAppearance, type MapLayers } from "./layers";
import { HoverTooltip, vehicleOccupancyText, warehouseStockText } from "./HoverTooltip";
import { MapPin } from "./MapPin";
import { useVehicleMotion } from "./motion";
import { pendingFromShown, samePoint } from "./trajectory";
import { assignedDestinations } from "./selection";

/**
 * Punto de vehículos en espera, con el color de su tipo de vehículo. Si en la
 * misma intersección esperan vehículos de tipos distintos, el círculo se reparte
 * en sectores, uno por vehículo.
 */
function WaitingDot({ colors, r }: { colors: string[]; r: number }) {
  const sorted = [...colors].sort();
  if (new Set(sorted).size === 1) return <circle r={r} fill={sorted[0]} stroke="#10161c" strokeWidth={2} />;
  const n = sorted.length;
  const at = (k: number) => {
    const a = (2 * Math.PI * k) / n - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <>
      {sorted.map((color, k) => <path key={k} d={`M0 0 L${at(k)} A${r} ${r} 0 0 1 ${at(k + 1)} Z`} fill={color} />)}
      <circle r={r} fill="none" stroke="#10161c" strokeWidth={2} />
    </>
  );
}

const DEFAULT_VEHICLE_BANDS: Record<VehicleKind, PercentBands> = { auto: VEHICLE_OCCUPANCY_DEFAULTS, moto: VEHICLE_OCCUPANCY_DEFAULTS, bicicleta: VEHICLE_OCCUPANCY_DEFAULTS };

type GridMapProps = {
  snapshot: MapSnapshot;
  orders?: Order[];
  /** Destinos de pedidos ya vistos, para dibujar los que el servidor dejó de listar al entregarlos. */
  knownDestinations?: ReadonlyMap<string, Coord>;
  trafficLight: TrafficLight;
  layers: MapLayers;
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
  /** Indicador discreto junto a los controles (p. ej. "Aplicando cambios…"); nunca lo tapa el panel lateral. */
  status?: ReactNode;
  /** Semáforo de ocupación por tipo de vehículo (tooltip); por defecto, el de la configuración. */
  vehicleBands?: Record<VehicleKind, PercentBands>;
  /** Umbrales de llenado en % para el color de los almacenes (simulación); sin ellos, el semáforo en paquetes. */
  warehouseFillBands?: PercentBands;
  /** Marcadores resaltados con un anillo (elegidos en un listado lateral). */
  emphasis?: { warehouses?: ReadonlySet<string>; vehicles?: ReadonlySet<string> };
};

const NO_EMPHASIS: NonNullable<GridMapProps["emphasis"]> = {};

export function GridMap({ snapshot, orders = [], knownDestinations, trafficLight, layers, neutralWarehouses = false, highlight, selected, onSelect, pickMode, onPick, onCancelPick, emptyMessage, status, vehicleBands = DEFAULT_VEHICLE_BANDS, emphasis = NO_EMPHASIS, warehouseFillBands }: GridMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [hover, setHover] = useState<Coord | null>(null);
  // Marcador bajo el cursor (o con foco): estado local del mapa, no de la pantalla.
  const [hovered, setHovered] = useState<EntityRef | null>(null);
  const hoverOf = (ref: EntityRef) => (on: boolean) =>
    setHovered((h) => (on ? ref : h?.type === ref.type && h.id === ref.id ? null : h));
  const [dragging, setDragging] = useState(false);
  const ready = size.w > 0 && size.h > 0;
  const motion = useVehicleMotion(snapshot.vehicles, snapshot.sample, snapshot.blockages);
  // Bloqueos vigentes en el minuto que muestra la animación, no en el de la foto
  // más reciente: los vehículos se animan una foto por detrás.
  const shownMinute = motion.minute == null ? undefined : Math.floor(motion.minute);
  const blockages = shownMinute == null
    ? snapshot.blockages
    : motion.blockages.filter((b) => (b.startMinute ?? -Infinity) <= shownMinute && shownMinute < (b.endMinute ?? Infinity));
  const shownAt = (v: Vehicle) => motion.positions[v.id] ?? v.position;
  const atWarehouse = (v: Vehicle) => snapshot.warehouses.find((w) => samePoint(w.position, shownAt(v)));
  // Vehículos en espera fuera de los almacenes: se agrupan en un punto por intersección
  // y se despliegan al pulsarlo. Los de un almacén ya van en la ficha de ese almacén.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const nodeKey = (c: Coord) => `${Math.round(c.x)},${Math.round(c.y)}`;
  const isWaiting = (v: Vehicle) => v.status === "disponible" && !atWarehouse(v);
  const waitingGroups = new Map<string, Vehicle[]>();
  for (const v of snapshot.vehicles) {
    if (!isWaiting(v)) continue;
    const key = nodeKey(shownAt(v));
    waitingGroups.set(key, [...(waitingGroups.get(key) ?? []), v]);
  }
  /** Un grupo se ve desplegado si el usuario lo abrió o si contiene el vehículo seleccionado. */
  const isExpanded = (key: string) => expanded.has(key) || (selected?.type === "vehicle" && !!waitingGroups.get(key)?.some((v) => v.id === selected.id));
  /** Desplazamiento en píxeles para que los vehículos de un grupo desplegado no se tapen entre sí. */
  const fanOffset = (v: Vehicle) => {
    if (!isWaiting(v)) return 0;
    const group = waitingGroups.get(nodeKey(shownAt(v))) ?? [];
    return (group.indexOf(v) - (group.length - 1) / 2) * 30;
  };
  const selectedVehicle = selected?.type === "vehicle" ? snapshot.vehicles.find((v) => v.id === selected.id) : undefined;
  const destinations = selectedVehicle ? assignedDestinations(selectedVehicle, orders, knownDestinations) : [];
  const finalDestination = selectedVehicle?.route?.pending.at(-1);
  const blockageAnchor = (b: MapSnapshot["blockages"][number]) => polylineMidpoint(b.path?.length ? b.path : [b.from, b.to]);
  const blink = { animationDuration: `${BLOCKAGE_BLINK_PERIOD_MS}ms` };
  const endingSoon = (b: MapSnapshot["blockages"][number]) => endingIn(b, shownMinute ?? snapshot.sample?.simulatedMinute);

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

  const g = computeGeometry(size.w, size.h, view);
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
    else { onSelect(null); setExpanded(new Set()); }
  };

  const idle = neutralWarehouses;
  /** Antes de comenzar no hay vehículos; los almacenes muestran su stock sin semáforo. */
  const idleTooltipHidden = (r: EntityRef) => idle && r.type === "vehicle";
  const isEmpty = snapshot.warehouses.length + snapshot.vehicles.length + blockages.length === 0;

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
      if (v && !idle) popover = <VehiclePopover vehicle={v} bands={vehicleBands[v.kind]} anchor={anchorFor(shownAt(v))} onClose={close} mapHeight={size.h} docked />;
    } else if (selected.type === "warehouse") {
      const w = snapshot.warehouses.find((x) => x.id === selected.id);
      if (w) popover = <WarehousePopover warehouse={w} trafficLight={trafficLight} fillBands={warehouseFillBands} neutral={idle} anchor={anchorFor(w.position)} onClose={close} mapHeight={size.h} vehicles={snapshot.vehicles.filter((v) => atWarehouse(v)?.id === w.id)} onSelectVehicle={(id) => onSelect({ type: "vehicle", id })} />;
    } else {
      const b = blockages.find((x) => x.id === selected.id);
      if (b && !idle) popover = <BlockagePopover blockage={b} endsIn={endingSoon(b)} anchor={anchorFor(blockageAnchor(b))} onClose={close} mapHeight={size.h} />;
    }
  }

  // Tooltip del marcador bajo el cursor; no se repite si ya está abierta su ficha.
  let tooltip: ReactNode = null;
  const isSelected = (r: EntityRef) => selected?.type === r.type && selected.id === r.id;
  if (ready && hovered && !dragging && !idleTooltipHidden(hovered) && !isSelected(hovered)) {
    if (hovered.type === "vehicle") {
      const v = snapshot.vehicles.find((x) => x.id === hovered.id);
      // Solo mientras su marcador esté visible (no en un almacén ni dentro de un grupo plegado).
      if (v && layers.flota && !atWarehouse(v) && !(isWaiting(v) && !isExpanded(nodeKey(shownAt(v))))) {
        const [px, py] = project(g, shownAt(v));
        tooltip = <HoverTooltip kind="vehicle" vehicle={v} bands={vehicleBands[v.kind]} x={px + fanOffset(v)} y={py} mapWidth={size.w} />;
      }
    } else if (hovered.type === "warehouse") {
      const w = snapshot.warehouses.find((x) => x.id === hovered.id);
      if (w && layers.almacenes && w.kind === "secundario") {
        const [px, py] = project(g, w.position);
        tooltip = <HoverTooltip kind="warehouse" warehouse={w} tone={warehouseAppearance(w, trafficLight, idle, warehouseFillBands).tone} x={px} y={py} mapWidth={size.w} />;
      }
    }
  }

  const [x0, y0] = project(g, { x: 0, y: GRID.height });
  const [x1, y1] = project(g, { x: GRID.width, y: 0 });
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
          <rect width={size.w} height={size.h} fill="#1e2833" />
          <g aria-hidden>
            {Array.from({ length: GRID.width + 1 }, (_, i) => (
              <line key={`v${i}`} x1={x0 + i * g.cx} y1={y0} x2={x0 + i * g.cx} y2={y1} stroke={i % 10 ? "#2c3845" : "#3f4c5c"} strokeWidth={i % 10 ? minor : major} />
            ))}
            {Array.from({ length: GRID.height + 1 }, (_, j) => (
              <line key={`h${j}`} x1={x0} y1={y1 - j * g.cy} x2={x1} y2={y1 - j * g.cy} stroke={j % 10 ? "#2c3845" : "#3f4c5c"} strokeWidth={j % 10 ? minor : major} />
            ))}
          </g>

          {!idle && layers.bloqueos && blockages.map((b) => {
            const ending = endingSoon(b) != null;
            const width = Math.max(5, g.cell * 0.3);
            return (
              <path key={`bl-${b.id}`} d={toPath(g, b.path ?? [b.from, b.to])} fill="none" stroke="var(--color-critic)" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={ending ? `${width * 1.6} ${width * 1.4}` : undefined} className={ending ? "blockage-ending" : undefined} style={ending ? blink : undefined} />
            );
          })}

          {!idle && layers.rutas && [...snapshot.vehicles].sort((a, b) => Number(a.id === selectedVehicle?.id) - Number(b.id === selectedVehicle?.id)).map((v) => {
            if (!v.route) return null;
            // La ruta conserva el color del tipo: en rojo se confundiría con un bloqueo.
            const { color } = VEHICLE_META[v.kind];
            const pending = pendingFromShown(shownAt(v), v, motion.remaining[v.id]);
            const dest = pending.length > 1 ? pending.at(-1) : undefined;
            const [dx, dy] = dest ? project(g, dest) : [0, 0];
            return (
              <g key={`rt-${v.id}`} aria-hidden className={v.id === selectedVehicle?.id ? "selected-vehicle-route" : undefined} opacity={selectedVehicle && v.id !== selectedVehicle.id ? 0.35 : 1}>
                {pending.length > 1 && <path d={toPath(g, pending)} stroke={color} strokeWidth={v.id === selectedVehicle?.id ? 6 : 4} fill="none" strokeDasharray="8 7" strokeLinejoin="round" />}
                {dest && <circle cx={dx} cy={dy} r={7} fill={color} stroke="#161d25" strokeWidth={2.5} />}
              </g>
            );
          })}

          {layers.almacenes && snapshot.warehouses.map((w) => {
            const a = warehouseAppearance(w, trafficLight, idle, warehouseFillBands);
            const [x, y] = project(g, w.position);
            const intermediate = w.kind === "secundario";
            const stock = intermediate ? warehouseStockText(w) : "";
            return <MapPin key={`wh-${w.id}`} x={x} y={y} scale={0.9} ring={!!emphasis.warehouses?.has(w.id)} color={a.color} Icon={a.Icon} label={`${w.name} ${formatCoord(w.position)}${stock ? `, ${stock}` : ""}`} onActivate={() => onSelect({ type: "warehouse", id: w.id })} onHoverChange={intermediate ? hoverOf({ type: "warehouse", id: w.id }) : undefined} />;
          })}

          {!idle && layers.bloqueos && blockages.map((b) => {
            const [x, y] = project(g, blockageAnchor(b));
            const left = endingSoon(b);
            const pin = <MapPin x={x} y={y} centered scale={0.72} color="var(--color-critic)" Icon={left != null ? Hourglass : BlockageIcon} label={left != null ? `Vía bloqueada, se libera en ~${left} min` : "Vía bloqueada"} onActivate={() => onSelect({ type: "blockage", id: b.id })} />;
            return left != null ? <g key={`bp-${b.id}`} className="blockage-ending" style={blink}>{pin}</g> : <g key={`bp-${b.id}`}>{pin}</g>;
          })}

          {!idle && layers.flota && selectedVehicle && <g aria-label={`Destinos de ${selectedVehicle.plate}`}>
            {destinations.map((destination) => {
              const [x, y] = project(g, destination.position);
              return <MapPin key={`orders-${destination.key}`} x={x} y={y} scale={0.7} color={PINK} Icon={Package} BadgeIcon={Flag} label={`Pedidos asignados ${destination.orderIds.join(", ")} · destino ${formatCoord(destination.position)}`} onActivate={() => onSelect({ type: "vehicle", id: selectedVehicle.id })} />;
            })}
            {finalDestination && !destinations.some((d) => samePoint(d.position, finalDestination)) && (() => {
              const [x, y] = project(g, finalDestination);
              return <MapPin x={x} y={y} scale={0.7} color="var(--color-warning)" Icon={Flag} label={`Destino final de ${selectedVehicle.plate} ${formatCoord(finalDestination)}`} onActivate={() => onSelect({ type: "vehicle", id: selectedVehicle.id })} />;
            })()}
          </g>}

          {!idle && layers.flota && snapshot.vehicles.map((v) => {
            if (atWarehouse(v)) return null;
            if (isWaiting(v) && !isExpanded(nodeKey(shownAt(v)))) return null;
            const { color, Icon, BadgeIcon, badgeColor, meta } = vehicleAppearance(v, vehicleBands[v.kind]);
            const [px, y] = project(g, shownAt(v));
            const x = px + fanOffset(v);
            return <MapPin key={`vh-${v.id}`} x={x} y={y} ring={!!emphasis.vehicles?.has(v.id)} color={color} Icon={Icon} BadgeIcon={BadgeIcon} badgeColor={badgeColor} label={`${meta.label} ${v.plate} · ${VEHICLE_STATUS_LABEL[v.status]} · ${vehicleOccupancyText(v, vehicleBands[v.kind])}`} onActivate={() => onSelect({ type: "vehicle", id: v.id })} onHoverChange={hoverOf({ type: "vehicle", id: v.id })} />;
          })}

          {!idle && layers.flota && [...waitingGroups].map(([key, group]) => {
            if (isExpanded(key)) return null;
            const [x, y] = project(g, shownAt(group[0]));
            const plates = group.map((v) => v.plate).join(", ");
            const label = `${group.length === 1 ? "1 vehículo en espera" : `${group.length} vehículos en espera`} en (${key.replace(",", ", ")}): ${plates}. Pulsa para desplegar.`;
            const open = () => setExpanded((s) => new Set(s).add(key));
            return <g key={`wait-${key}`} data-pin transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={label} onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }} className="cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-125">
              <title>{label}</title>
              {/* Siempre con el número: un punto liso se confundiría con el destino de una ruta. */}
              <circle r={16} fill="transparent" />
              <WaitingDot colors={group.map((v) => VEHICLE_META[v.kind].color)} r={10} />
              <text y={4.5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#161d25">{group.length}</text>
            </g>;
          })}

          {!idle && layers.flota && snapshot.warehouses.map((w) => {
            const fleet = snapshot.vehicles.filter((v) => atWarehouse(v)?.id === w.id);
            if (!fleet.length) return null;
            const feeding = fleet.filter((v) => v.status === "en_alimentacion").length;
            const [x, y] = project(g, w.position);
            const label = `${w.name}: ${fleet.length} vehículos, ${feeding} en pausa de alimentación. Ver vehículos.`;
            const open = () => onSelect({ type: "warehouse", id: w.id });
            return <g key={`fleet-${w.id}`} data-pin transform={`translate(${x + 12} ${y - 60})`} role="button" tabIndex={0} aria-label={label} onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }} className="cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-125">
              <title>{label}</title>
              <rect width={feeding ? 80 : 38} height={26} rx={8} fill={feeding ? "var(--color-warning)" : "#dbe4ef"} stroke="#10161c" strokeWidth={2} />
              <text x={19} y={18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#161d25">{fleet.length}</text>
              {feeding > 0 && <><Utensils x={36} y={6} size={14} color="#161d25" aria-hidden /><text x={63} y={18} textAnchor="middle" fontSize={12} fill="#161d25">{feeding}</text></>}
            </g>;
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

      {hover && !dragging && !tooltip && (() => {
        // Dirección de la intersección bajo el cursor (la retícula ya no lleva numeración).
        const [x, y] = project(g, hover);
        const right = x < size.w - 170;
        const below = y < 90;
        return (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[5] rounded-lg border border-line-strong bg-panel/95 px-2.5 py-1.5 text-[13px] whitespace-nowrap text-n200 tabular-nums shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
            style={{ left: x, top: y, transform: `translate(${right ? "14px" : "calc(-100% - 14px)"}, ${below ? "14px" : "calc(-100% - 14px)"})` }}
          >
            Dirección <b className="font-semibold text-white">({hover.x}, {hover.y})</b>
          </div>
        );
      })()}

      {tooltip}
      {popover}

      {pickMode && (
        <div className="absolute top-4 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-craft py-2 pr-2 pl-4 font-semibold whitespace-nowrap text-night shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
          <Crosshair className="size-5" aria-hidden /> Haz clic en una intersección para fijar el destino
          <Button size="xs" className="bg-night/15 text-night hover:bg-night/25" onClick={onCancelPick}>Cancelar</Button>
        </div>
      )}

      <div className="absolute bottom-3 left-4 z-[3] flex items-center gap-2.5">
        <div className="flex h-10 items-center rounded-xl border border-line bg-panel/95 px-0.5 shadow-[0_8px_24px_rgb(0_0_0/0.3)] [&>button]:size-9">
          <ControlButton label="Acercar" onClick={() => setView((v) => zoomView(v, 1))}><Plus className="size-5" /></ControlButton>
          <span className="mx-0.5 h-5 border-l border-line-strong" aria-hidden />
          <ControlButton label="Alejar" onClick={() => setView((v) => zoomView(v, -1))}><Minus className="size-5" /></ControlButton>
          <span className="mx-0.5 h-5 border-l border-line-strong" aria-hidden />
          <ControlButton label="Ver toda la retícula" onClick={() => setView({ zoom: 1, pan: { x: 0, y: 0 } })}><Focus className="size-5" /></ControlButton>
        </div>
        <span className="flex h-8 items-center rounded-lg bg-panel/80 px-2 text-xs text-n400">{Math.round(view.zoom * 100)} %</span>
        {ready && isEmpty && emptyMessage && (
          <div role="status" className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel/95 px-3 text-[13px] whitespace-nowrap text-n300">
            <span className="size-2 rounded-full bg-n700" aria-hidden />
            {emptyMessage}
          </div>
        )}
        {status}
      </div>
    </div>
  );
}

