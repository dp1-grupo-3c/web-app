"use client";

import { Activity, CircleAlert, CircleCheck, Clock, Download, LoaderCircle, SlidersVertical, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PriorityBars } from "@/components/panels/PriorityBars";
import { TrafficLightPreview } from "@/components/panels/TrafficLight";
import { Button, IconButton } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/feedback";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { SIMULATION_TITLE, TONE_COLOR, priorityInfo } from "@/lib/constants";
import { formatClock, formatCoord, formatElapsed, formatMoney, formatNumber, formatPercent, formatSimStamp } from "@/lib/format";
import { OUTCOME_DETAIL, buildReportText, downloadTextFile, reportFileName, summaryHeadline } from "@/lib/report";
import type { SimulationMode, SimulationOutcome, SimulationSummary } from "@/lib/types";

const HERO: Record<SimulationOutcome, { box: string; icon: string; Icon: typeof CircleCheck }> = {
  exito: { box: "border-success/30 bg-success/6", icon: "bg-success/14 text-success", Icon: CircleCheck },
  cancelada: { box: "border-warning/30 bg-warning/6", icon: "bg-warning/14 text-warning", Icon: CircleAlert },
  colapso: { box: "border-critic/35 bg-critic/7", icon: "bg-critic/14 text-critic", Icon: TriangleAlert },
  fallida: { box: "border-critic/35 bg-critic/7", icon: "bg-critic/14 text-critic", Icon: TriangleAlert },
};

function Box({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-night px-4 py-3.5", className)}>
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-white">{icon}{title}</h3>
      {children}
    </section>
  );
}

type Props = {
  mode: SimulationMode;
  outcome: SimulationOutcome;
  startDate: string;
  /** null mientras el servidor no envía el resumen (o si la corrida falló antes de generarlo). */
  summary: SimulationSummary | null;
  /** Detalle del error cuando outcome === "fallida" y el backend no llegó a enviar un resumen. */
  errorMessage?: string | null;
  onClose: () => void;
  onNew: () => void;
};

