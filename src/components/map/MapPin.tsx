import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";

/**
 * Marcador del mapa. La punta está en (0, 0) sobre la intersección y el círculo
 * (r = 20) en (0, −30). Caja real: x −21…21, y −51…1, así nunca se recorta.
 */
export type Heading = "right" | "left" | "up" | "down";

/** Giro del ícono sobre el centro del círculo; a la izquierda se refleja para no quedar de cabeza. */
const HEADING_TRANSFORM: Record<Heading, string | undefined> = {
  right: undefined,
  left: "scale(-1 1)",
  up: "rotate(-90 0 -30)",
  down: "rotate(90 0 -30)",
};

function PinShape({ color, Icon, ring, BadgeIcon, badgeText, badgeColor = "var(--color-warning)", badgeGlyph = "#161d25", centered, heading = "right" }: { color: string; Icon: LucideIcon; ring?: boolean; BadgeIcon?: LucideIcon; badgeText?: string; badgeColor?: string; badgeGlyph?: string; centered?: boolean; heading?: Heading }) {
  if (centered) return <><circle r={20} fill={color} stroke="#10161c" strokeWidth={2} /><Icon x={-11} y={-11} size={22} color="#161d25" strokeWidth={2} aria-hidden /></>;
  return (
    <>
      {ring && (
        <circle cx={0} cy={-30} r={26} fill="none" stroke={color} strokeWidth={3}>
          <animate attributeName="r" values="22;32;22" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".8;0;.8" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}
      <path d="M0 0 L-12 -14 A20 20 0 1 1 12 -14 Z" fill={color} stroke="#10161c" strokeWidth={2} strokeLinejoin="round" />
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

export function MapPin({ x, y, color, Icon, label, scale = 0.82, ring, BadgeIcon, badgeText, badgeColor, badgeGlyph, centered, heading, onActivate, onHoverChange }: MapPinProps) {
  const interactive = !!onActivate;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };
  return (
    <g
      data-pin
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerEnter={onHoverChange && (() => onHoverChange(true))}
      onPointerLeave={onHoverChange && (() => onHoverChange(false))}
      onFocus={onHoverChange && (() => onHoverChange(true))}
      onBlur={onHoverChange && (() => onHoverChange(false))}
      className={interactive ? "cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-125" : "pointer-events-none"}
    >
      <title>{label}</title>
      <PinShape color={color} Icon={Icon} ring={ring} BadgeIcon={BadgeIcon} badgeText={badgeText} badgeColor={badgeColor} badgeGlyph={badgeGlyph} centered={centered} heading={heading} />
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
function WarehouseShape({ fill, stroke, glyph, Icon, dashed, ring }: { fill: string; stroke: string; glyph: string; Icon: LucideIcon; dashed?: boolean; ring?: boolean }) {
  const h = WAREHOUSE_HALF;
  return (
    <>
      {ring && (
        <rect x={-h - 6} y={-h - 6} width={2 * h + 12} height={2 * h + 12} rx={14} fill="none" stroke={stroke} strokeWidth={3}>
          <animate attributeName="opacity" values=".9;0;.9" dur="1.8s" repeatCount="indefinite" />
        </rect>
      )}
      {/* Contorno oscuro para que el borde de color se lea sobre la retícula. */}
      <rect x={-h} y={-h} width={2 * h} height={2 * h} rx={10} fill={fill} stroke="#10161c" strokeWidth={7} />
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
  onActivate?: () => void;
  onHoverChange?: (hovered: boolean) => void;
};

export function WarehouseMarker({ x, y, label, ring, onActivate, onHoverChange, ...look }: WarehouseMarkerProps) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };
  return (
    <g
      data-pin
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      role="button"
      tabIndex={0}
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
      <WarehouseShape {...look} ring={ring} />
    </g>
  );
}

/** Almacén aislado (leyenda). */
export function WarehouseGlyph({ size = 28, ...look }: WarehouseLook & { size?: number }) {
  const b = WAREHOUSE_HALF + 4;
  return (
    <svg width={size} height={size} viewBox={`${-b} ${-b} ${2 * b} ${2 * b}`} aria-hidden className="shrink-0 overflow-visible">
      <WarehouseShape {...look} />
    </svg>
  );
}

/** Marcador aislado (leyenda). */
export function PinGlyph({ color, Icon, size = 28, BadgeIcon, badgeText, badgeColor, badgeGlyph }: { color: string; Icon: LucideIcon; size?: number; BadgeIcon?: LucideIcon; badgeText?: string; badgeColor?: string; badgeGlyph?: string }) {
  return (
    <svg width={size} height={Math.round((size * 56) / 46)} viewBox="-23 -53 46 56" aria-hidden className="shrink-0 overflow-visible">
      <PinShape color={color} Icon={Icon} BadgeIcon={BadgeIcon} badgeText={badgeText} badgeColor={badgeColor} badgeGlyph={badgeGlyph} />
    </svg>
  );
}
