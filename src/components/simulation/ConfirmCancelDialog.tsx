"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Overlay } from "@/components/ui/Overlay";

export function ConfirmCancelDialog({ busy, onKeep, onConfirm }: { busy: boolean; onKeep: () => void; onConfirm: () => void }) {
  return (
    <Overlay onClose={onKeep} labelledBy="cancel-title" role="alertdialog">
      <div className="w-[480px] rounded-[20px] border border-line-strong bg-panel p-7 shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
        <span className="grid size-12 place-items-center rounded-xl bg-warning/12 text-warning"><TriangleAlert className="size-[26px]" aria-hidden /></span>
        <h2 id="cancel-title" className="mt-4 mb-2 text-[22px] leading-snug font-bold text-white">¿Quieres cancelar la simulación?</h2>
        <p className="mb-6 text-[15px] text-n300">Se detendrá ahora y verás un resumen con los resultados obtenidos hasta este momento. No podrás reanudarla.</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onKeep} autoFocus>Seguir simulando</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy} loadingText="Cancelando…">Sí, cancelar</Button>
        </div>
      </div>
    </Overlay>
  );
}
