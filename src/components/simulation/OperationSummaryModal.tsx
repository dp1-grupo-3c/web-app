"use client";

import { Activity, CircleAlert, CircleCheck, Clock, Download, LoaderCircle, Route, SlidersVertical, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PriorityBars } from "@/components/panels/PriorityBars";
import { PlanReport, usePlanReport } from "@/components/simulation/PlanReport";
import { Button, IconButton } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/feedback";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { BREAKDOWN_COLOR, breakdownInfo } from "@/lib/constants";
import { distanceKmFromBackend, formatoFechaOperativa, metricasToMetrics } from "@/lib/data/adapters";
import { useOperacion, useOperacionBreakdowns } from "@/lib/data/hooks";
import { formatElapsed, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { planReportLines } from "@/lib/plan-report";
import { bandRows, downloadTextFile, type UsedBands } from "@/lib/report";
import type { EstadoOperacion } from "@/lib/backend/types";

const HERO: Record<EstadoOperacion, { box: string; icon: string; Icon: typeof CircleCheck; title: string; detail: string }> = {
  DETENIDA: {
    box: "border-success/30 bg-success/6", icon: "bg-success/14 text-success", Icon: CircleCheck,
    title: "Operación cerrada", detail: "La operación se detuvo para todas las sesiones. Estos son sus indicadores al cierre.",
  },
  FALLIDA: {
    box: "border-critic/35 bg-critic/7", icon: "bg-critic/14 text-critic", Icon: TriangleAlert,
    title: "La operación terminó con un error", detail: "Los indicadores muestran el estado alcanzado antes del fallo.",
  },
  EN_CURSO: {
    box: "border-warning/30 bg-warning/6", icon: "bg-warning/14 text-warning", Icon: CircleAlert,
    title: "La operación sigue en curso", detail: "Los indicadores son parciales y cambian mientras la operación avanza.",
  },
};

// Misma caja que el resumen de simulaciones.
function Box({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-night px-4 py-3.5", className)}>
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-white">{icon}{title}</h3>
      {children}
    </section>
  );
}

type Props = {
  /** Operación cuyo cierre se muestra. */
  id: string;
  /** Semáforos en % con los que se mostró la operación. */
  bands: UsedBands;
  onClose: () => void;
  onNew: () => void;
};

/**
 * Cierre de operaciones con la estética del resumen de simulaciones: resultado,
 * indicadores, semáforos, averías y la última planificación estable.
 */
export function OperationSummaryModal({ id, bands, onClose, onNew }: Props) {
  const toast = useToast();
  const plan = usePlanReport({ kind: "operacion", id });
  const { vista: actual } = useOperacion();
  const breakdowns = useOperacionBreakdowns();
  // Solo se usan los indicadores si la vista cargada es la de esta operación.
  const vista = actual?.contextoId === id ? actual : null;
  const hero = HERO[vista?.estado ?? "DETENIDA"];
  const m = vista ? metricasToMetrics(vista.instantanea.metricas) : null;
  const km = vista ? distanceKmFromBackend(vista.instantanea.metricas.kilometrosPorTipo) : null;

  const download = () => {
    if (!plan.report) return;
    const header = vista ? [`Cierre de operaciones · ${formatoFechaOperativa(vista.fechaHoraOperativa)} (${vista.zonaHoraria})`, ""] : [];
    downloadTextFile(`cierre-operaciones-${id}.txt`, `${[...header, ...planReportLines(plan.report, plan.names)].join("\n")}\n`);
    toast.success("Descargamos el reporte en formato .txt.");
  };

  return (
    <Overlay onClose={onClose} labelledBy="ops-summary-title">
      <div className="flex max-h-[calc(100dvh-48px)] w-[920px] max-w-full flex-col overflow-hidden rounded-[20px] border border-line-strong bg-panel shadow-[0_24px_64px_rgb(0_0_0/0.55)]">
        <header className="flex items-center gap-3.5 border-b border-line py-4 pr-5 pl-6">
          <Logo size={44} />
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.08em] text-n600 uppercase">Cierre de operaciones</p>
            <h2 id="ops-summary-title" className="text-xl leading-tight font-bold text-white">Operación diaria</h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}><X className="size-[22px]" /></IconButton>
        </header>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-5">
          <div className={cn("flex items-center gap-4 rounded-[14px] border px-[18px] py-4", hero.box)}>
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", hero.icon)}><hero.Icon className="size-[26px]" aria-hidden /></span>
            <div>
              <p className="text-xl leading-snug font-bold text-white">{hero.title}</p>
              <p className="mt-1 text-sm text-n300">
                {vista ? `${formatoFechaOperativa(vista.fechaHoraOperativa)} (${vista.zonaHoraria}) · ${vista.configuracion.algoritmo}. ` : ""}
                {vista?.estado === "FALLIDA" && vista.error ? vista.error : hero.detail}
              </p>
            </div>
          </div>

          {vista && m && km ? (
            <>
              <div className="grid grid-cols-4 gap-2.5">
                <StatCard label="Pedidos entregados" value={formatNumber(m.delivered)} detail={`${formatPercent(m.onTimeRate)} a tiempo`} />
                <StatCard label="Tiempo de operación" value={formatElapsed(vista.minutosTranscurridos)} detail={`${formatNumber(vista.instantanea.metricas.ejecucionesPlanificador)} planificaciones`} />
                <StatCard label="Distancia recorrida" value={`${formatNumber(m.distanceKm)} km`} detail={`Auto ${km.auto} · Moto ${km.moto} · Bici ${km.bicicleta}`} />
                <StatCard label="Costo total por rutas" value={formatMoney(m.accumulatedCost)} detail="toda la flota" />
              </div>
              <div className="grid grid-cols-[1.15fr_1fr] gap-3.5">
                <Box title="Tiempo promedio de entrega por prioridad" icon={<Clock className="size-4" aria-hidden />}>
                  <PriorityBars items={m.avgDeliveryByPriority} compact />
                </Box>
                <div className="flex flex-col gap-3.5">
                  <Box title="Rangos del semáforo usados" icon={<SlidersVertical className="size-4" aria-hidden />}>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      {bandRows(bands).map(([name, text]) => (
                        <div key={name} className="contents">
                          <dt className="font-semibold text-n300">{name}</dt>
                          <dd className="text-n400 tabular-nums">{text}</dd>
                        </div>
                      ))}
                    </dl>
                  </Box>
                  <Box title="Averías de la operación" icon={<Activity className="size-4" aria-hidden />} className="flex-1">
                    {breakdowns.length ? (
                      <ol className="max-h-[150px] overflow-y-auto pr-1">
                        {breakdowns.map((b) => (
                          <li key={b.id} className="grid grid-cols-[10px_1fr_auto] items-center gap-2.5 border-b border-line py-1.5 text-[13px] text-white last:border-b-0">
                            <i className="size-2 rounded-full" style={{ background: BREAKDOWN_COLOR[b.type].color }} aria-hidden />
                            <span>{b.plate} · avería {breakdownInfo(b.type).name.toLowerCase()}{b.status === "resuelta" ? " (resuelta)" : ""}</span>
                            <span className="text-xs text-n500 tabular-nums">{b.when}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-[13px] text-n400">No se registraron averías.</p>
                    )}
                  </Box>
                </div>
              </div>
            </>
          ) : (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-night px-4 py-5 text-sm text-n300">
              <LoaderCircle className="size-5 animate-spin text-pink" aria-hidden />
              Estamos esperando los indicadores del servidor. Aparecerán aquí en cuanto lleguen.
            </div>
          )}

          <Box title="Última planificación estable" icon={<Route className="size-4" aria-hidden />}>
            <PlanReport report={plan.report} names={plan.names} error={plan.error} loading={plan.loading} />
          </Box>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-6 pt-3.5 pb-[18px]">
          <Button variant="text" onClick={download} disabled={!plan.report} icon={<Download className="size-[18px]" aria-hidden />} title={plan.report ? undefined : "Disponible cuando llegue la planificación"}>
            Descargar reporte (.txt)
          </Button>
          <span className="flex-1" />
          <Link href="/operaciones" className="inline-flex h-12 items-center rounded-[10px] border-[1.5px] border-pink px-[30px] font-bold text-pink hover:bg-pink/10">Volver al menú</Link>
          <Button onClick={onNew}>Nueva operación</Button>
        </footer>
      </div>
    </Overlay>
  );
}
