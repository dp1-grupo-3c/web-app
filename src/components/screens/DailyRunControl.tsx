"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PlanReport, usePlanReport } from "@/components/simulation/PlanReport";
import { Button, IconButton } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { stopOperation } from "@/lib/data/actions";
import { formatoFechaOperativa } from "@/lib/data/adapters";
import { useOperacion } from "@/lib/data/hooks";

/** Estado de la operación: en curso muestra su hora y "Detener"; si no, lleva a la configuración. */
export function DailyRunControl({ onConfigure }: { onConfigure: () => void }) {
  const { vista, cargado, running } = useOperacion();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Operación cuyo reporte del último plan está abierto.
  const [planOf, setPlanOf] = useState<string | null>(null);
  const toast = useToast();

  const stop = async () => {
    if (!vista) return;
    setBusy(true);
    const id = vista.contextoId;
    const result = await stopOperation(id);
    setBusy(false);
    setConfirm(false);
    if (!result.ok) toast.error(result.message);
    // Al cerrar las operaciones se muestra el reporte de la última planificación estable.
    else setPlanOf(id);
  };

  return (
    <section aria-label="Control de operación diaria" className="max-w-xl rounded-xl border border-line bg-panel/95 p-3 text-sm text-white shadow-lg">
      {running && vista ? (
        <>
          <p role="status">
            Operación diaria · {formatoFechaOperativa(vista.fechaHoraOperativa)} ({vista.zonaHoraria}) · {vista.configuracion.algoritmo}
            {vista.calculando && " · planificando…"}
          </p>
          {vista.error && <p className="mt-1 text-xs text-critic">{vista.error}</p>}
          {confirm ? (
            <div className="mt-2 flex items-center gap-2">
              <span>¿Detener la operación para todas las sesiones?</span>
              <Button size="xs" variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Continuar</Button>
              <Button size="xs" variant="danger" loading={busy} onClick={stop}>Detener</Button>
            </div>
          ) : <Button className="mt-2" size="xs" variant="outline" onClick={() => setConfirm(true)}>Detener operación</Button>}
        </>
      ) : (
        <>
          {vista && <p role="status">Operación {vista.estado.toLowerCase()}.{vista.error ? ` ${vista.error}` : ""}</p>}
          <div className={vista ? "mt-2 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
            <Button size="sm" disabled={!cargado} onClick={onConfigure}>Configurar operación</Button>
            {vista && <Button size="sm" variant="outline" onClick={() => setPlanOf(vista.contextoId)}>Ver última planificación</Button>}
          </div>
          <p className="mt-2 text-xs text-n500">Revisa la flota y el semáforo en Configurar y pulsa “Iniciar operación”. Los paneles de pedidos, vehículos y métricas aparecen cuando la operación está en curso.</p>
        </>
      )}
      {planOf && <PlanDialog id={planOf} onClose={() => setPlanOf(null)} />}
    </section>
  );
}

// En un portal: el control vive bajo el mapa y sus marcadores quedarían encima del diálogo.
function PlanDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const plan = usePlanReport({ kind: "operacion", id });
  return createPortal(
    <Overlay onClose={onClose} labelledBy="plan-op-title">
      <div className="flex max-h-[calc(100dvh-48px)] w-[820px] flex-col overflow-hidden rounded-[20px] border border-line-strong bg-panel shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
        <header className="flex items-center gap-3 border-b border-line py-4 pr-5 pl-6">
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.08em] text-n600 uppercase">Cierre de operaciones</p>
            <h2 id="plan-op-title" className="text-xl leading-tight font-bold text-white">Última planificación estable</h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}><X className="size-[22px]" /></IconButton>
        </header>
        <div className="overflow-y-auto px-6 py-5">
          <PlanReport report={plan.report} names={plan.names} error={plan.error} loading={plan.loading} />
        </div>
      </div>
    </Overlay>,
    document.body,
  );
}
