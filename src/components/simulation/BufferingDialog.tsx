"use client";

import { LoaderCircle } from "lucide-react";
import { Meter } from "@/components/ui/feedback";
import { Overlay } from "@/components/ui/Overlay";

/**
 * Aviso breve al iniciar (o retomar) una simulación mientras se llena el
 * buffer de fotografías. Se cierra solo al llegar al objetivo o al vencer
 * BUFFER_FILL_TIMEOUT_MS (lo decide el store), así que nunca queda colgado.
 */
export function BufferingDialog({ queued, target }: { queued: number; target: number }) {
  return (
    <Overlay labelledBy="buffering-title">
      <div role="status" className="flex w-[360px] flex-col gap-3 rounded-[20px] border border-line-strong bg-panel p-6 shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
        <div className="flex items-center gap-3">
          <LoaderCircle className="size-6 shrink-0 animate-spin text-pink" aria-hidden />
          <h2 id="buffering-title" className="text-lg font-bold text-white">Cargando…</h2>
        </div>
        <p className="text-sm text-n300">Preparamos los primeros movimientos para que la simulación se vea fluida.</p>
        <Meter value={queued / target} color="var(--color-pink)" label="Fotografías listas" className="h-1.5" />
      </div>
    </Overlay>
  );
}
