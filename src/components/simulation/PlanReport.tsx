"use client";

import { LoaderCircle, Route, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/feedback";
import * as api from "@/lib/backend/api";
import { ErrorServicio } from "@/lib/backend/api";
import type { ReportePlan } from "@/lib/backend/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { planStamp, planTotals, stopLabel, unitKindLabel, type WarehouseNames } from "@/lib/plan-report";

export type PlanSource = { kind: "simulacion" | "operacion"; id: string };

// Pide el reporte del plan una vez por corrida u operación.
export function usePlanReport(source: PlanSource | null) {
  const [state, setState] = useState<{ key: string; report: ReportePlan | null; names: WarehouseNames; error: string | null } | null>(null);
  const key = source ? `${source.kind}:${source.id}` : null;
  useEffect(() => {
    if (!source || !key) return;
    let vivo = true;
    // Los nombres de los almacenes son opcionales: sin ellos se muestra el id.
    const almacenes = api.obtenerAlmacenes().catch(() => []);
    Promise.all([source.kind === "simulacion" ? api.planCorrida(source.id) : api.planOperacion(source.id), almacenes])
      .then(([report, lista]) => vivo && setState({ key, report, names: Object.fromEntries(lista.map((a) => [a.id, a.nombre])), error: null }))
      .catch((e) => vivo && setState({ key, report: null, names: {}, error: e instanceof ErrorServicio ? e.message : "No se pudo contactar con el servidor." }));
    return () => { vivo = false; };
    // La fuente se identifica por su clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state && state.key === key ? state : null;
  return { report: current?.report ?? null, names: current?.names ?? {}, error: current?.error ?? null, loading: !!key && !current };
}

// Rutas del último plan comprometido, con sus paradas y horarios.
export function PlanReport({ report, names = {}, error, loading }: { report: ReportePlan | null; names?: WarehouseNames; error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-n300">
        <LoaderCircle className="size-4 animate-spin text-pink" aria-hidden />Consultando la última planificación…
      </p>
    );
  }
  if (error) {
    return <p role="alert" className="flex items-center gap-2 text-sm text-critic"><TriangleAlert className="size-4" aria-hidden />{error}</p>;
  }
  const plan = report?.plan;
  if (!plan) return <p className="text-sm text-n400">Sin planificación: terminó antes de la primera.</p>;
  const t = planTotals(plan);
  const routes = plan.rutas.filter((r) => r.paradas.length > 0);
  return (
    <div className="grid gap-3">
      <p className="text-xs text-n500">Planificado el {planStamp(plan.fechaHora)} (hora simulada) con {plan.algoritmo}.</p>
      <div className="grid grid-cols-4 gap-2.5">
        <StatCard label="Rutas" value={formatNumber(t.routes)} detail={`${t.deliveries} entregas, ${t.orders} pedidos`} />
        <StatCard label="Paquetes planificados" value={formatNumber(plan.paquetesPlanificados)} detail={t.unassignedOrders ? `${t.unassignedPackages} sin asignar` : "todo asignado"} />
        <StatCard label="Distancia" value={`${formatNumber(plan.kilometros)} km`} detail="de todas las rutas" />
        <StatCard label="Costo" value={formatMoney(plan.costo)} detail="de todas las rutas" />
      </div>
      {routes.length === 0 ? (
        <p className="text-sm text-n400">El plan no tenía rutas con paradas.</p>
      ) : (
        <ul className="grid max-h-[260px] gap-1.5 overflow-y-auto pr-1" aria-label="Rutas del plan">
          {routes.map((r) => (
            <li key={r.codigoUnidad}>
              <details className="rounded-lg border border-line bg-panel px-3 py-2 text-[13px]">
                <summary className="flex cursor-pointer items-center gap-2 text-white">
                  <Route className="size-4 shrink-0 text-pink" aria-hidden />
                  <span className="font-semibold">{unitKindLabel(r.tipoUnidad)} {r.codigoUnidad}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-n400 tabular-nums">{r.paradas.length} {r.paradas.length === 1 ? "parada" : "paradas"} · {r.kilometros} km · {formatMoney(r.costo)}</span>
                </summary>
                <table className="mt-2 w-full text-xs">
                  <thead className="text-left text-n500">
                    <tr><th className="font-normal">Llegada</th><th className="font-normal">Salida</th><th className="font-normal">Punto</th><th className="font-normal">Parada</th></tr>
                  </thead>
                  <tbody className="text-n200 tabular-nums">
                    {r.paradas.map((p, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="py-1">{planStamp(p.fechaHoraLlegada)}</td>
                        <td>{planStamp(p.fechaHoraSalida)}</td>
                        <td>({p.x},{p.y})</td>
                        <td>{stopLabel(p, names)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
