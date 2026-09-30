"use client";

import { Calendar, CircleHelp, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/form";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { SIMULATION_DAYS_5D, SIMULATION_TITLE } from "@/lib/constants";
import { addDays, formatDate, formatWeekdayDate, parseISODate } from "@/lib/format";
import { validateTrafficLight } from "@/lib/traffic-light";
import type { SimulationMode, TrafficLight } from "@/lib/types";
import { TrafficLightEditor } from "./TrafficLight";

type Props = {
  mode: SimulationMode;
  readOnly: boolean;
  startDate: string;
  onStartDate: (v: string) => void;
  trafficLight: TrafficLight;
  onTrafficLight: (t: TrafficLight) => void;
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
  width: number;
};

export function SimConfigPanel({ mode, readOnly, startDate, onStartDate, trafficLight, onTrafficLight, starting, onStart, onClose, width }: Props) {
  const [dateError, setDateError] = useState<string | null>(null);
  const start = startDate ? parseISODate(startDate) : null;
  const end = start ? addDays(start, SIMULATION_DAYS_5D - 1) : null;

  const tryStart = () => {
    if (!startDate) return setDateError("Elige una fecha de inicio para comenzar.");
    if (validateTrafficLight(trafficLight)) return;
    onStart();
  };

  return (
    <SidePanel
      title={mode === "5d" ? "Simulación de 5 días" : "Hasta el colapso"}
      subtitle={readOnly ? "Configuración en solo lectura." : "Configura y comienza la simulación."}
      onClose={onClose}
      width={width}
      footer={!readOnly && (
        <Button block onClick={tryStart} loading={starting} loadingText="Preparando simulación…" icon={<Play className="size-[18px]" aria-hidden />}>
          Comenzar simulación
        </Button>
      )}
    >
      {readOnly && <Alert tone="info">La simulación está en curso, así que la configuración es de solo lectura.</Alert>}
      <PanelSection
        title="Periodo"
        icon={<Calendar className="size-[18px]" aria-hidden />}
        action={
          <span className="cursor-help text-n400" title={mode === "5d" ? "Simula 5 días de operación a partir de la fecha de inicio." : "Simula la operación sin fecha de fin hasta que el primer pedido supere su plazo de entrega."}>
            <CircleHelp className="size-5" aria-label={`Qué es la ${SIMULATION_TITLE[mode].toLowerCase()}`} />
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de inicio" htmlFor="s-start" required error={dateError}>
            <TextInput
              id="s-start"
              type="date"
              value={startDate}
              disabled={readOnly}
              error={!!dateError}
              onChange={(e) => { onStartDate(e.target.value); setDateError(null); }}
            />
          </Field>
          <Field label="Fecha de fin" htmlFor="s-end">
            <TextInput id="s-end" disabled value={mode === "5d" ? (end ? formatDate(end) : "—") : "Hasta el colapso"} readOnly />
          </Field>
        </div>
        {start && (
          <p className="text-xs text-n600">
            {mode === "5d"
              ? `Simularás del ${formatWeekdayDate(start)} al ${formatWeekdayDate(end!)} (${SIMULATION_DAYS_5D} días).`
              : `Empezará el ${formatWeekdayDate(start)} y seguirá hasta que un pedido no llegue a tiempo.`}
          </p>
        )}
      </PanelSection>
      <TrafficLightEditor value={trafficLight} onChange={onTrafficLight} readOnly={readOnly} />
    </SidePanel>
  );
}
