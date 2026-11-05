"use client";

import { Gauge } from "lucide-react";
import { Meter } from "@/components/ui/feedback";
import { ToneBadge } from "@/components/ui/ToneBadge";
import { PanelSection } from "@/components/workspace/SidePanel";
import { FLEET_OCCUPANCY_BANDS } from "@/config/simulacion";
import { TONE_COLOR } from "@/lib/constants";
import { useSimulationRows } from "@/lib/data/hooks";
import { formatNumber } from "@/lib/format";
import { percentTone, type ToneDirection } from "@/lib/occupancy";
import type { DataScope, PercentBands, SimSettings } from "@/lib/types";

function OccupancyCard({ label, pct, used, capacity, unit, bands, direction, legend }: {
  label: string; pct: number; used: number; capacity: number; unit: string; bands: PercentBands; direction: ToneDirection; legend: string;
}) {
  const tone = percentTone(pct, bands, direction);
  const known = Number.isFinite(pct);
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-night px-4 py-3.5">
      <span className="text-xs text-n500">{label}</span>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-2xl leading-tight font-bold text-white tabular-nums">{known ? `${Math.round(pct)} %` : "—"}</span>
        {known && <ToneBadge tone={tone} />}
      </div>
      <Meter value={known ? pct / 100 : 0} color={tone ? TONE_COLOR[tone] : "var(--color-line-strong)"} label={label} />
      <span className="text-xs text-n500 tabular-nums">{known ? `${formatNumber(used)} de ${formatNumber(capacity)} ${unit}` : "Sin datos todavía"}</span>
      <span className="text-[11px] leading-snug text-n600">{legend}</span>
    </div>
  );
}

/**
 * Ocupación global de la flota (semáforo fijo) y llenado global de los
 * almacenes intermedios (umbrales en % de la configuración). Lee la foto que
 * muestra el mapa; solo se calcula mientras el panel de métricas está abierto.
 */
export function OccupancyMetrics({ scope, settings }: { scope: DataScope; settings: SimSettings }) {
  const rows = useSimulationRows(scope, settings);
  let load = 0, cap = 0, stock = 0, whCap = 0;
  for (const v of rows.vehicles) if (v.capacity > 0) { load += v.load; cap += v.capacity; }
  for (const w of rows.warehouses) if (w.kind !== "principal" && w.stock != null && w.capacity) { stock += w.stock; whCap += w.capacity; }
  const f = FLEET_OCCUPANCY_BANDS, b = settings.warehouseFill;
  return (
    <PanelSection title="Ocupación" icon={<Gauge className="size-[18px]" aria-hidden />}>
      <div className="grid grid-cols-2 gap-2.5">
        <OccupancyCard
          label="Ocupación de la flota"
          pct={rows.fleetOccupancy}
          used={load}
          capacity={cap}
          unit="paquetes"
          bands={f}
          direction="lowIsGreen"
          legend={`Verde < ${f.low} %, ámbar ${f.low}–${f.high} %, rojo > ${f.high} %.`}
        />
        <OccupancyCard
          label="Llenado de almacenes"
          pct={rows.warehouseFill}
          used={stock}
          capacity={whCap}
          unit="paquetes"
          bands={b}
          direction="highIsGreen"
          legend={`Intermedios. Rojo ≤ ${b.low} %, ámbar hasta ${b.high} %, verde ≥ ${b.high} %.`}
        />
      </div>
    </PanelSection>
  );
}
