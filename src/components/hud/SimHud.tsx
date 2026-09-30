import { Pause, Play } from "lucide-react";
import { Button, ControlButton } from "@/components/ui/Button";
import { Meter } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { SIMULATION_DAYS_5D, SIMULATION_TITLE } from "@/lib/constants";
import { addMinutes, formatClock, formatElapsed, formatNumber, formatTime, formatWeekdayDate, parseISODate } from "@/lib/format";
import type { SimulationClock, SimulationMode } from "@/lib/types";
import { HudBar, HudSection, Kpi } from "./Hud";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

type SimHudProps = {
  mode: SimulationMode;
  startDate: string;
  clock: SimulationClock | null;
  ended: boolean;
  paused: boolean;
  speed: Speed;
  compact: boolean;
  onTogglePause: () => void;
  onSpeed: (s: Speed) => void;
  onCancel: () => void;
};

/** Barra de la simulación: control, fecha simulada, progreso, KPIs y cancelar. */
export function SimHud({ mode, startDate, clock, ended, paused, speed, compact, onTogglePause, onSpeed, onCancel }: SimHudProps) {
  const elapsed = clock?.elapsedMinutes ?? 0;
  const now = clock ? new Date(clock.simTime) : addMinutes(parseISODate(startDate), 0);
  const day = Math.floor(elapsed / 1440) + 1;
  return (
    <HudBar dimmed={ended}>
      <HudSection>
        <ControlButton solid label={paused ? "Reanudar" : "Pausar"} onClick={onTogglePause} disabled={ended}>
          {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </ControlButton>
        {!compact && (
          <div role="group" aria-label="Velocidad" className="flex gap-0.5 rounded-lg border border-line bg-night p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                disabled={ended}
                onClick={() => onSpeed(s)}
                className={cn("h-7 min-w-[34px] rounded-md text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50", speed === s ? "bg-craft/22 text-craft" : "text-n400 hover:text-white")}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </HudSection>
      <HudSection>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-n500">{SIMULATION_TITLE[mode]}</span>
          <b className="text-[17px] leading-tight whitespace-nowrap text-white tabular-nums">{formatWeekdayDate(now)} · {formatTime(now)}</b>
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