export function SimulationSummaryModal({ mode, outcome, startDate, summary: s, errorMessage, onClose, onNew }: Props) {
  const toast = useToast();
  const hero = HERO[outcome];
  const headline = summaryHeadline({ outcome, mode, startDate, firstLateOrder: s?.firstLateOrder });
  const late = s?.firstLateOrder;

  const download = () => {
    if (!s) return;
    downloadTextFile(reportFileName(s), buildReportText(s));
    toast.success("Descargamos el reporte en formato .txt.");
  };

  return (
    <Overlay onClose={onClose} labelledBy="summary-title">
      <div className="flex max-h-[calc(100dvh-48px)] w-[920px] flex-col overflow-hidden rounded-[20px] border border-line-strong bg-panel shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
        <header className="flex items-center gap-3.5 border-b border-line py-4 pr-5 pl-6">
          <Logo size={44} />
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.08em] text-n600 uppercase">Resumen de resultados</p>
            <h2 id="summary-title" className="text-xl leading-tight font-bold text-white">{mode === "5d" ? SIMULATION_TITLE["5d"] : "Simulación hasta el colapso logístico"}</h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}><X className="size-[22px]" /></IconButton>
        </header>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-5">
          <div className={cn("flex items-center gap-4 rounded-[14px] border px-[18px] py-4", hero.box)}>
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", hero.icon)}><hero.Icon className="size-[26px]" aria-hidden /></span>
            <div>
              <p className="text-xl leading-snug font-bold text-white">{headline}</p>
              <p className="mt-1 text-sm text-n300">{outcome === "colapso" && !late ? "Una simulación colapsa en cuanto el primer pedido supera su plazo de entrega." : OUTCOME_DETAIL[outcome]}</p>
            </div>
          </div>

          {outcome === "colapso" && late && (
            <Box title="Primer pedido fuera de plazo" icon={<Clock className="size-4 text-critic" aria-hidden />} className="border-critic/40">
              <dl className="grid grid-cols-6 gap-3">
                {([
                  ["Pedido", late.orderId, `${late.packages} paquetes`],
                  ["Destino", formatCoord(late.destination), "en la retícula"],
                  ["Prioridad", priorityInfo(late.priority).name, `plazo de ${priorityInfo(late.priority).hours} h`],
                  ["Registrado", formatSimStamp(late.registeredAt, startDate).day, formatSimStamp(late.registeredAt, startDate).date.replace(" a las ", " · ")],
                  ["Plazo vencido", formatSimStamp(late.dueAt, startDate).day, formatSimStamp(late.dueAt, startDate).date.replace(" a las ", " · ")],
                  ["Vehículo asignado", late.vehiclePlate ?? "Sin asignar", late.remainingKm != null ? `a ${late.remainingKm} km del destino` : ""],
                ] as const).map(([k, v, sub], i) => (
                  <div key={k}>
                    <dt className="text-xs text-n500">{k}</dt>
                    <dd className={cn("text-[15px] leading-snug font-bold tabular-nums", i === 4 ? "text-[#ff86a6]" : "text-white")}>{v}</dd>
                    <dd className="text-xs leading-snug text-n500">{sub}</dd>
                  </div>
                ))}
              </dl>
            </Box>
          )}

          {s ? (
            <>
              <div className="grid grid-cols-4 gap-2.5">
                <StatCard label="Pedidos entregados" value={formatNumber(s.delivered)} detail={`${formatPercent(s.onTimeRate)} a tiempo`} />
                <StatCard label="Tiempo simulado" value={formatElapsed(s.simulatedMinutes)} detail={`${formatClock(s.executionSeconds)} min de ejecución`} />
                <StatCard
                  label="Distancia recorrida"
                  value={`${formatNumber(s.distanceKm.auto + s.distanceKm.moto + s.distanceKm.bicicleta)} km`}
                  detail={`Auto ${s.distanceKm.auto} · Moto ${s.distanceKm.moto} · Bici ${s.distanceKm.bicicleta}`}
                />
                <StatCard label="Costo total por rutas" value={formatMoney(s.totalCost)} detail="toda la flota" />
              </div>
              <div className="grid grid-cols-[1.15fr_1fr] gap-3.5">
                <Box title="Tiempo promedio de entrega por prioridad" icon={<Clock className="size-4" aria-hidden />}>
                  <PriorityBars items={s.avgDeliveryByPriority} compact />
                </Box>
                <div className="flex flex-col gap-3.5">
                  <Box title="Rangos del semáforo usados" icon={<SlidersVertical className="size-4" aria-hidden />}>
                    <TrafficLightPreview value={s.trafficLight} />
                  </Box>
                  <Box title="Eventos de la simulación" icon={<Activity className="size-4" aria-hidden />} className="flex-1">
                    <ol className="max-h-[150px] overflow-y-auto pr-1">
                      {s.events.map((e, i) => (
                        <li key={i} className="grid grid-cols-[10px_1fr_auto] items-center gap-2.5 border-b border-line py-1.5 text-[13px] text-white last:border-b-0">
                          <i className="size-2 rounded-full" style={{ background: TONE_COLOR[e.tone] }} aria-hidden />
                          <span>{e.message}</span>
                          <time className="text-xs text-n500 tabular-nums">Día {e.at.day} · {e.at.time}</time>
                        </li>
                      ))}
                    </ol>
                  </Box>
                </div>
              </div>
            </>
          ) : outcome === "fallida" ? (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-critic/35 bg-critic/7 px-4 py-5 text-sm text-n200">
              <TriangleAlert className="size-5 shrink-0 text-critic" aria-hidden />
              {errorMessage ?? "El servidor no envió más detalles del error."}
            </div>
          ) : (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-night px-4 py-5 text-sm text-n300">
              <LoaderCircle className="size-5 animate-spin text-pink" aria-hidden />
              Estamos esperando el resumen del servidor. Los indicadores aparecerán aquí en cuanto lleguen.
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-6 pt-3.5 pb-[18px]">
          <Button variant="text" onClick={download} disabled={!s} icon={<Download className="size-[18px]" aria-hidden />} title={s ? undefined : "Disponible cuando llegue el resumen"}>
            Descargar reporte (.txt)
          </Button>
          <span className="flex-1" />
          <Link href="/operaciones" className="inline-flex h-12 items-center rounded-[10px] border-[1.5px] border-pink px-[30px] font-bold text-pink hover:bg-pink/10">Volver al menú</Link>
          <Button onClick={onNew}>Nueva simulación</Button>
        </footer>
      </div>
    </Overlay>
  );
}
