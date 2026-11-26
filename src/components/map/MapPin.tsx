import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";

/**
 * Marcador del mapa. La punta está en (0, 0) sobre la intersección y el círculo
 * (r = 20) en (0, −30). Caja real: x −21…21, y −51…1, así nunca se recorta.
 */
export type Heading = "right" | "left" | "up" | "down";

/** Color de todo lo seleccionado en el mapa (marcadores, rutas, anillos). */
export const SELECT = "var(--color-select)";
/** Cuánto crece un marcador seleccionado. */
export const SELECTED_SCALE = 1.35;

/** Giro del ícono sobre el centro del círculo; a la izquierda se refleja para no quedar de cabeza. */
const HEADING_TRANSFORM: Record<Heading, string | undefined> = {
  right: undefined,
  left: "scale(-1 1)",
  up: "rotate(-90 0 -30)",
  down: "rotate(90 0 -30)",
};

/** Anillo que late alrededor de (0, cy): marca lo elegido, siempre en el azul de selección. */
function PulseRing({ cy = 0, from = 22, to = 34 }: { cy?: number; from?: number; to?: number }) {
  return (
    <circle cx={0} cy={cy} r={from} fill="none" stroke={SELECT} strokeWidth={4}>
      <animate attributeName="r" values={`${from};${to};${from}`} dur="1.6s" repeatCount="indefinite" />
      <animate attributeName="opacity" values=".95;0;.95" dur="1.6s" repeatCount="indefinite" />
    </circle>
  );
}

/**
 * Halo de selección: disco azul translúcido con borde azul y, en la punta, una
 * sombra en el suelo para ubicar la intersección exacta.
 */
function SelectedHalo({ cy, r }: { cy: number; r: number }) {
  return (
    <>
      {cy !== 0 && <ellipse cx={0} cy={0} rx={13} ry={5} fill={SELECT} stroke="#fff" strokeWidth={1.5} />}
      <circle cx={0} cy={cy} r={r} fill={SELECT} fillOpacity={0.3} stroke={SELECT} strokeWidth={5} />
    </>
  );
}

