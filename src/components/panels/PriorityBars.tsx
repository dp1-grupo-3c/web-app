import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { Meter } from "@/components/ui/feedback";
import { TONE_COLOR, priorityInfo } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import { DELIVERY_TONE_LABEL, deliveryTone } from "@/lib/traffic-light";
import type { PriorityAverage } from "@/lib/types";

const ICON = { ok: CircleCheck, warn: Clock, crit: TriangleAlert };

/** Tiempo promedio por prioridad como parte del plazo (color + texto de estado). */
export function PriorityBars({ items, compact }: { items: PriorityAverage[]; compact?: boolean }) {
  return (
    <ul>
      {items.map(({ priority, avgMinutes }) => {
        const p = priorityInfo(priority);
        const { ratio, tone } = deliveryTone(avgMinutes, p.hours);
        const Icon = ICON[tone];
        const pct = Math.round(ratio * 100);
        return (
          <li
            key={priority}
            title={`${formatHours(avgMinutes)} de ${p.hours} h (${pct} % del plazo)`}
            className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-b border-line last:border-b-0 ${compact ? "py-[7px]" : "py-2.5"}`}
          >
            <span>
              <b className="font-semibold text-white">{p.name}</b>
              <span className="ml-1.5 text-xs text-n500">plazo {p.hours} h</span>
            </span>
            <span className="text-right font-semibold text-white tabular-nums">{formatHours(avgMinutes)}</span>
            <Meter value={ratio} color={TONE_COLOR[tone]} label={`${p.name}: ${pct} % del plazo`} className="col-span-2" />
            <span className="col-span-2 -mt-0.5 flex items-center gap-1.5 text-xs text-n400">
              <Icon className="size-[13px] shrink-0" style={{ color: TONE_COLOR[tone] }} aria-hidden />
              {DELIVERY_TONE_LABEL[tone]} · {pct} % del plazo
            </span>
          </li>
        );
      })}
    </ul>
  );
}
