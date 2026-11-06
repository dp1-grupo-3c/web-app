"use client";

import { Calendar, CircleAlert, CircleHelp, Play, Wrench } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/choice";
import { Alert } from "@/components/ui/feedback";
import { DateInput, Field, TextInput, TimeInput } from "@/components/ui/form";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { DATA_DATE_RANGE, DEFAULT_START_TIME } from "@/config/simulacion";
import { SIMULATION_DAYS_5D, SIMULATION_TITLE } from "@/lib/constants";
import { addDays, formatDate, formatWeekdayDate, parseISODate } from "@/lib/format";
import { formatTimeOfDay, parseTimeOfDay, validateSimSettings } from "@/lib/sim-settings";
import { INCOMPLETE_DATE, simulationStart } from "@/lib/validation";
import type { SimSettings, SimulationMode } from "@/lib/types";
import { BreakdownDurationsEditor } from "./config/BreakdownDurationsEditor";
import { OccupancyBandsEditor } from "./config/OccupancyBandsEditor";
import { FleetEditor, hasFleetErrors, type FleetDraft, type FleetErrors } from "./FleetPanel";

export type ConfigTab = "general" | "flota" | "semaforo" | "averias";
const TABS: { value: ConfigTab; label: string }[] = [
  { value: "general", label: "General" },
  { value: "flota", label: "Flota" },
  { value: "semaforo", label: "Semáforo" },
  { value: "averias", label: "Averías" },
];

type Props = {
  mode: SimulationMode;
  readOnly: boolean;
  tab: ConfigTab;
  onTab: (t: ConfigTab) => void;
  startDate: string;
  onStartDate: (v: string) => void;
  settings: SimSettings;
  onSettings: (s: SimSettings) => void;
  fleet: FleetDraft;
  onFleet: (d: FleetDraft) => void;
  fleetErrors: FleetErrors;
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
  width: number;
};

/**
 * Configuración de la simulación, en pestañas dentro del mismo panel: el
 * botón "Comenzar" queda siempre visible y, si una pestaña tiene errores, se
 * marca y se salta a ella al intentar comenzar. Todo es opcional salvo la
 * fecha: lo que no se toca conserva su valor por defecto. Durante la corrida
 * se muestra en solo lectura con los valores que eligió el usuario.
 */
export function SimConfigPanel(p: Props) {
  const { mode, readOnly, tab, onTab, startDate, onStartDate, settings, onSettings, starting, onStart, onClose, width } = p;
  // Problema de calendario que informa el campo (incompleta o inexistente) y
  // si ya se intentó comenzar: "incompleta" y "vacía" solo se marcan entonces.
  const [problem, setProblem] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const start = startDate ? parseISODate(startDate) : null;
  const end = start ? addDays(start, SIMULATION_DAYS_5D - 1) : null;
  const check = (attempted: boolean) => {
    if (readOnly) return null;
    if (problem) return problem !== INCOMPLETE_DATE || attempted ? problem : null;
    if (!startDate) return attempted ? "Elige una fecha de inicio para comenzar." : null;
    return simulationStart(startDate, mode === "5d" ? SIMULATION_DAYS_5D : 1, DATA_DATE_RANGE);
  };
  const dateError = check(tried);
  const startClock = formatTimeOfDay(parseTimeOfDay(settings.startTime) ?? 0);
  const se = readOnly ? {} : validateSimSettings(settings);

  const invalidTabs = (attempted: boolean): Record<ConfigTab, boolean> => ({
    general: !!check(attempted) || !!se.startTime,
    flota: !readOnly && hasFleetErrors(p.fleetErrors),
    semaforo: !readOnly && (!!se.vehicleOccupancy || !!se.warehouseFill),
    averias: !!se.breakdowns,
  });
  const bad = invalidTabs(tried);

  const tryStart = () => {
    setTried(true);
    const now = invalidTabs(true);
    const first = TABS.find((t) => now[t.value]);
    if (first) return onTab(first.value);
    onStart();
  };
  const set = <K extends keyof SimSettings>(k: K, v: SimSettings[K]) => onSettings({ ...settings, [k]: v });

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
      {readOnly && <Alert tone="info">La simulación está en curso, así que la configuración es de solo lectura: muestra los valores con los que comenzó.</Alert>}
      <SegmentedControl
        label="Secciones de la configuración"
        value={tab}
        onChange={onTab}
        options={TABS.map((t) => ({
          value: t.value,
          label: <>{t.label}{bad[t.value] && <CircleAlert className="size-3.5 text-critic" role="img" aria-label="(revisar)" />}</>,
        }))}
      />

      {tab === "general" && (
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
            <Field label="Fecha de inicio" htmlFor="s-start" required error={dateError} help={readOnly ? undefined : `Con datos del ${formatDate(parseISODate(DATA_DATE_RANGE.from))} al ${formatDate(parseISODate(DATA_DATE_RANGE.to))}.`}>
              <DateInput
                id="s-start"
                value={startDate}
                disabled={readOnly}
                error={!!dateError}
                onChange={(v, pr) => { onStartDate(v); setProblem(pr); setTried(false); }}
              />
            </Field>
            <Field label="Fecha de fin" htmlFor="s-end">
              <TextInput id="s-end" disabled value={mode === "5d" ? (end ? formatDate(end) : "—") : "Hasta el colapso"} readOnly />
            </Field>
            <Field label="Hora de inicio" htmlFor="s-time" error={se.startTime} help={readOnly ? undefined : `Opcional. Vacía: ${DEFAULT_START_TIME}.`}>
              <TimeInput id="s-time" value={readOnly && !settings.startTime ? DEFAULT_START_TIME : settings.startTime} disabled={readOnly} error={!!se.startTime} onChange={(v) => set("startTime", v)} />
            </Field>
          </div>
          {start && (
            <p className="text-xs text-n600">
              {mode === "5d"
                ? `Simularás ${SIMULATION_DAYS_5D} días desde el ${formatWeekdayDate(start)} a las ${startClock}.`
                : `Empezará el ${formatWeekdayDate(start)} a las ${startClock} y seguirá hasta que un pedido no llegue a tiempo.`}
            </p>
          )}
        </PanelSection>
      )}

      {tab === "flota" && <FleetEditor draft={p.fleet} onChange={p.onFleet} errors={p.fleetErrors} readOnly={readOnly} />}

      {tab === "semaforo" && (
        <OccupancyBandsEditor
          value={settings}
          onChange={(v) => onSettings({ ...settings, ...v })}
          readOnly={readOnly}
        />
      )}

      {tab === "averias" && (
        <PanelSection title="Duración de las averías" icon={<Wrench className="size-[18px]" aria-hidden />}>
          <p className="text-xs leading-snug text-n500">Tiempo que un vehículo queda fuera de servicio según el tipo de avería. Se muestran los valores vigentes del servidor; al comenzar se guardan allí y rigen para las averías siguientes.</p>
          <BreakdownDurationsEditor value={settings.breakdownDurations} onChange={(d) => set("breakdownDurations", d)} readOnly={readOnly} />
        </PanelSection>
      )}
    </SidePanel>
  );
}