function PinShape({ color, Icon, ring, selected, BadgeIcon, badgeText, badgeColor = "var(--color-warning)", badgeGlyph = "#161d25", centered, heading = "right" }: { color: string; Icon: LucideIcon; ring?: boolean; selected?: boolean; BadgeIcon?: LucideIcon; badgeText?: string; badgeColor?: string; badgeGlyph?: string; centered?: boolean; heading?: Heading }) {
  // Seleccionado: contorno blanco grueso en lugar del oscuro, sobre el halo azul.
  const outline = selected ? "#fff" : "#10161c";
  const outlineWidth = selected ? 3.5 : 2;
  if (centered) return (
    <>
      {(ring || selected) && <PulseRing from={22} to={36} />}
      {selected && <SelectedHalo cy={0} r={28} />}
      <circle r={20} fill={color} stroke={outline} strokeWidth={outlineWidth} />
      <Icon x={-11} y={-11} size={22} color="#161d25" strokeWidth={2} aria-hidden />
    </>
  );
  return (
    <>
      {(ring || selected) && <PulseRing cy={-30} />}
      {selected && <SelectedHalo cy={-30} r={29} />}
      <path d="M0 0 L-12 -14 A20 20 0 1 1 12 -14 Z" fill={color} stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round" />
      <g transform={HEADING_TRANSFORM[heading]}><Icon x={-11} y={-41} size={22} color="#161d25" strokeWidth={2} aria-hidden /></g>
      {badgeText && <g><circle cx={18} cy={-46} r={12} fill={badgeColor} stroke="#10161c" strokeWidth={2} /><text x={18} y={-41.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={badgeGlyph}>{badgeText}</text></g>}
      {!badgeText && BadgeIcon && <g><circle cx={18} cy={-46} r={11} fill={badgeColor} stroke="#10161c" strokeWidth={2} /><BadgeIcon x={12} y={-52} size={12} color={badgeGlyph} aria-hidden /></g>}
    </>
  );
}

type MapPinProps = {
  x: number;
  y: number;
  color: string;
  Icon: LucideIcon;
  label: string;
  scale?: number;
  ring?: boolean;
  /** Elemento seleccionado: más grande, con halo azul, contorno blanco y anillo que late. */
  selected?: boolean;
  BadgeIcon?: LucideIcon;
  /** Texto corto en la insignia (p. ej. número de parada); reemplaza a `BadgeIcon`. */
  badgeText?: string;
  /** Fondo de la insignia; ámbar por defecto. */
  badgeColor?: string;
  badgeGlyph?: string;
  /** Centra el glifo sobre la coordenada; útil para bloqueos sobre su línea. */
  centered?: boolean;
  /** Sentido de avance del vehículo; orienta el ícono. */
  heading?: Heading;
  onActivate?: () => void;
  /** Cursor encima o foco de teclado (tooltip del mapa). */
  onHoverChange?: (hovered: boolean) => void;
};

export function MapPin({ x, y, color, Icon, label, scale = 0.82, ring, selected, BadgeIcon, badgeText, badgeColor, badgeGlyph, centered, heading, onActivate, onHoverChange }: MapPinProps) {
  const interactive = !!onActivate;
  // Sin acción pero con tooltip: recibe el cursor aunque no sea un botón.
  const hoverable = interactive || !!onHoverChange;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };
  return (
    <g
      data-pin
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${selected ? scale * SELECTED_SCALE : scale})`}
      role={interactive ? "button" : "img"}
      aria-pressed={interactive && selected ? true : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerEnter={onHoverChange && (() => onHoverChange(true))}
      onPointerLeave={onHoverChange && (() => onHoverChange(false))}
      onFocus={onHoverChange && (() => onHoverChange(true))}
      onBlur={onHoverChange && (() => onHoverChange(false))}
      className={interactive ? "cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-125" : hoverable ? "cursor-default outline-none" : "pointer-events-none"}
    >
      <title>{label}</title>
      <PinShape color={color} Icon={Icon} ring={ring} selected={selected} BadgeIcon={BadgeIcon} badgeText={badgeText} badgeColor={badgeColor} badgeGlyph={badgeGlyph} centered={centered} heading={heading} />
    </g>
  );
}

/** Medio lado del cuadrado de un almacén (sin escalar). */
export const WAREHOUSE_HALF = 22;

/**
 * Forma del almacén: cuadrado de bordes redondeados centrado en la intersección,
 * distinta de la gota de vehículos y pedidos. El central va relleno; en los
 * intermedios el semáforo de stock es el borde (y el ícono), sobre fondo neutro.
 */
function WarehouseShape({ fill, stroke, glyph, Icon, dashed, ring, selected }: { fill: string; stroke: string; glyph: string; Icon: LucideIcon; dashed?: boolean; ring?: boolean; selected?: boolean }) {
  const h = WAREHOUSE_HALF;
  return (
    <>
      {(ring || selected) && (
        <rect x={-h - 8} y={-h - 8} width={2 * h + 16} height={2 * h + 16} rx={15} fill="none" stroke={SELECT} strokeWidth={4}>
          <animate attributeName="opacity" values=".95;0;.95" dur="1.6s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale" values="1;1.25;1" dur="1.6s" repeatCount="indefinite" />
        </rect>
      )}
      {selected && <rect x={-h - 9} y={-h - 9} width={2 * h + 18} height={2 * h + 18} rx={16} fill={SELECT} fillOpacity={0.3} stroke={SELECT} strokeWidth={5} />}
      {/* Contorno oscuro (blanco si está seleccionado) para que el borde de color se lea sobre la retícula. */}
      <rect x={-h} y={-h} width={2 * h} height={2 * h} rx={10} fill={fill} stroke={selected ? "#fff" : "#10161c"} strokeWidth={7} />
      <rect x={-h} y={-h} width={2 * h} height={2 * h} rx={10} fill="none" stroke={stroke} strokeWidth={4} strokeDasharray={dashed ? "7 5" : undefined} />
      <Icon x={-12} y={-12} size={24} color={glyph} strokeWidth={2} aria-hidden />
    </>
  );
}

export type WarehouseLook = { fill: string; stroke: string; glyph: string; Icon: LucideIcon; dashed?: boolean };

type WarehouseMarkerProps = WarehouseLook & {
  x: number;
  y: number;
  label: string;
  ring?: boolean;
  /** Almacén seleccionado: más grande, con halo azul y contorno blanco. */
  selected?: boolean;
  onActivate?: () => void;
  onHoverChange?: (hovered: boolean) => void;
};

export function WarehouseMarker({ x, y, label, ring, selected, onActivate, onHoverChange, ...look }: WarehouseMarkerProps) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };
  return (
    <g
      data-pin
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})${selected ? ` scale(${SELECTED_SCALE})` : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected || undefined}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      onPointerEnter={onHoverChange && (() => onHoverChange(true))}
      onPointerLeave={onHoverChange && (() => onHoverChange(false))}
      onFocus={onHoverChange && (() => onHoverChange(true))}
      onBlur={onHoverChange && (() => onHoverChange(false))}
      className="cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-125"
    >
      <title>{label}</title>
      <WarehouseShape {...look} ring={ring} selected={selected} />
    </g>
  );
}

/** Almacén aislado (leyenda). */
export function WarehouseGlyph({ size = 28, selected, ...look }: WarehouseLook & { size?: number; selected?: boolean }) {
  const b = WAREHOUSE_HALF + (selected ? 14 : 4);
  return (
    <svg width={size} height={size} viewBox={`${-b} ${-b} ${2 * b} ${2 * b}`} aria-hidden className="shrink-0 overflow-visible">
      <WarehouseShape {...look} selected={selected} />
    </svg>
  );
}

/** Marcador aislado (leyenda). */
export function PinGlyph({ color, Icon, size = 28, selected, BadgeIcon, badgeText, badgeColor, badgeGlyph }: { color: string; Icon: LucideIcon; size?: number; selected?: boolean; BadgeIcon?: LucideIcon; badgeText?: string; badgeColor?: string; badgeGlyph?: string }) {
  // Con halo, la caja crece para que no se recorte.
  const box = selected ? "-31 -61 62 68" : "-23 -53 46 56";
  return (
    <svg width={size} height={Math.round((size * (selected ? 68 : 56)) / (selected ? 62 : 46))} viewBox={box} aria-hidden className="shrink-0 overflow-visible">
      <PinShape color={color} Icon={Icon} selected={selected} BadgeIcon={BadgeIcon} badgeText={badgeText} badgeColor={badgeColor} badgeGlyph={badgeGlyph} />
    </svg>
  );
}
