import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";

/**
 * Marcador del mapa. La punta está en (0, 0) sobre la intersección y el círculo
 * (r = 20) en (0, −30). Caja real: x −21…21, y −51…1, así nunca se recorta.
 */
function PinShape({ color, Icon, ring, BadgeIcon, centered }: { color: string; Icon: LucideIcon; ring?: boolean; BadgeIcon?: LucideIcon; centered?: boolean }) {
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
      <Icon x={-11} y={-41} size={22} color="#161d25" strokeWidth={2} aria-hidden />
      {BadgeIcon && <g><circle cx={18} cy={-46} r={11} fill="var(--color-warning)" stroke="#10161c" strokeWidth={2} /><BadgeIcon x={12} y={-52} size={12} color="#161d25" aria-hidden /></g>}
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
  /** Centra el glifo sobre la coordenada; útil para bloqueos sobre su línea. */
  centered?: boolean;
  onActivate?: () => void;
};

export function MapPin({ x, y, color, Icon, label, scale = 0.82, ring, BadgeIcon, centered, onActivate }: MapPinProps) {
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
      className={interactive ? "cursor-pointer outline-none hover:brightness-110 focus-visible:brightness-125" : "pointer-events-none"}
    >
      <title>{label}</title>
      <PinShape color={color} Icon={Icon} ring={ring} BadgeIcon={BadgeIcon} centered={centered} />
    </g>
  );
}

/** Marcador aislado (leyenda). */
export function PinGlyph({ color, Icon, size = 28 }: { color: string; Icon: LucideIcon; size?: number }) {
  return (
    <svg width={size} height={Math.round((size * 56) / 46)} viewBox="-23 -53 46 56" aria-hidden className="shrink-0 overflow-visible">
      <PinShape color={color} Icon={Icon} />
    </svg>
  );
}
