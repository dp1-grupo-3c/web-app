import { CircleCheck, CircleHelp, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_LABEL } from "@/lib/constants";
import type { StatusTone } from "@/lib/types";
import { Badge } from "./feedback";

/** Ícono de cada color del semáforo: el estado nunca depende solo del color. */
export const TONE_ICON: Record<StatusTone, LucideIcon> = { ok: CircleCheck, warn: TriangleAlert, crit: OctagonAlert };

/** Semáforo con color, ícono y texto ("Verde", "Ámbar", "Rojo"); null = sin dato. */
export function ToneBadge({ tone, children, className }: { tone: StatusTone | null; children?: ReactNode; className?: string }) {
  if (!tone) return <Badge className={className}><CircleHelp className="size-3" aria-hidden />{children ?? "Sin dato"}</Badge>;
  const Icon = TONE_ICON[tone];
  return (
    <Badge tone={tone} className={className}>
      <Icon className="size-3" aria-hidden />
      {children ?? TONE_LABEL[tone]}
    </Badge>
  );
}
