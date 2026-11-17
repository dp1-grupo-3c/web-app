"use client";

import { CircleAlert, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/choice";
import { Alert } from "@/components/ui/feedback";
import { SidePanel } from "@/components/workspace/SidePanel";
import { OccupancyBandsEditor, type OccupancyBands } from "./config/OccupancyBandsEditor";
import { WorldEditor } from "./config/WorldEditor";
import { FleetEditor, hasFleetErrors, type FleetDraft, type FleetErrors } from "./FleetPanel";
import { invalidBands } from "./TrafficLight";

export type OpsConfigTab = "flota" | "semaforo" | "mapa";
const TABS: { value: OpsConfigTab; label: string }[] = [
  { value: "flota", label: "Flota" },
  { value: "semaforo", label: "Semáforo" },
  { value: "mapa", label: "Mapa" },
];

type Props = {
  /** La operación está en curso: la flota se muestra en solo lectura, salvo la velocidad. */
  running: boolean;
  /** Aún no se sabe si hay una operación en curso. */
  loading: boolean;
  tab: OpsConfigTab;
  onTab: (t: OpsConfigTab) => void;
  fleet: FleetDraft;
  onFleet: (d: FleetDraft) => void;
  fleetErrors: FleetErrors;
  /** Operación en curso: envía las velocidades, que rigen desde la siguiente planificación. */
  onApplySpeeds?: () => void;
  bands: OccupancyBands;
  onBands: (b: OccupancyBands) => void;
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
  width: number;
};

/**
 * Configuración de la operación diaria, con las mismas pestañas que la
 * simulación (sin fecha: la operación arranca en la hora actual del servidor).
 * El semáforo solo cambia los colores de la pantalla, así que sigue editable
 * durante la operación.
 */
export function OpsConfigPanel(p: Props) {
  const { running, loading, tab, onTab, starting, onClose, width } = p;
  const readOnly = running || loading;
  const [tried, setTried] = useState(false);
  const invalid = (attempted: boolean): Record<OpsConfigTab, boolean> => ({
    flota: !readOnly && attempted && hasFleetErrors(p.fleetErrors),
    semaforo: invalidBands(p.bands),
    mapa: false,
  });
  const bad = invalid(tried);

  const tryStart = () => {
    setTried(true);
    const first = TABS.find((t) => invalid(true)[t.value]);
    if (first) return onTab(first.value);
    p.onStart();
  };

  return (
    <SidePanel
      title="Operación diaria"
      subtitle={running ? "Operación en curso." : "Configura e inicia la operación."}
      onClose={onClose}
      width={width}
      footer={!readOnly && (
        <Button block onClick={tryStart} loading={starting} loadingText="Iniciando operación…" icon={<Play className="size-[18px]" aria-hidden />}>
          Iniciar operación
        </Button>
      )}
    >
      {running && tab !== "semaforo" && <Alert tone="info">La operación está en curso, así que esta sección es de solo lectura: muestra los valores con los que corre.{tab === "flota" && p.onApplySpeeds && " La velocidad sí se puede cambiar."}</Alert>}
      <SegmentedControl
        label="Secciones de la configuración"
        value={tab}
        onChange={onTab}
        options={TABS.map((t) => ({
          value: t.value,
          label: <>{t.label}{bad[t.value] && <CircleAlert className="size-3.5 text-critic" role="img" aria-label="(revisar)" />}</>,
        }))}
      />

      {tab === "mapa" && <WorldEditor locked={readOnly} part="mapa" />}

      {tab === "flota" && <FleetEditor draft={p.fleet} onChange={p.onFleet} errors={p.fleetErrors} readOnly={readOnly} onApplySpeeds={p.onApplySpeeds} />}

      {tab === "semaforo" && (
        <>
          {running && <p className="text-xs leading-snug text-n500">Los cambios se aplican al momento en el mapa y los listados, y se recuerdan en este navegador.</p>}
          <OccupancyBandsEditor value={p.bands} onChange={p.onBands} />
        </>
      )}
    </SidePanel>
  );
}
