"use client";

import type { ReactNode } from "react";
import { TONE_ICON } from "@/components/ui/ToneBadge";
import { ErrorMessage, NumberInput } from "@/components/ui/form";
import type { ToneDirection } from "@/lib/occupancy";
import { validateBands } from "@/lib/sim-settings";
import type { PercentBands, StatusTone } from "@/lib/types";

const COLOR: Record<StatusTone, string> = { ok: "bg-success", warn: "bg-warning", crit: "bg-critic" };
const TEXT: Record<StatusTone, string> = { ok: "text-[#7ef08d]", warn: "text-warning", crit: "text-[#ff86a6]" };

/** Un límite vacío o no numérico queda NaN (lo marca la validación y bloquea el inicio). */
const toNumber = (text: string) => (text.trim() === "" ? NaN : Number(text));
const shown = (n: number) => (Number.isNaN(n) ? "" : String(n));
const fmt = (n: number) => (Number.isFinite(n) ? `${n} %` : "—");

/** Texto de los tres rangos, en el orden de la barra (de 0 a 100 %). */
function ranges(b: PercentBands, direction: ToneDirection): [StatusTone, string][] {
  return direction === "lowIsGreen"
    ? [["ok", `menos de ${fmt(b.low)}`], ["warn", `${fmt(b.low)} a ${fmt(b.high)}`], ["crit", `más de ${fmt(b.high)}`]]
    : [["crit", `hasta ${fmt(b.low)}`], ["warn", `más de ${fmt(b.low)} y menos de ${fmt(b.high)}`], ["ok", `desde ${fmt(b.high)}`]];
}

/**
 * Editor de un semáforo en %: dos límites, una barra de vista previa y la
 * leyenda en texto con íconos (no depende solo del color).
 */
export function PercentBandsEditor({ id, label, icon, value, onChange, direction, readOnly }: {
  id: string;
  label: string;
  icon?: ReactNode;
  value: PercentBands;
  onChange: (b: PercentBands) => void;
  direction: ToneDirection;
  readOnly?: boolean;
}) {
  const error = validateBands(value);
  const bad = (k: keyof PercentBands) => !!error?.keys.includes(k);
  const parts = ranges(value, direction);
  const lo = Number.isFinite(value.low) ? Math.max(0, Math.min(100, value.low)) : 0;
  const hi = Number.isFinite(value.high) ? Math.max(lo, Math.min(100, value.high)) : lo;
  const flex = [lo, hi - lo, 100 - hi];
  const [first, second] = direction === "lowIsGreen" ? ["Límite verde/ámbar", "Límite ámbar/rojo"] : ["Límite rojo/ámbar", "Límite ámbar/verde"];
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="grid gap-2.5 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="grid grid-cols-[1fr_104px_104px] items-end gap-2">
        <span id={`${id}-label`} className="flex items-center gap-2 pb-2.5 text-sm font-semibold text-white">{icon}{label}</span>
        <label className="grid gap-1 text-[11px] leading-tight text-n500">
          {first} (%)
          <NumberInput aria-label={`${label}: ${first} (%)`} value={shown(value.low)} min={0} max={100} step={5} disabled={readOnly} error={bad("low")} onValueChange={(t) => onChange({ ...value, low: toNumber(t) })} />
        </label>
        <label className="grid gap-1 text-[11px] leading-tight text-n500">
          {second} (%)
          <NumberInput aria-label={`${label}: ${second} (%)`} value={shown(value.high)} min={0} max={100} step={5} disabled={readOnly} error={bad("high")} onValueChange={(t) => onChange({ ...value, high: toNumber(t) })} />
        </label>
      </div>
      <div aria-hidden className="flex h-2.5 gap-0.5">
        {parts.map(([tone], i) => <i key={tone} className={`min-w-1 rounded ${COLOR[tone]}`} style={{ flex: flex[i] }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {parts.map(([tone, text]) => {
          const Icon = TONE_ICON[tone];
          return (
            <li key={tone} className={`flex items-center gap-1 ${TEXT[tone]}`}>
              <Icon className="size-3.5" aria-hidden />
              <span><b className="font-semibold">{tone === "ok" ? "Verde" : tone === "warn" ? "Ámbar" : "Rojo"}</b> <span className="text-n300">{text}</span></span>
            </li>
          );
        })}
      </ul>
      {error && !readOnly && <ErrorMessage>{error.message}</ErrorMessage>}
    </div>
  );
}
