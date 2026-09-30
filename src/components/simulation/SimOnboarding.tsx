import { ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GRID } from "@/lib/constants";
import type { SimulationMode } from "@/lib/types";

/** Guía de inicio sobre el mapa antes de configurar la simulación. */
export function SimOnboarding({ mode, onConfigure }: { mode: SimulationMode; onConfigure: () => void }) {
  const steps = ["Elige la fecha de inicio", "Ajusta los rangos del semáforo", "Pulsa “Comenzar simulación”"];
  return (
    <div className="absolute top-1/2 left-1/2 z-[4] flex w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-[18px] border border-line-strong bg-panel/97 p-7 shadow-[0_20px_48px_rgb(0_0_0/0.45)]">
      <span className="grid size-12 place-items-center rounded-xl bg-pink/12 text-pink"><FlaskConical className="size-[26px]" aria-hidden /></span>
      <h2 className="text-2xl leading-tight font-bold text-white">{mode === "5d" ? "Prepara tu simulación de 5 días" : "Prepara tu simulación hasta el colapso"}</h2>
      <p className="text-sm text-n300">
        {mode === "5d"
          ? `Simularemos cinco días de operación sobre la retícula de ${GRID.width} × ${GRID.height}.`
          : "La operación correrá sin fecha de fin hasta que el primer pedido supere su plazo de entrega."}
      </p>
      <ol className="my-1 grid gap-2.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm text-n100">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pink/14 text-xs font-bold text-pink">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <Button block onClick={onConfigure}>Configurar simulación <ArrowRight className="size-[18px]" aria-hidden /></Button>
    </div>
  );
}
