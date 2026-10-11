import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TipoEscenario } from "@/lib/backend/types";
import { SIMULATION_TITLE } from "@/lib/constants";
import { formatDate, parseISODate } from "@/lib/format";

export const RUN_TITLE: Record<TipoEscenario, string> = {
  DIA_A_DIA: "Operación día a día",
  SIMULACION_5D: SIMULATION_TITLE["5d"],
  COLAPSO: SIMULATION_TITLE.colapso,
};

const RUN_HREF: Record<TipoEscenario, string> = {
  DIA_A_DIA: "/operaciones/diarias",
  SIMULACION_5D: "/simulacion/5-dias",
  COLAPSO: "/simulacion/colapso",
};

/**
 * Aviso sobre el mapa cuando el backend ya ejecuta una corrida de otro
 * escenario: solo admite una a la vez, así que se ofrece verla o detenerla.
 */
export function OtherRunNotice({ tipo, primerDia, onStop }: { tipo: TipoEscenario; primerDia: string; onStop: () => void }) {
  return (
    <div className="absolute top-1/2 left-1/2 z-[4] flex w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-[18px] border border-line-strong bg-panel/97 p-7 shadow-[0_20px_48px_rgb(0_0_0/0.45)]">
      <span className="grid size-12 place-items-center rounded-xl bg-warning/12 text-warning"><Radio className="size-[26px]" aria-hidden /></span>
      <h2 className="text-2xl leading-tight font-bold text-white">Hay otra corrida en curso</h2>
      <p className="text-sm text-n300">
        El servidor está ejecutando «{RUN_TITLE[tipo]}» desde el {formatDate(parseISODate(primerDia))}. Solo puede haber una
        corrida a la vez: para iniciar esta simulación, primero detén la actual.
      </p>
      <div className="flex gap-3">
        <Link href={RUN_HREF[tipo]} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-pink font-bold text-pink hover:bg-pink/10">
          Ver corrida <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
        <Button variant="danger" className="flex-1" onClick={onStop}>Detener</Button>
      </div>
    </div>
  );
}
