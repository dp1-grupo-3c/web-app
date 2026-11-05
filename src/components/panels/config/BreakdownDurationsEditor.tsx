"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput } from "@/components/ui/form";
import { BREAKDOWN_DURATION_DEFAULTS, BREAKDOWN_DURATION_LIMITS, BREAKDOWN_DURATION_UNIT } from "@/config/simulacion";
import { breakdownDuration, defaultBreakdownDurations } from "@/lib/sim-settings";
import type { BreakdownDurations, BreakdownField } from "@/lib/types";

const UNIT_LABEL = { h: ["hora", "horas"], d: ["día", "días"], t: ["turno", "turnos"] } as const;
const unit = (f: BreakdownField, n: number) => UNIT_LABEL[BREAKDOWN_DURATION_UNIT[f]][n === 1 ? 0 : 1];

/** Un campo por atributo que usa la regla de reincorporación de cada tipo. */
const FIELDS: { key: BreakdownField; label: string }[] = [
  { key: "T1", label: "Tipo 1 · Leve: inmovilizado en el lugar" },
  { key: "T2", label: "Tipo 2 · Moderada: inmovilizado en el lugar" },
  { key: "T2Shifts", label: "Tipo 2 · Moderada: vuelve al cierre del turno, más" },
  { key: "T3OnSite", label: "Tipo 3 · Grave: inmovilizado en el lugar" },
  { key: "T3", label: "Tipo 3 · Grave: mantenimiento" },
];

/** Atributos de cada tipo de avería, en las unidades de su regla. */
export function BreakdownDurationsEditor({ value, onChange, readOnly }: { value: BreakdownDurations; onChange: (d: BreakdownDurations) => void; readOnly?: boolean }) {
  const isDefault = FIELDS.every(({ key }) => value[key] === BREAKDOWN_DURATION_DEFAULTS[key]);
  return (
    <div className="grid gap-4">
      {FIELDS.map(({ key, label }) => {
        const error = readOnly ? null : breakdownDuration(key, value[key]);
        const { min, max } = BREAKDOWN_DURATION_LIMITS[key];
        const unitWord = UNIT_LABEL[BREAKDOWN_DURATION_UNIT[key]][1];
        return (
          <Field
            key={key}
            label={`${label} (${unitWord})`}
            htmlFor={`bd-${key}`}
            error={error}
            help={`Entero de ${min} a ${max} ${unitWord}. Por defecto: ${BREAKDOWN_DURATION_DEFAULTS[key]} ${unit(key, BREAKDOWN_DURATION_DEFAULTS[key])}.`}
          >
            <NumberInput
              id={`bd-${key}`}
              value={Number.isFinite(value[key]) ? String(value[key]) : ""}
              min={min}
              max={max}
              disabled={readOnly}
              error={!!error}
              onValueChange={(t) => onChange({ ...value, [key]: t.trim() === "" ? NaN : Number(t) })}
            />
          </Field>
        );
      })}
      {!readOnly && (
        <Button className="justify-self-start" variant="outline" size="xs" icon={<RotateCcw className="size-4" aria-hidden />} disabled={isDefault} onClick={() => onChange(defaultBreakdownDurations())}>
          Restablecer valores por defecto
        </Button>
      )}
    </div>
  );
}
