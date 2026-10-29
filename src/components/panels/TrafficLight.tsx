"use client";

import { CircleHelp, SlidersVertical } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage, NumberInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { DEFAULT_TRAFFIC_LIGHT, TRAFFIC_LIGHT_MAX } from "@/lib/constants";
import { saveOperationTrafficLight } from "@/lib/data/actions";
import { sameTrafficLight, setLimit, validateTrafficLight, type TrafficLightKey } from "@/lib/traffic-light";
import type { TrafficLight } from "@/lib/types";

/** Barra de los tres rangos sobre la escala 0–1000. */
export function TrafficLightPreview({ value: t }: { value: TrafficLight }) {
  const pct = (n: number) => `${(n / TRAFFIC_LIGHT_MAX) * 100}%`;
  return (
    <div>
      <div role="img" aria-label={`Rojo de 0 a ${t.redTo}, ámbar de ${t.amberFrom} a ${t.amberTo}, verde de ${t.greenFrom} a ${TRAFFIC_LIGHT_MAX}`} className="flex h-3 gap-0.5">
        <i className="min-w-1 rounded bg-critic" style={{ flex: t.redTo }} />
        <i className="min-w-1 rounded bg-warning" style={{ flex: Math.max(0, t.amberTo - t.amberFrom) }} />
        <i className="min-w-1 rounded bg-success" style={{ flex: Math.max(0, TRAFFIC_LIGHT_MAX - t.greenFrom) }} />
      </div>
      <div aria-hidden className="relative mt-1.5 h-4 text-[11px] text-n400 tabular-nums">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(t.redTo) }}>{t.redTo}</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(t.amberTo) }}>{t.amberTo}</span>
        <span className="absolute right-0">{TRAFFIC_LIGHT_MAX}</span>
      </div>
    </div>
  );
}

/** Editor de rangos. Los límites contiguos se enlazan solos. */
export function TrafficLightEditor({ value, onChange, readOnly }: { value: TrafficLight; onChange: (t: TrafficLight) => void; readOnly?: boolean }) {
  const error = validateTrafficLight(value);
  const bad = (k: TrafficLightKey) => !!error?.keys.includes(k);
  const num = (k: TrafficLightKey, label: string) => (
    <NumberInput aria-label={label} value={String(value[k])} step={10} min={0} max={TRAFFIC_LIGHT_MAX} disabled={readOnly} error={bad(k)} onValueChange={(v) => onChange(setLimit(value, k, Number(v) || 0))} />
  );
  const fixed = (n: number) => <div className="flex h-10 items-center rounded-lg border border-dashed border-line-strong px-3 text-base text-n300 tabular-nums">{n}</div>;
  const row = (color: string, name: string, hint: string, from: ReactNode, to: ReactNode) => (
    <div className="grid grid-cols-[1fr_92px_14px_92px] items-center gap-2 border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <i className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
        <div><b className="block text-sm leading-tight font-semibold text-white">{name}</b><small className="block text-xs text-n500">{hint}</small></div>
      </div>
      {from}
      <span aria-hidden className="text-center text-n600">–</span>
      {to}
    </div>
  );
  return (
    <PanelSection
      title="Semáforo de almacenes"
      icon={<SlidersVertical className="size-[18px]" aria-hidden />}
      action={<span title="Define en qué rango de ocupación (en paquetes, de 0 a 1000) un almacén se muestra en verde, ámbar o rojo. Los límites contiguos se enlazan solos." className="cursor-help text-n400"><CircleHelp className="size-5" aria-label="Ayuda" /></span>}
    >
      <div className="rounded-xl border border-line bg-night p-4"><TrafficLightPreview value={value} /></div>
      <div>
        <div className="grid grid-cols-[1fr_92px_14px_92px] gap-2 pb-1 text-xs text-n600"><span /><span>Desde</span><span /><span>Hasta</span></div>
        {row("var(--color-success)", "Verde", "Stock suficiente", num("greenFrom", "Verde desde"), fixed(TRAFFIC_LIGHT_MAX))}
        {row("var(--color-warning)", "Ámbar", "Conviene reabastecer", num("amberFrom", "Ámbar desde"), num("amberTo", "Ámbar hasta"))}
        {row("var(--color-critic)", "Rojo", "Nivel crítico", fixed(0), num("redTo", "Rojo hasta"))}
      </div>
      {error && !readOnly && <ErrorMessage>{error.message}</ErrorMessage>}
    </PanelSection>
  );
}

/** Panel de operaciones diarias. Montar con key={JSON del valor guardado} para reiniciar el borrador. */
export function TrafficLightPanel({ saved, onClose, width }: { saved: TrafficLight; onClose: () => void; width: number }) {
  const toast = useToast();
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const dirty = !sameTrafficLight(draft, saved);
  const invalid = !!validateTrafficLight(draft);

  const save = async () => {
    setBusy(true);
    const res = await saveOperationTrafficLight(draft);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success("Los rangos del semáforo se guardaron correctamente.");
  };

  return (
    <SidePanel
      title="Semáforo"
      subtitle="Rangos de ocupación de los almacenes."
      onClose={onClose}
      width={width}
      footer={
        <>
          <Button variant="text" onClick={() => setDraft(DEFAULT_TRAFFIC_LIGHT)}>Restablecer</Button>
          <Button className="flex-1" onClick={save} loading={busy} loadingText="Guardando…" disabled={!dirty || invalid}>Guardar cambios</Button>
        </>
      }
    >
      <TrafficLightEditor value={draft} onChange={setDraft} />
    </SidePanel>
  );
}
