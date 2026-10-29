"use client";

import { Gauge, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { Button, IconButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { FLEET_LIMITS } from "@/config/simulacion";
import { saveFleet } from "@/lib/data/actions";
import { formatNumber } from "@/lib/format";
import { decimalInRange, integerInRange, parseDecimal } from "@/lib/validation";
import type { FleetSettings, VehicleKind } from "@/lib/types";

type Draft = Record<VehicleKind, { quantity: string; speed: string }>;
type Key = "quantity" | "speed";

const toDraft = (f: FleetSettings): Draft =>
  Object.fromEntries(VEHICLE_ORDER.map((k) => [k, { quantity: String(f[k].quantity), speed: String(f[k].speed) }])) as Draft;

const check = (key: Key, raw: string) =>
  key === "quantity" ? integerInRange(raw, FLEET_LIMITS.quantity.min, FLEET_LIMITS.quantity.max) : decimalInRange(raw, FLEET_LIMITS.speed);

/** Botón −, campo editable y botón +. Los botones no salen del rango válido. */
function Stepper({ id, value, onChange, step, min, max, minExclusive, decimals, error, unit }: {
  id: string; value: string; onChange: (v: string) => void; step: number; min: number; max: number;
  minExclusive?: boolean; decimals: number; error: boolean; unit: string;
}) {
  const n = parseDecimal(value);
  const round = (x: number) => Number(x.toFixed(decimals));
  const canDown = Number.isFinite(n) && (minExclusive ? round(n - step) > min : round(n - step) >= min);
  const canUp = !Number.isFinite(n) || round(n + step) <= max;
  const bump = (dir: 1 | -1) => onChange(String(Number.isFinite(n) ? round(n + dir * step) : minExclusive ? step : min));
  return (
    <div className="flex items-center gap-1.5">
      <IconButton label={`Disminuir ${unit}`} size="sm" disabled={!canDown} onClick={() => bump(-1)} className="border border-line-strong disabled:cursor-not-allowed disabled:opacity-40"><Minus className="size-4" /></IconButton>
      <TextInput id={id} inputMode={decimals ? "decimal" : "numeric"} value={value} error={error} onChange={(e) => onChange(e.target.value)} className="text-center tabular-nums" />
      <IconButton label={`Aumentar ${unit}`} size="sm" disabled={!canUp} onClick={() => bump(1)} className="border border-line-strong disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" /></IconButton>
    </div>
  );
}

/**
 * Tab "Flota": cantidad de vehículos y velocidad por tipo. Montar con
 * key={version} para reiniciar el borrador cuando el servidor confirme otros
 * valores; mientras tanto el borrador no se pisa con cada fotografía.
 */
export function FleetPanel({ saved, onClose, width }: { saved: FleetSettings; onClose: () => void; width: number }) {
  const toast = useToast();
  const [initial] = useState(saved);
  const [draft, setDraft] = useState(() => toDraft(saved));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = Object.fromEntries(VEHICLE_ORDER.map((k) => [k, { quantity: check("quantity", draft[k].quantity), speed: check("speed", draft[k].speed) }])) as Record<VehicleKind, Record<Key, string | null>>;
  const invalid = VEHICLE_ORDER.some((k) => errors[k].quantity || errors[k].speed);
  const parsed = Object.fromEntries(VEHICLE_ORDER.map((k) => [k, { quantity: parseDecimal(draft[k].quantity), speed: parseDecimal(draft[k].speed) }])) as FleetSettings;
  const dirty = !invalid && VEHICLE_ORDER.some((k) => parsed[k].quantity !== initial[k].quantity || parsed[k].speed !== initial[k].speed);

  const change = (k: VehicleKind, key: Key, v: string) => { setDraft((d) => ({ ...d, [k]: { ...d[k], [key]: v } })); setFailure(null); };

  const accept = async () => {
    setBusy(true);
    const res = await saveFleet(parsed, initial);
    setBusy(false);
    if (!res.ok) { setFailure(res.message); return toast.error(res.message); }
    setFailure(null);
    toast.success("La flota se actualizó correctamente. Se aplicará en la siguiente planificación.");
  };

  return (
    <SidePanel
      title="Flota"
      subtitle="Cantidad de vehículos y velocidad por tipo."
      onClose={onClose}
      width={width}
      footer={
        <>
          <Button variant="text" disabled={busy} onClick={() => { setDraft(toDraft(initial)); setFailure(null); }}>Restablecer</Button>
          <Button className="flex-1" onClick={accept} loading={busy} loadingText="Enviando…" disabled={invalid || !dirty}>Aceptar</Button>
        </>
      }
    >
      {failure && <Alert tone="crit">{failure}</Alert>}
      {VEHICLE_ORDER.map((k) => {
        const { plural, Icon, color } = VEHICLE_META[k];
        return (
          <PanelSection key={k} title={plural} icon={<Icon className="size-[18px]" style={{ color }} aria-hidden />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" htmlFor={`f-${k}-q`} required error={errors[k].quantity}>
                <Stepper id={`f-${k}-q`} unit="cantidad" value={draft[k].quantity} onChange={(v) => change(k, "quantity", v)} step={FLEET_LIMITS.quantity.step} min={FLEET_LIMITS.quantity.min} max={FLEET_LIMITS.quantity.max} decimals={0} error={!!errors[k].quantity} />
              </Field>
              <Field label="Velocidad (km/h)" htmlFor={`f-${k}-s`} required error={errors[k].speed}>
                <Stepper id={`f-${k}-s`} unit="velocidad" value={draft[k].speed} onChange={(v) => change(k, "speed", v)} step={FLEET_LIMITS.speed.step} min={FLEET_LIMITS.speed.min} minExclusive={FLEET_LIMITS.speed.minExclusive} max={FLEET_LIMITS.speed.max} decimals={FLEET_LIMITS.speed.decimals} error={!!errors[k].speed} />
              </Field>
            </div>
          </PanelSection>
        );
      })}
      <p className="flex items-start gap-1.5 text-xs leading-snug text-n600">
        <Gauge className="mt-px size-3.5 shrink-0" aria-hidden />
        Cantidad: entero de {FLEET_LIMITS.quantity.min} a {formatNumber(FLEET_LIMITS.quantity.max)}. Velocidad: mayor que 0 y hasta {formatNumber(FLEET_LIMITS.speed.max)} km/h, con {FLEET_LIMITS.speed.decimals} decimal como máximo. Los cambios se aplican en la siguiente planificación.
      </p>
    </SidePanel>
  );
}
