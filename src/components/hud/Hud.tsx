import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { Alert } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatElapsed, formatNumber, formatTime, formatWeekdayDate } from "@/lib/format";
import type { ConnectionState, OpsClock, OpsKpis } from "@/lib/types";

/** Barra flotante sobre el mapa, dividida en secciones. */
export function HudBar({ children, dimmed }: { children: ReactNode; dimmed?: boolean }) {
  return (
    <div className={cn("flex items-stretch rounded-[14px] border border-line bg-panel/95 shadow-[0_8px_24px_rgb(0_0_0/0.35)] backdrop-blur", dimmed && "opacity-60")}>
      {children}
    </div>
  );
}
export function HudSection({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-4 border-l border-line px-4 py-2.5 first:border-l-0">{children}</div>;
}

export function Kpi({ label, value, onClick, labelIcon }: { label: string; value: ReactNode; onClick?: () => void; labelIcon?: ReactNode }) {
  const body = (
    <>
      <span className="flex items-center gap-1 text-xs whitespace-nowrap text-n500">{labelIcon}{label}</span>
      <span className="text-xl leading-tight font-bold whitespace-nowrap text-white tabular-nums">{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={`Ver ${label.toLowerCase()}`} className="-mx-1.5 -my-0.5 flex min-w-[74px] flex-col gap-0.5 rounded-lg px-1.5 py-0.5 text-left hover:bg-field">
      {body}
    </button>
  ) : (
    <div className="flex min-w-[74px] flex-col gap-0.5">{body}</div>
  );
}

const CONNECTION: Record<ConnectionState, { title: string; detail: string; dot: string }> = {
  live: { title: "En vivo", detail: "Conexión estable", dot: "bg-success animate-live" },
  reconnecting: { title: "Reconectando…", detail: "Reintentamos en unos segundos", dot: "bg-warning shadow-[0_0_0_4px_rgb(253_192_69/0.2)] animate-blink" },
  offline: { title: "Sin conexión", detail: "Mostramos el último dato recibido", dot: "bg-critic shadow-[0_0_0_4px_rgb(253_69_118/0.2)]" },
  waiting: { title: "Esperando datos", detail: "Aún no hay una fuente conectada", dot: "bg-n700 shadow-[0_0_0_4px_rgb(125_133_145/0.2)]" },
};

/** Estado de conexión: color + texto, nunca solo color. */
export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const c = CONNECTION[state];
  return (
    <div role="status" className="flex items-center gap-2.5">
      <i className={cn("size-3 shrink-0 rounded-full", c.dot)} />
      <div>
        <b className="block text-sm leading-tight text-white">{c.title}</b>
        <small className="block text-xs whitespace-nowrap text-n500">{c.detail}</small>
      </div>
    </div>
  );
}

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === "offline")
    return (
      <Alert tone="crit" icon={<WifiOff className="size-5" aria-hidden />} className="w-[460px] bg-panel">
        <b>Perdimos la conexión.</b> El mapa muestra el último dato recibido. Seguimos intentando reconectar.
      </Alert>
    );
  if (state === "reconnecting")
    return (
      <Alert tone="warn" icon={<RefreshCw className="size-5 animate-spin" aria-hidden />} className="w-[460px] bg-panel">
        <b>Estamos reconectando…</b> En unos segundos verás la información actualizada.
      </Alert>
    );
  return null;
}

const dash = "—";

/** Fecha y hora de un reloj y su tiempo transcurrido, al minuto. */
function ClockKpi({ label, date, elapsedLabel, elapsed }: { label: string; date: Date | null; elapsedLabel: string; elapsed: number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs whitespace-nowrap text-n500">{label}</span>
      <b className="text-[15px] leading-tight whitespace-nowrap text-white tabular-nums">{date ? `${formatWeekdayDate(date)} · ${formatTime(date)}` : dash}</b>
      <span className="text-xs whitespace-nowrap text-n500 tabular-nums">{elapsedLabel}: <span className="text-white">{elapsed == null ? dash : formatElapsed(elapsed)}</span></span>
    </div>
  );
}

/**
 * Resumen de operaciones diarias: conexión, relojes, flota, pedidos, entregados
 * y alertas. Con `compact` (panel abierto) se ocultan la flota y los entregados para dar espacio a los relojes.
 */
export function OpsHud({ connection, clock, kpis, compact, onOpenOrders, onOpenBreakdowns }: { connection: ConnectionState; clock: OpsClock | null; kpis: OpsKpis | null; compact: boolean; onOpenOrders: () => void; onOpenBreakdowns: () => void }) {
  return (
    <HudBar>
      <HudSection><ConnectionStatus state={connection} /></HudSection>
      <HudSection>
        <ClockKpi label="Fecha y hora simulada" date={clock?.simTime ?? null} elapsedLabel="Transcurrido simulado" elapsed={clock?.simElapsedMinutes ?? null} />
        <ClockKpi label="Fecha y hora actual" date={clock?.now ?? null} elapsedLabel="Transcurrido real" elapsed={clock?.realElapsedMinutes ?? null} />
      </HudSection>
      {!compact && <HudSection>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-n500">Flota activa</span>
          <div className="flex items-center gap-3 text-base font-semibold text-white tabular-nums">
            {VEHICLE_ORDER.map((k) => {
              const { Icon, color, plural } = VEHICLE_META[k];
              const n = kpis ? kpis.fleet[k] : null;
              return (
                <span key={k} title={plural} aria-label={`${plural}: ${n ?? "sin datos"}`} className="inline-flex items-center gap-1.5">
                  <Icon className="size-[18px]" style={{ color }} aria-hidden />
                  {n ?? dash}
                </span>
              );
            })}
          </div>
        </div>
      </HudSection>}
      <HudSection>
        <Kpi label="Pedidos activos" value={kpis ? formatNumber(kpis.activeOrders) : dash} onClick={onOpenOrders} />
        {!compact && <Kpi label="Entregados hoy" value={kpis ? formatNumber(kpis.deliveredToday) : dash} />}
        <Kpi label="Alertas" labelIcon={<TriangleAlert className="size-3 text-critic" aria-hidden />} value={kpis ? kpis.alerts : dash} onClick={onOpenBreakdowns} />
      </HudSection>
    </HudBar>
  );
}
