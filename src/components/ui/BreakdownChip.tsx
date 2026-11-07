import { Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { BREAKDOWN_COLOR, breakdownInfo } from "@/lib/constants";
import type { BreakdownType } from "@/lib/types";

/** Etiqueta de avería con el color de su tipo: ámbar (T1), rojo (T2) o rojo oscuro (T3). */
export function BreakdownChip({ type, className }: { type?: BreakdownType; className?: string }) {
  const { color, glyph } = BREAKDOWN_COLOR[type ?? "T2"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-[5px] text-xs leading-none font-semibold whitespace-nowrap", className)} style={{ background: color, color: glyph }}>
      <Wrench className="size-3" aria-hidden />
      {type ? `${type} · ${breakdownInfo(type).name}` : "Averiado"}
    </span>
  );
}
