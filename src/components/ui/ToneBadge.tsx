import { CircleCheck, CircleDashed, CircleHelp, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_LABEL } from "@/lib/constants";
import type { StatusTone } from "@/lib/types";
import { Badge } from "./feedback";

/** Ícono de cada color del semáforo: el estado nunca depende solo del color. */
export const TONE_ICON: Record<StatusTone, LucideIcon> = { ok: CircleCheck, warn: TriangleAlert, crit: OctagonAlert };

/** Semáforo con color, ícono y texto ("Verde", "Ámbar", "Rojo"); `empty` = "Vacío" (sin carga o sin stock); null = sin dato. */
export function ToneBadge({ tone, empty = false, children, className }: { tone: StatusTone | null; empty?: boolean; children?: ReactNode; className?: string }) {
  if (empty) return <Badge tone="neutral" className={className}><CircleDashed className="size-3" aria-hidden />{children ?? "Vacío"}</Badge>;
  if (!tone) return <Badge className={className}><CircleHelp className="size-3" aria-hidden />{children ?? "Sin dato"}</Badge>;
  const Icon = TONE_ICON[tone];
  return (
    <Badge tone={tone} className={className}>
      <Icon className="size-3" aria-hidden />
      {children ?? TONE_LABEL[tone]}
    </Badge>
  );
}
