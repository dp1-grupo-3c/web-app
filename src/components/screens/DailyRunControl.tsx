"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { esFinal } from "@/lib/backend/estado";
import { useDailyRun } from "@/lib/data/hooks";
import { arrancarDia, cancelarDia } from "@/lib/data/store";
import { toISODate } from "@/lib/format";

export function DailyRunControl() {
  const { corrida, occupied } = useDailyRun();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const running = corrida && !esFinal(corrida.estado);

  const start = async () => {
    setBusy(true);
    const result = await arrancarDia(date);
    setBusy(false);
    if (!result.ok) toast.error(result.message);
  };
  const stop = async () => {
    if (!corrida) return;
    setBusy(true);
    const result = await cancelarDia(corrida.id);
    setBusy(false);
    setConfirm(false);
    if (!result.ok) toast.error(result.message);
  };

  return (
    <section aria-label="Control de operación diaria" className="max-w-xl rounded-xl border border-line bg-panel/95 p-3 text-sm text-white shadow-lg">
      {running ? (
        <>
          <p role="status">Operación diaria · ritmo real 1× · {corrida.fechaHoraSimulada.replace("T", " ")}</p>
          {confirm ? (
            <div className="mt-2 flex items-center gap-2">
              <span>¿Detener la operación para todas las sesiones?</span>
              <Button size="xs" variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Continuar</Button>
              <Button size="xs" variant="danger" loading={busy} onClick={stop}>Detener</Button>
            </div>
          ) : <Button className="mt-2" size="xs" variant="outline" onClick={() => setConfirm(true)}>Detener operación</Button>}
        </>
      ) : occupied ? (
        <p role="status">Hay otra corrida activa. Finalízala desde su pantalla antes de iniciar la operación diaria.</p>
      ) : (
        <>
          {corrida && <p role="status">Operación {corrida.estado.toLowerCase()}. {corrida.error}</p>}
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1">Fecha de operación
              <input className="rounded border border-line bg-field p-2" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <Button size="sm" loading={busy} disabled={!date} onClick={start}>Iniciar día a día</Button>
          </div>
          <p className="mt-2 text-xs text-n500">La jornada inicia a las 00:00 de la fecha elegida y avanza a ritmo real con los pedidos cargados. El registro de nuevos pedidos todavía no está disponible.</p>
        </>
      )}
    </section>
  );
}
