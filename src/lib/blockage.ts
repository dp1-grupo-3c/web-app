import { BLOCKAGE_ENDING_WINDOW } from "@/config/simulacion";
import { formatSimClock } from "@/lib/data/selectors";
import { formatDuration } from "@/lib/format";
import type { Blockage, MotionSample } from "@/lib/types";

/** Minutos simulados finales en los que un bloqueo de esta duración se marca "por terminar". */
export function endingWindow(durationMinutes: number): number {
  const { maxMin, ratio, minMin } = BLOCKAGE_ENDING_WINDOW;
  return Math.max(0, Math.min(durationMinutes, Math.max(minMin, Math.min(maxMin, ratio * durationMinutes))));
}

/**
 * Minutos simulados que le quedan al bloqueo si está en su tramo final, o
 * null si no lo está (o faltan datos). Depende solo del minuto mostrado, así
 * que reiniciar o cambiar de corrida no deja estados colgados.
 */
export function endingIn(b: Blockage, minute: number | undefined): number | null {
  if (minute == null || b.startMinute == null || b.endMinute == null) return null;
  const left = b.endMinute - minute;
  return left > 0 && left <= endingWindow(b.endMinute - b.startMinute) ? left : null;
}

/** Inicio y fin en hora simulada ("HH:MM" o "dd/mm HH:MM") y duración; "—" sin dato. */
export function blockageSchedule(b: Blockage, sample: MotionSample | undefined) {
  const clock = (minute: number | undefined) => formatSimClock(sample?.simTime ?? null, sample?.simulatedMinute ?? null, minute ?? null);
  return {
    start: clock(b.startMinute),
    end: clock(b.endMinute),
    duration: b.startMinute != null && b.endMinute != null ? formatDuration(b.endMinute - b.startMinute) : "—",
  };
}
