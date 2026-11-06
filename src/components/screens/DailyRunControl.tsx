"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { stopOperation } from "@/lib/data/actions";
import { formatoFechaOperativa } from "@/lib/data/adapters";
import { useOperacion } from "@/lib/data/hooks";

/** Estado de la operación: en curso muestra su hora y "Detener"; si no, lleva a la configuración. */
export function DailyRunControl({ onConfigure }: { onConfigure: () => void }) {
  const { vista, cargado, running } = useOperacion();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  const stop = async () => {
    if (!vista) return;
    setBusy(true);
    const result = await stopOperation(vista.contextoId);
    setBusy(false);
    setConfirm(false);
    if (!result.ok) toast.error(result.message);
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
          <Button className={vista ? "mt-2" : undefined} size="sm" disabled={!cargado} onClick={onConfigure}>Configurar operación</Button>
          <p className="mt-2 text-xs text-n500">Revisa la flota y el semáforo en Configurar y pulsa “Iniciar operación”. Los paneles de pedidos, vehículos y métricas aparecen cuando la operación está en curso.</p>
        </>
      )}
    </section>
  );
}
