import { Clock } from "lucide-react";
import { EmptyState, StatCard } from "@/components/ui/feedback";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { Metrics } from "@/lib/types";
import { PriorityBars } from "./PriorityBars";

export function MetricsPanel({ metrics, simulation, onClose, width }: { metrics: Metrics | null; simulation: boolean; onClose: () => void; width: number }) {
  const m = metrics;
  return (
    <SidePanel title="Métricas" subtitle={simulation ? "Indicadores acumulados de la simulación." : "Indicadores del día en curso."} onClose={onClose} width={width}>
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Pedidos entregados" value={m ? formatNumber(m.delivered) : "—"} detail={simulation ? "en la simulación" : "hoy"} />
        <StatCard label="Entregas a tiempo" value={m ? formatPercent(m.onTimeRate) : "—"} detail="dentro del plazo" />
        <StatCard label="Costo acumulado" value={m ? formatMoney(m.accumulatedCost) : "—"} detail="rutas y combustible" />
        <StatCard label="Distancia recorrida" value={m ? `${formatNumber(m.distanceKm)} km` : "—"} detail="toda la flota" />
      </div>
      <PanelSection title="Tiempo de entrega promedio por prioridad" icon={<Clock className="size-[18px]" aria-hidden />}>
        {m && m.avgDeliveryByPriority.length ? (
          <>
            <PriorityBars items={m.avgDeliveryByPriority} />
            <p className="text-xs text-n600">La barra indica qué parte del plazo consume en promedio cada prioridad.</p>
          </>
        ) : (
          <EmptyState icon={<Clock className="size-7" aria-hidden />} title="Aún no hay entregas para medir">Los tiempos aparecerán cuando se completen las primeras entregas.</EmptyState>
        )}
      </PanelSection>
    </SidePanel>
  );
}
