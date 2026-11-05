"use client";

import { Calendar, CircleAlert, CircleHelp, Gauge, Play, Truck, Warehouse as WarehouseIcon, Wrench } from "lucide-react";
import { useState } from "react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/choice";
import { Alert } from "@/components/ui/feedback";
import { DateInput, Field, TextInput, TimeInput } from "@/components/ui/form";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { BACKEND_ACCEPTS, DATA_DATE_RANGE, DEFAULT_START_TIME, FLEET_OCCUPANCY_BANDS } from "@/config/simulacion";
import { SIMULATION_DAYS_5D, SIMULATION_TITLE } from "@/lib/constants";
import { addDays, formatDate, formatWeekdayDate, parseISODate } from "@/lib/format";
import { validateSimSettings } from "@/lib/sim-settings";
import { validateTrafficLight } from "@/lib/traffic-light";
import { INCOMPLETE_DATE, simulationStart } from "@/lib/validation";
import type { SimSettings, SimulationMode, TrafficLight } from "@/lib/types";
import { BreakdownDurationsEditor } from "./config/BreakdownDurationsEditor";
import { PercentBandsEditor } from "./config/PercentBandsEditor";
import { FleetEditor, hasFleetErrors, type FleetDraft, type FleetErrors } from "./FleetPanel";
import { TrafficLightEditor } from "./TrafficLight";

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
  trafficLight: TrafficLight;
  onTrafficLight: (t: TrafficLight) => void;
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
  const se = readOnly ? {} : validateSimSettings(settings);

  const invalidTabs = (attempted: boolean): Record<ConfigTab, boolean> => ({
    general: !!check(attempted) || !!se.startTime,
    flota: !readOnly && hasFleetErrors(p.fleetErrors),
    semaforo: !readOnly && (!!validateTrafficLight(p.trafficLight) || !!se.vehicleOccupancy || !!se.warehouseFill),
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
                ? `Simularás del ${formatWeekdayDate(start)} al ${formatWeekdayDate(end!)} (${SIMULATION_DAYS_5D} días).`
                : `Empezará el ${formatWeekdayDate(start)} y seguirá hasta que un pedido no llegue a tiempo.`}
            </p>
          )}
          {!BACKEND_ACCEPTS.startTime && (
            <Alert tone="warn" className="text-[13px]">
              <b>Avance parcial.</b> El servidor todavía no recibe la hora de inicio: por ahora la simulación empieza a las {DEFAULT_START_TIME} del día elegido.
            </Alert>
          )}
        </PanelSection>
      )}

      {tab === "flota" && <FleetEditor draft={p.fleet} onChange={p.onFleet} errors={p.fleetErrors} readOnly={readOnly} />}

      {tab === "semaforo" && (
        <>
          <PanelSection title="Ocupación de vehículos" icon={<Truck className="size-[18px]" aria-hidden />}>
            <p className="text-xs leading-snug text-n500">Porcentaje de la capacidad ocupado por los paquetes a bordo, por tipo de vehículo. Se usa en el mapa y en el listado de vehículos.</p>
            <div>
              {VEHICLE_ORDER.map((k) => {
                const { plural, Icon, color } = VEHICLE_META[k];
                return (
                  <PercentBandsEditor
                    key={k}
                    id={`occ-${k}`}
                    label={plural}
                    icon={<Icon className="size-4" style={{ color }} aria-hidden />}
                    value={settings.vehicleOccupancy[k]}
                    onChange={(b) => set("vehicleOccupancy", { ...settings.vehicleOccupancy, [k]: b })}
                    direction="lowIsGreen"
                    readOnly={readOnly}
                  />
                );
              })}
            </div>
            <p className="flex items-start gap-1.5 text-xs leading-snug text-n600">
              <Gauge className="mt-px size-3.5 shrink-0" aria-hidden />
              La ocupación global de la flota usa un semáforo fijo: verde por debajo de {FLEET_OCCUPANCY_BANDS.low} %, ámbar de {FLEET_OCCUPANCY_BANDS.low} % a {FLEET_OCCUPANCY_BANDS.high} % y rojo por encima de {FLEET_OCCUPANCY_BANDS.high} %.
            </p>
          </PanelSection>
          <PanelSection title="Llenado de almacenes (%)" icon={<WarehouseIcon className="size-[18px]" aria-hidden />}>
            <p className="text-xs leading-snug text-n500">Stock actual sobre la capacidad de los almacenes intermedios. Colorea los almacenes en el mapa, su ficha, el listado de almacenes y el llenado global.</p>
            <PercentBandsEditor id="fill" label="Almacenes intermedios" value={settings.warehouseFill} onChange={(b) => set("warehouseFill", b)} direction="highIsGreen" readOnly={readOnly} />
          </PanelSection>
          <TrafficLightEditor value={p.trafficLight} onChange={p.onTrafficLight} readOnly={readOnly} />
          <p className="-mt-2 text-xs leading-snug text-n600">Este semáforo en paquetes se envía al servidor (activaciones del reporte de la simulación); en el mapa se usa el llenado en %.</p>
        </>
      )}

      {tab === "averias" && (
        <PanelSection title="Duración de las averías" icon={<Wrench className="size-[18px]" aria-hidden />}>
          <p className="text-xs leading-snug text-n500">Tiempo que un vehículo queda fuera de servicio según el tipo de avería.</p>
          {!BACKEND_ACCEPTS.breakdownDurations && (
            <Alert tone="warn" className="text-[13px]">
              <b>Avance parcial.</b> El servidor todavía no aplica estas duraciones: por ahora los vehículos se reincorporan según la regla actual del servidor. Los valores elegidos se guardan con la simulación.
            </Alert>
          )}
          <BreakdownDurationsEditor value={settings.breakdownDurations} onChange={(d) => set("breakdownDurations", d)} readOnly={readOnly} />
        </PanelSection>
      )}
    </SidePanel>
  );
}
