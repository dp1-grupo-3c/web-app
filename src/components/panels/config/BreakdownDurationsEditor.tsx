"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput } from "@/components/ui/form";
import { BREAKDOWN_DURATION_DEFAULTS, BREAKDOWN_DURATION_LIMITS, BREAKDOWN_DURATION_UNIT } from "@/config/simulacion";
import { BREAKDOWN_TYPES } from "@/lib/constants";
import { breakdownDuration, defaultBreakdownDurations } from "@/lib/sim-settings";
import type { BreakdownDurations, BreakdownType } from "@/lib/types";

const UNIT_LABEL = { h: ["hora", "horas"], d: ["día", "días"] } as const;
const unit = (t: BreakdownType, n: number) => UNIT_LABEL[BREAKDOWN_DURATION_UNIT[t]][n === 1 ? 0 : 1];

/** Duración de cada tipo de avería: T1 y T2 en horas, T3 en días. */
export function BreakdownDurationsEditor({ value, onChange, readOnly }: { value: BreakdownDurations; onChange: (d: BreakdownDurations) => void; readOnly?: boolean }) {
  const isDefault = BREAKDOWN_TYPES.every(({ code }) => value[code] === BREAKDOWN_DURATION_DEFAULTS[code]);
  return (
    <div className="grid gap-4">
      {BREAKDOWN_TYPES.map(({ code, name }) => {
        const error = readOnly ? null : breakdownDuration(code, value[code]);
        const { min, max } = BREAKDOWN_DURATION_LIMITS[code];
        const unitWord = UNIT_LABEL[BREAKDOWN_DURATION_UNIT[code]][1];
        return (
          <Field
            key={code}
            label={`Tipo ${code.slice(1)} · ${name} (${unitWord})`}
            htmlFor={`bd-${code}`}
            error={error}
            help={`Entero de ${min} a ${max} ${unitWord}. Por defecto: ${BREAKDOWN_DURATION_DEFAULTS[code]} ${unit(code, BREAKDOWN_DURATION_DEFAULTS[code])}.`}
          >
            <NumberInput
              id={`bd-${code}`}
              value={Number.isNaN(value[code]) ? "" : String(value[code])}
              min={min}
              max={max}
              disabled={readOnly}
              error={!!error}
              onValueChange={(t) => onChange({ ...value, [code]: t.trim() === "" ? NaN : Number(t) })}
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
