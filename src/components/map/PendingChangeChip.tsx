import { CircleAlert, LoaderCircle } from "lucide-react";
import type { CambioPendiente } from "@/lib/data/store";

/**
 * Indicador discreto en una esquina del mapa (no captura el puntero): hay un
 * cambio enviado que aún no se ve porque el mapa muestra fotos en buffer.
 * Desaparece solo al verse el cambio; si vence el tiempo máximo, avisa del
 * error un momento y también desaparece.
 */
export function PendingChangeChip({ pending }: { pending: CambioPendiente[] }) {
  if (!pending.length) return null;
  const failed = pending.every((c) => c.estado === "error");
  return (
    <div role="status" aria-live="polite" className="pointer-events-none flex h-8 items-center gap-2 rounded-lg border border-line bg-panel/95 px-3 text-[13px] whitespace-nowrap text-n200 shadow-[0_8px_24px_rgb(0_0_0/0.3)]">
      {failed ? (
        <><CircleAlert className="size-4 text-critic" aria-hidden /> No pudimos confirmar el cambio en el mapa. Revisa Averías.</>
      ) : (
        <><LoaderCircle className="size-4 animate-spin text-pink" aria-hidden /> Aplicando cambios…</>
      )}
    </div>
  );
}
