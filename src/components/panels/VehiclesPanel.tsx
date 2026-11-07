"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, CircleDashed, Clock, Flag, House, Package, Route, Search, Truck } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { VEHICLE_STATUS_LABEL } from "@/components/map/layers";
import { Button } from "@/components/ui/Button";
import { Chip, SegmentedControl } from "@/components/ui/choice";
import { EmptyState, Meter } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/Pagination";
import { TONE_ICON, ToneBadge } from "@/components/ui/ToneBadge";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { cn } from "@/lib/cn";
import { TONE_COLOR, TONE_LABEL } from "@/lib/constants";
import { useSimulationRows } from "@/lib/data/hooks";
import { formatSimClock as simClock, type VehicleRow } from "@/lib/data/selectors";
import { formatDuration } from "@/lib/format";
import { filterBy, inSet, sortBy, toggleIn, type SortDir } from "@/lib/list-tools";
import { DISTANCE_BAND_LABEL, DISTANCE_BANDS, distanceBand } from "@/lib/occupancy";
import type { DataScope, DistanceBand, SimSettings, StatusTone } from "@/lib/types";

type SortKey = "occupancy" | "departure" | "arrival" | "traveled";
const SORTS: { value: SortKey; label: string; key: (r: VehicleRow) => number | null }[] = [
  { value: "occupancy", label: "Ocupación", key: (r) => r.occupancy },
  { value: "departure", label: "Salida", key: (r) => r.departureMinute },
  { value: "arrival", label: "Llegada", key: (r) => r.arrivalMinute },
  { value: "traveled", label: "Recorrido", key: (r) => r.traveledKm },
];
const TONES: StatusTone[] = ["ok", "warn", "crit"];
/** Semáforo de ocupación o "vacío" (sin carga a bordo); un vacío también cuenta como verde. */
type Filter = StatusTone | "empty";
const isEmpty = (r: VehicleRow) => r.load <= 0;
const PAGE_SIZE = 8;

const km = (n: number | null) => (n == null ? "—" : `${Math.round(n)} km`);


/**
 * Listado de vehículos durante la simulación: ocupación con semáforo, carga,
 * pedidos, llegada al destino, distancias y horas. Filtra por color y por
 * rango de la distancia restante al destino; ordena por un criterio a la vez.
 * Lee la foto que muestra el mapa y solo se calcula mientras está abierto.
 */
