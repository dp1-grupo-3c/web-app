import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "ok" | "warn" | "crit" | "neutral" | "pink";
const BADGE: Record<BadgeTone, string> = {
  ok: "bg-success/13 text-[#7ef08d]",
  warn: "bg-warning/14 text-warning",
  crit: "bg-critic/14 text-[#ff86a6]",
  neutral: "bg-field text-n100",
  pink: "bg-pink/14 text-pink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-[5px] text-xs leading-none font-semibold whitespace-nowrap", BADGE[tone], className)}>
      {children}
    </span>
  );
}

/** Barra de progreso fina (4 px de radio en los extremos). */
export function Meter({ value, color, label, className }: { value: number; color: string; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cn("h-2 overflow-hidden rounded bg-line-strong", className)}>
      <i className="block h-full rounded" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

type AlertTone = "info" | "ok" | "warn" | "crit";
const ALERT: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-craft/35 bg-craft/8", icon: "text-craft", Icon: Info },
  ok: { box: "border-success/35 bg-success/8", icon: "text-success", Icon: CircleCheck },
  warn: { box: "border-warning/35 bg-warning/8", icon: "text-warning", Icon: TriangleAlert },
  crit: { box: "border-critic/40 bg-critic/8", icon: "text-critic", Icon: CircleAlert },
};

export function Alert({ tone = "info", icon, children, className, style }: { tone?: AlertTone; icon?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  const a = ALERT[tone];
  return (
    <div role={tone === "info" ? "note" : "alert"} style={style} className={cn("flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 text-sm leading-snug text-n50", a.box, className)}>
      <span className={cn("mt-px shrink-0", a.icon)}>{icon ?? <a.Icon className="size-5" aria-hidden />}</span>
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, className }: { icon: ReactNode; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-7 text-center", className)}>
      <span className="text-n700">{icon}</span>
      <p className="text-sm font-semibold text-n100">{title}</p>
      {children && <p className="max-w-[280px] text-[13px] leading-snug text-n500">{children}</p>}
    </div>
  );
}

/** Contenedor cuadrado de ícono con fondo tintado. */
export function Tile({ children, color, size = 40, className }: { children: ReactNode; color: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-[10px]", className)}
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function StatCard({ label, value, detail, compactValue = false, centered = false }: { label: string; value: ReactNode; detail?: ReactNode; compactValue?: boolean; centered?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-center gap-1 rounded-xl border border-line bg-night px-4 py-3.5", centered && "items-center text-center")} style={compactValue ? { containerType: "inline-size" } : undefined}>
      <span className="text-xs text-n500">{label}</span>
      <span className={cn("block w-full min-w-0 font-bold whitespace-nowrap text-white tabular-nums", compactValue ? "leading-snug" : "text-2xl leading-tight")} title={typeof value === "string" ? value : undefined} style={compactValue ? { fontSize: `min(1.125rem, ${145 / (typeof value === "string" || typeof value === "number" ? Math.max(1, String(value).length) : 16)}cqw)` } : undefined}>{value}</span>
      {detail && <span className="text-xs text-n500">{detail}</span>}
    </div>
  );
}
