"use client";

import { ArrowRight, Truck } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { OperationSummaryModal } from "@/components/simulation/OperationSummaryModal";
import { Button } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { stopOperation } from "@/lib/data/actions";
import { formatoFechaOperativa } from "@/lib/data/adapters";
import { useOperacion } from "@/lib/data/hooks";
import type { UsedBands } from "@/lib/report";

/**
 * Sin operación en curso, guía de inicio centrada sobre el mapa (misma tarjeta que
 * SimOnboarding) que lleva a la configuración. En curso no muestra nada: "Detener"
 * está en la barra superior (StopOperationButton). `planOf` es la operación cuyo reporte
 * del último plan está abierto; lo guarda la pantalla para que sobreviva al detener.
 * `hidden` oculta la tarjeta (con un panel abierto) sin cerrar el reporte.
 */
export function DailyRunControl({ onConfigure, planOf, onPlanOf, bands, hidden = false }: { onConfigure: () => void; planOf: string | null; onPlanOf: (id: string | null) => void; bands: UsedBands; hidden?: boolean }) {
  const { vista, cargado, running } = useOperacion();
  const dialog = planOf && <PlanDialog id={planOf} bands={bands} onClose={() => onPlanOf(null)} onNew={() => { onPlanOf(null); onConfigure(); }} />;
  if ((running && vista) || !cargado || hidden) return dialog;

  const steps = ["Revisa la flota disponible", "Ajusta los rangos del semáforo", "Pulsa “Iniciar operación”"];
  return (
    <>
      <section aria-labelledby="ops-onboarding-title" className="absolute top-1/2 left-1/2 z-[4] flex w-[420px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-[18px] border border-line-strong bg-panel/97 p-7 shadow-[0_20px_48px_rgb(0_0_0/0.45)]">
        <span className="grid size-12 place-items-center rounded-xl bg-pink/12 text-pink"><Truck className="size-[26px]" aria-hidden /></span>
        <h2 id="ops-onboarding-title" className="text-2xl leading-tight font-bold text-white">Prepara la operación diaria</h2>
        <p className="text-sm text-n300">
          La operación arranca en la hora actual del servidor. Los paneles de pedidos, vehículos y métricas aparecen cuando está en curso.
        </p>
        {vista && <p role="status" className="text-sm text-n100">Última operación: {vista.estado.toLowerCase()}.{vista.error ? ` ${vista.error}` : ""}</p>}
        <ol className="my-1 grid gap-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm text-n100">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pink/14 text-xs font-bold text-pink">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <Button block onClick={onConfigure}>Configurar operación <ArrowRight className="size-[18px]" aria-hidden /></Button>
        {vista && <Button block variant="outline" onClick={() => onPlanOf(vista.contextoId)}>Ver última planificación</Button>}
      </section>
      {dialog}
    </>
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
function PlanDialog({ id, bands, onClose, onNew }: { id: string; bands: UsedBands; onClose: () => void; onNew: () => void }) {
  return createPortal(<OperationSummaryModal id={id} bands={bands} onClose={onClose} onNew={onNew} />, document.body);
}