export function VehiclesPanel({ scope, settings, selectedId, onSelect, onClose, width }: {
  scope: DataScope; settings: SimSettings; selectedId: string | null; onSelect: (id: string | null) => void; onClose: () => void; width: number;
}) {
  const data = useSimulationRows(scope, settings);
  const [tones, setTones] = useState<ReadonlySet<Filter>>(() => new Set());
  const [bands, setBands] = useState<ReadonlySet<DistanceBand>>(() => new Set());
  const [sort, setSort] = useState<SortKey>("occupancy");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const rows = sortBy(
    filterBy(data.vehicles, [tones.size ? (r) => (r.tone != null && tones.has(r.tone)) || (tones.has("empty") && isEmpty(r)) : null, inSet(bands, (r) => distanceBand(r.remainingKm))]),
    SORTS.find((s) => s.value === sort)!.key,
    dir,
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Un vehículo elegido en el mapa salta a su página.
  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;
  const [followed, setFollowed] = useState<string | null>(null);
  if (selectedId !== followed) {
    setFollowed(selectedId);
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE_SIZE) + 1);
  }
  const current = Math.min(page, pageCount);
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const count = (pred: (r: VehicleRow) => boolean) => data.vehicles.filter(pred).length;
  const reset = () => setPage(1);

  return (
    <SidePanel title="Vehículos" subtitle="Ocupación, carga y avance de cada unidad." onClose={onClose} width={width}>
      <PanelSection title="Filtros" icon={<Search className="size-[18px]" aria-hidden />}>
        <div role="group" aria-label="Filtrar por semáforo de ocupación o vehículos vacíos" className="flex flex-wrap gap-1.5">
          {TONES.map((t) => {
            const Icon = TONE_ICON[t];
            return (
              <Chip key={t} on={tones.has(t)} onClick={() => { setTones((s) => toggleIn(s, t)); reset(); }}>
                <Icon className="size-3.5" style={{ color: TONE_COLOR[t] }} aria-hidden />{TONE_LABEL[t]} <span className="text-n500 tabular-nums">{count((r) => r.tone === t)}</span>
              </Chip>
            );
          })}
          <Chip on={tones.has("empty")} onClick={() => { setTones((s) => toggleIn(s, "empty")); reset(); }}>
            <CircleDashed className="size-3.5 text-n400" aria-hidden />Vacío <span className="text-n500 tabular-nums">{count(isEmpty)}</span>
          </Chip>
        </div>
        <div role="group" aria-label="Filtrar por distancia restante al destino" className="grid gap-1.5">
          <span className="text-xs text-n500">Distancia restante al destino</span>
          <div className="flex flex-wrap gap-1.5">
            {DISTANCE_BANDS.map((b) => (
              <Chip key={b} on={bands.has(b)} onClick={() => { setBands((s) => toggleIn(s, b)); reset(); }}>
                {DISTANCE_BAND_LABEL[b]} <span className="text-n500 tabular-nums">{count((r) => distanceBand(r.remainingKm) === b)}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <span id="veh-sort" className="text-xs text-n500">Ordenar por</span>
            <Button
              variant="text"
              size="xs"
              aria-label={`Dirección del orden: ${dir === "asc" ? "de menor a mayor" : "de mayor a menor"}. Pulsa para invertirla.`}
              icon={dir === "asc" ? <ArrowUpNarrowWide className="size-4" aria-hidden /> : <ArrowDownWideNarrow className="size-4" aria-hidden />}
              onClick={() => { setDir((d) => (d === "asc" ? "desc" : "asc")); reset(); }}
            >
              {dir === "asc" ? "Menor a mayor" : "Mayor a menor"}
            </Button>
          </div>
          <SegmentedControl label="Ordenar por" value={sort} onChange={(v) => { setSort(v); reset(); }} options={SORTS.map(({ value, label }) => ({ value, label }))} />
        </div>
      </PanelSection>

      {data.vehicles.length === 0 ? (
        <EmptyState icon={<Truck className="size-8" aria-hidden />} title="Aún no hay vehículos">Aparecerán en cuanto el servidor envíe la primera fotografía.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search className="size-7" aria-hidden />} title="Ningún vehículo cumple los filtros">Quita algún filtro para ver más unidades.</EmptyState>
      ) : (
        <>
          <p className="text-xs text-n500" aria-live="polite">{rows.length} de {data.vehicles.length} vehículos</p>
          <ul role="listbox" className="grid gap-2" aria-label="Vehículos (elige uno para resaltarlo en el mapa)">
            {slice.map((r) => <VehicleItem key={r.id} row={r} selected={r.id === selectedId} onSelect={onSelect} simTime={data.simTime} now={data.minute} />)}
          </ul>
          {pageCount > 1 && <div className="flex justify-center"><Pagination page={current} pageCount={pageCount} onChange={setPage} /></div>}
          <p className="text-xs leading-snug text-n600">La salida y el almacén de origen se estiman con lo observado desde que abriste esta pantalla. La distancia recorrida corresponde al itinerario vigente.</p>
        </>
      )}
    </SidePanel>
  );
}

const VehicleItem = memo(function VehicleItem({ row: r, selected, onSelect, simTime, now }: { row: VehicleRow; selected: boolean; onSelect: (id: string | null) => void; simTime: string | null; now: number | null }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [selected]);
  const { label, Icon, color } = VEHICLE_META[r.kind];
  const pct = Number.isFinite(r.occupancy) ? `${Math.round(r.occupancy)} %` : "—";
  const toggle = () => onSelect(selected ? null : r.id);
  return (
    <li
      ref={ref}
      role="option"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`${label} ${r.plate}`}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      className={cn(
        "grid cursor-pointer gap-2 rounded-xl border bg-night p-3 text-[13px] outline-none hover:border-n900 focus-visible:border-warning",
        selected ? "border-pink shadow-[inset_3px_0_0_var(--color-pink)]" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
        <b className="text-white">{r.plate}</b>
        <span className="truncate text-xs text-n500">{VEHICLE_STATUS_LABEL[r.status]}</span>
        <span className="ml-auto flex items-center gap-1.5"><b className="text-white tabular-nums">{pct}</b><ToneBadge tone={r.tone} /></span>
      </div>
      <Meter value={Number.isFinite(r.occupancy) ? r.occupancy / 100 : 0} color={r.tone ? TONE_COLOR[r.tone] : "var(--color-line-strong)"} label={`Ocupación de ${r.plate}`} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs [&_dd]:text-right [&_dd]:text-white [&_dd]:tabular-nums [&_div]:flex [&_div]:justify-between [&_div]:gap-2 [&_dt]:flex [&_dt]:items-center [&_dt]:gap-1 [&_dt]:text-n500">
        <div><dt><Package className="size-3" aria-hidden />A bordo</dt><dd>{r.load} / {r.capacity}</dd></div>
        <div><dt>Pedidos asignados</dt><dd>{r.orderIds.length}</dd></div>
        <div className="col-span-2"><dt><Flag className="size-3" aria-hidden />Faltan para el destino</dt><dd>{r.etaMinutes != null ? formatDuration(r.etaMinutes) : "—"} · {km(r.remainingKm)}</dd></div>
        <div><dt><Route className="size-3" aria-hidden />Recorrido</dt><dd>{km(r.traveledKm)}</dd></div>
        <div><dt><House className="size-3" aria-hidden />Desde origen</dt><dd>{km(r.fromOriginKm)}</dd></div>
        <div className="col-span-2"><dt><Clock className="size-3" aria-hidden />Salida · llegada</dt><dd>{simClock(simTime, now, r.departureMinute)} · {simClock(simTime, now, r.arrivalMinute)}</dd></div>
      </dl>
    </li>
  );
});
