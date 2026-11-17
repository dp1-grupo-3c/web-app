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

/**
 * Sin operación en curso lleva a la configuración. En curso no muestra nada: "Detener"
 * está en la barra superior (StopOperationButton). `planOf` es la operación cuyo reporte
 * del último plan está abierto; lo guarda la pantalla para que sobreviva al detener.
 */
export function DailyRunControl({ onConfigure, planOf, onPlanOf }: { onConfigure: () => void; planOf: string | null; onPlanOf: (id: string | null) => void }) {
  const { vista, cargado, running } = useOperacion();
  if (running && vista) return planOf && <PlanDialog id={planOf} onClose={() => onPlanOf(null)} />;

  return (
    <section aria-label="Control de operación diaria" className="max-w-xl rounded-xl border border-line bg-panel/95 p-3 text-sm text-white shadow-lg">
      {vista && <p role="status">Operación {vista.estado.toLowerCase()}.{vista.error ? ` ${vista.error}` : ""}</p>}
      <div className={vista ? "mt-2 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
        <Button size="sm" disabled={!cargado} onClick={onConfigure}>Configurar operación</Button>
        {vista && <Button size="sm" variant="outline" onClick={() => onPlanOf(vista.contextoId)}>Ver última planificación</Button>}
      </div>
      <p className="mt-2 text-xs text-n500">Revisa la flota y el semáforo en Configurar y pulsa “Iniciar operación”. Los paneles de pedidos, vehículos y métricas aparecen cuando la operación está en curso.</p>
      {planOf && <PlanDialog id={planOf} onClose={() => onPlanOf(null)} />}
    </section>
  );
}

/** "Detener" de la barra superior, con confirmación; al detener se abre el reporte del último plan. */
export function StopOperationButton({ onStopped }: { onStopped: (id: string) => void }) {
  const { vista } = useOperacion();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  const stop = async () => {
    if (!vista) return;
    setBusy(true);
    const id = vista.contextoId;
    const result = await stopOperation(id);
    setBusy(false);
    setConfirm(false);
    if (!result.ok) toast.error(result.message);
    else onStopped(id);
  };

  return (
    <>
      <Button variant="danger" size="sm" disabled={!vista} onClick={() => setConfirm(true)}>Detener</Button>
      {confirm && vista && createPortal(
        <Overlay onClose={() => !busy && setConfirm(false)} labelledBy="detener-op-title" role="alertdialog">
          <div className="w-[480px] max-w-full rounded-[20px] border border-line-strong bg-panel p-6 shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
            <h2 id="detener-op-title" className="mb-2 text-lg font-bold text-white">¿Detener la operación diaria?</h2>
            <p className="mb-5 text-sm text-n300">
              Se detiene para todas las sesiones. Operación del {formatoFechaOperativa(vista.fechaHoraOperativa)} ({vista.zonaHoraria}) con {vista.configuracion.algoritmo}.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)} autoFocus>Continuar</Button>
              <Button variant="danger" loading={busy} loadingText="Deteniendo…" onClick={stop}>Detener</Button>
            </div>
          </div>
        </Overlay>,
        document.body,
      )}
    </>
  );
}

// En un portal: el control vive bajo el mapa y sus marcadores quedarían encima del diálogo.
function PlanDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const plan = usePlanReport({ kind: "operacion", id });
  return createPortal(
    <Overlay onClose={onClose} labelledBy="plan-op-title">
      <div className="flex max-h-[calc(100dvh-48px)] w-[820px] max-w-full flex-col overflow-hidden rounded-[20px] border border-line-strong bg-panel shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
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
