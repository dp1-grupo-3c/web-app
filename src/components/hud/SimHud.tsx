import { Button } from "@/components/ui/Button";
import { Meter } from "@/components/ui/feedback";
import { SIMULATION_DAYS_5D, SIMULATION_TITLE } from "@/lib/constants";
import { formatClock, formatElapsed, formatNumber, formatTime, formatWeekdayDate, parseISODate } from "@/lib/format";
import type { SimulationClock, SimulationMode } from "@/lib/types";
import { HudBar, HudSection, Kpi } from "./Hud";

type SimHudProps = {
  mode: SimulationMode;
  /** Instante de arranque ("2026-09-02T10:30" o solo la fecha), hasta que llegue la primera foto. */
  start: string;
  clock: SimulationClock | null;
  ended: boolean;
  compact: boolean;
  /** Desfase del mapa respecto del servidor por el buffer de reproducción, en segundos. */
  lagSeconds?: number;
  onCancel: () => void;
};

/**
 * Barra de la simulación: fecha simulada, progreso, KPIs y cancelar.
 * No hay control de pausa ni de velocidad: el backend no los soporta
 * (ver GUIA_FLUJO_DATOS.md, "Lo que el backend no ofrece hoy").
 */
export function SimHud({ mode, start, clock, ended, compact, lagSeconds = 0, onCancel }: SimHudProps) {
  const elapsed = clock?.elapsedMinutes ?? 0;
  const now = clock ? new Date(clock.simTime) : start.includes("T") ? new Date(start) : parseISODate(start);
  const day = Math.floor(elapsed / 1440) + 1;
  return (
    <HudBar dimmed={ended}>
      <HudSection>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-n500">{SIMULATION_TITLE[mode]}</span>
          <b className="text-[17px] leading-tight whitespace-nowrap text-white tabular-nums">{formatWeekdayDate(now)} · {formatTime(now)}</b>
          {!ended && lagSeconds > 0 && (
            <span
              className="cursor-help text-[11px] leading-tight whitespace-nowrap text-n500"
              title="Para que el movimiento sea fluido, el mapa y la hora se muestran unos segundos por detrás del servidor. Las averías se aplican sobre el estado actual del servidor, que va por delante: tenlo en cuenta al calcular."
            >
              Vista ~{lagSeconds} s por detrás del servidor
            </span>
          )}
        </div>
        {mode === "5d" ? (
          <div className="flex w-[140px] flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs text-n400">
              <span>Progreso</span>
              <b className="text-[13px] text-white">Día {Math.min(SIMULATION_DAYS_5D, day)} de {SIMULATION_DAYS_5D}</b>
            </div>
            <Meter value={elapsed / (SIMULATION_DAYS_5D * 1440)} color="var(--color-pink)" label="Progreso de la simulación" className="h-1.5" />
          </div>
        ) : (
          <Kpi label="Progreso" value={`Día ${day}`} />
        )}
      </HudSection>
      <HudSection>
        <Kpi label="Transcurrido" value={clock ? formatElapsed(elapsed) : "—"} />
        {!compact && <Kpi label="Tiempo real" value={clock ? formatClock(clock.realSeconds) : "—"} />}
        <Kpi label="Entregados" value={clock ? formatNumber(clock.delivered) : "—"} />
      </HudSection>
      <HudSection>
        <Button variant="danger" size="sm" onClick={onCancel} disabled={ended}>{ended ? "Finalizada" : "Cancelar"}</Button>
      </HudSection>
    </HudBar>
  );
}
