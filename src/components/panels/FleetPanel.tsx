"use client";

import { Gauge, Minus, Plus } from "lucide-react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { IconButton } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/form";
import { PanelSection } from "@/components/workspace/SidePanel";
import { FLEET_LIMITS } from "@/config/simulacion";
import { formatNumber } from "@/lib/format";
import { decimalInRange, integerInRange, parseDecimal } from "@/lib/validation";
import type { FleetSettings, VehicleKind } from "@/lib/types";

/** Valores tal como están escritos en los campos. */
export type FleetDraft = Record<VehicleKind, { quantity: string; speed: string }>;
type Key = "quantity" | "speed";
export type FleetErrors = Record<VehicleKind, Record<Key, string | null>>;

export const toFleetDraft = (f: FleetSettings): FleetDraft =>
  Object.fromEntries(VEHICLE_ORDER.map((k) => [k, { quantity: String(f[k].quantity), speed: String(f[k].speed) }])) as FleetDraft;

const check = (key: Key, raw: string) =>
  key === "quantity" ? integerInRange(raw, FLEET_LIMITS.quantity.min, FLEET_LIMITS.quantity.max) : decimalInRange(raw, FLEET_LIMITS.speed);

export const fleetDraftErrors = (d: FleetDraft): FleetErrors =>
  Object.fromEntries(VEHICLE_ORDER.map((k) => [k, { quantity: check("quantity", d[k].quantity), speed: check("speed", d[k].speed) }])) as FleetErrors;

export const hasFleetErrors = (e: FleetErrors) => VEHICLE_ORDER.some((k) => e[k].quantity || e[k].speed);

export const parseFleetDraft = (d: FleetDraft): FleetSettings =>
  Object.fromEntries(VEHICLE_ORDER.map((k) => [k, { quantity: parseDecimal(d[k].quantity), speed: parseDecimal(d[k].speed) }])) as FleetSettings;

export const sameFleet = (a: FleetSettings, b: FleetSettings) =>
  VEHICLE_ORDER.every((k) => a[k].quantity === b[k].quantity && a[k].speed === b[k].speed);

/** Botón −, campo editable y botón +. Los botones no salen del rango válido. */
function Stepper({ id, value, onChange, step, min, max, minExclusive, decimals, error, unit, disabled }: {
  id: string; value: string; onChange: (v: string) => void; step: number; min: number; max: number;
  minExclusive?: boolean; decimals: number; error: boolean; unit: string; disabled?: boolean;
}) {
  const n = parseDecimal(value);
  const round = (x: number) => Number(x.toFixed(decimals));
  const canDown = Number.isFinite(n) && (minExclusive ? round(n - step) > min : round(n - step) >= min);
  const canUp = !Number.isFinite(n) || round(n + step) <= max;
  const bump = (dir: 1 | -1) => onChange(String(Number.isFinite(n) ? round(n + dir * step) : minExclusive ? step : min));
  return (
    <div className="flex items-center gap-1.5">
      <IconButton label={`Disminuir ${unit}`} size="sm" disabled={disabled || !canDown} onClick={() => bump(-1)} className="border border-line-strong disabled:cursor-not-allowed disabled:opacity-40"><Minus className="size-4" /></IconButton>
      <TextInput id={id} disabled={disabled} inputMode={decimals ? "decimal" : "numeric"} value={value} error={error} onChange={(e) => onChange(e.target.value)} className="text-center tabular-nums" />
      <IconButton label={`Aumentar ${unit}`} size="sm" disabled={disabled || !canUp} onClick={() => bump(1)} className="border border-line-strong disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" /></IconButton>
    </div>
  );
}

/**
 * Pestaña "Flota" de la configuración: cantidad de vehículos y velocidad por
 * tipo. Es un borrador controlado por la pantalla: se aplica al comenzar la
 * simulación y, durante la corrida, se muestra en solo lectura con los valores
 * que eligió el usuario.
 */
export function FleetEditor({ draft, onChange, errors, readOnly }: { draft: FleetDraft; onChange: (d: FleetDraft) => void; errors: FleetErrors; readOnly?: boolean }) {
  const change = (k: VehicleKind, key: Key, v: string) => onChange({ ...draft, [k]: { ...draft[k], [key]: v } });
  return (
    <>
      {VEHICLE_ORDER.map((k) => {
        const { plural, Icon, color } = VEHICLE_META[k];
        const err = readOnly ? { quantity: null, speed: null } : errors[k];
        return (
          <PanelSection key={k} title={plural} icon={<Icon className="size-[18px]" style={{ color }} aria-hidden />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" htmlFor={`f-${k}-q`} required={!readOnly} error={err.quantity}>
                <Stepper id={`f-${k}-q`} unit="cantidad" disabled={readOnly} value={draft[k].quantity} onChange={(v) => change(k, "quantity", v)} step={FLEET_LIMITS.quantity.step} min={FLEET_LIMITS.quantity.min} max={FLEET_LIMITS.quantity.max} decimals={0} error={!!err.quantity} />
              </Field>
              <Field label="Velocidad (km/h)" htmlFor={`f-${k}-s`} required={!readOnly} error={err.speed}>
                <Stepper id={`f-${k}-s`} unit="velocidad" disabled={readOnly} value={draft[k].speed} onChange={(v) => change(k, "speed", v)} step={FLEET_LIMITS.speed.step} min={FLEET_LIMITS.speed.min} minExclusive={FLEET_LIMITS.speed.minExclusive} max={FLEET_LIMITS.speed.max} decimals={FLEET_LIMITS.speed.decimals} error={!!err.speed} />
              </Field>
            </div>
          </PanelSection>
        );
      })}
      {!readOnly && (
        <p className="flex items-start gap-1.5 text-xs leading-snug text-n600">
          <Gauge className="mt-px size-3.5 shrink-0" aria-hidden />
          Cantidad: entero de {FLEET_LIMITS.quantity.min} a {formatNumber(FLEET_LIMITS.quantity.max)}. Velocidad: mayor que 0 y hasta {formatNumber(FLEET_LIMITS.speed.max)} km/h, con {FLEET_LIMITS.speed.decimals} decimal como máximo. Se aplican al comenzar la simulación.
        </p>
      )}
    </>
  );
}
