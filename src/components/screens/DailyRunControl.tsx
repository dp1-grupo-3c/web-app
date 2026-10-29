"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { startOperation, stopOperation } from "@/lib/data/actions";
import { formatoFechaOperativa } from "@/lib/data/adapters";
import { useOperacion } from "@/lib/data/hooks";

export function DailyRunControl() {
  const { vista, cargado, running } = useOperacion();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  const start = async () => {
    setBusy(true);
    const result = await startOperation();
    setBusy(false);
    if (!result.ok) toast.error(result.message);
  };
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
          <Button className={vista ? "mt-2" : undefined} size="sm" loading={busy} disabled={!cargado} onClick={start}>Iniciar operación</Button>
          <p className="mt-2 text-xs text-n500">La operación inicia en la hora actual del servidor, sin pedidos, con toda la flota en el almacén central. Registra pedidos desde el panel Pedidos mientras está en curso.</p>
        </>
      )}
    </section>
  );
}
