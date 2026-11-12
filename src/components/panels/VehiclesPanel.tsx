"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, CircleDashed, Clock, Flag, House, Package, Pin, Route, Search, Truck } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { VEHICLE_STATUS_LABEL } from "@/components/map/layers";
import { Button } from "@/components/ui/Button";
import { Chip, SegmentedControl } from "@/components/ui/choice";
import { EmptyState, Meter } from "@/components/ui/feedback";
import { ErrorMessage, TextInput } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { TONE_ICON, ToneBadge } from "@/components/ui/ToneBadge";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { cn } from "@/lib/cn";
import { TONE_COLOR, TONE_LABEL } from "@/lib/constants";
import { useSimulationRows } from "@/lib/data/hooks";
import { formatSimClock as simClock, type VehicleRow } from "@/lib/data/selectors";
import { formatDuration } from "@/lib/format";
import { filterBy, idsMatching, inSet, sortBy, toggleIn, type SortDir } from "@/lib/list-tools";
import { useReportMapFilter } from "@/lib/map-filter";
import { DISTANCE_BAND_LABEL, DISTANCE_BANDS, distanceBand } from "@/lib/occupancy";
import { matchesDistance, parseMaxDistance, type DistanceRef, type DistanceUnit, type PhaseFilter } from "@/lib/vehicle-search";
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
const PAGE_SIZES = [4, 6, 8];
const PHASES: [PhaseFilter, string][] = [["todas", "Todas"], ["llegando", "Llegando"], ["saliendo", "Saliendo"]];
const PHASE_TEXT = { llegando: "llegando", saliendo: "saliendo" } as const;
/**
 * Alto fijo de cada tarjeta, suma exacta de sus filas: borde 2 + relleno 24 +
 * cabecera 24 + estado 16 + barra 8 + datos 4 × 20 + 3 separaciones de 8 = 178 px.
 * Así las páginas miden lo mismo aunque la última traiga menos vehículos.
 */
const CARD_HEIGHT = "h-[178px]";

const km = (n: number | null) => (n == null ? "—" : `${Math.round(n)} km`);


/**
 * Listado de vehículos durante la simulación: ocupación con semáforo, carga,
 * pedidos, llegada al destino, distancias y horas. Filtra por color y por
 * rango de la distancia restante al destino; ordena por un criterio a la vez.
 * Lee la foto que muestra el mapa y solo se calcula mientras está abierto.
 */
export function VehiclesPanel({ scope, settings, selectedId, onSelect, pinnedId, onPinChange, onClose, width, onMapFilter }: {
  scope: DataScope; settings: SimSettings; selectedId: string | null; onSelect: (id: string | null) => void;
  /** Vehículo fijado: va antes de la lista, siempre visible, sin importar filtros, orden ni página. */
  pinnedId: string | null; onPinChange: (id: string | null) => void;
  onClose: () => void; width: number;
  /** Vehículos que el mapa debe dibujar según los chips de color (null = todos). */
  onMapFilter?: (ids: ReadonlySet<string> | null) => void;
}) {
  const data = useSimulationRows(scope, settings);
  const [tones, setTones] = useState<ReadonlySet<Filter>>(() => new Set());
  const matchesTone = (r: VehicleRow) => (r.tone != null && tones.has(r.tone)) || (tones.has("empty") && isEmpty(r));
  useReportMapFilter(idsMatching(data.vehicles, tones.size > 0, matchesTone, pinnedId), onMapFilter);
  const [bands, setBands] = useState<ReadonlySet<DistanceBand>>(() => new Set());
  // Búsqueda por distancia: referencia, unidad, máximo y llegada o salida.
  const [ref, setRef] = useState<DistanceRef>("destino");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [maxText, setMaxText] = useState("");
  const [phase, setPhase] = useState<PhaseFilter>("todas");
  const max = parseMaxDistance(maxText);
  const searching = max != null || phase !== "todas";
  const [sort, setSort] = useState<SortKey>("occupancy");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PAGE_SIZES[PAGE_SIZES.length - 1]);
  // Vehículo al que hay que llevar la vista: solo cuando cambia la selección, no cada vez que su tarjeta se vuelve a montar.
  const [reveal, setReveal] = useState<string | null>(null);

  const rows = sortBy(
    filterBy(data.vehicles, [(r) => r.id !== pinnedId, tones.size ? matchesTone : null, inSet(bands, (r) => distanceBand(r.remainingKm)), searching ? (r) => matchesDistance(r, { ref, unit, max: max ?? null, phase }) : null]),
    SORTS.find((s) => s.value === sort)!.key,
    dir,
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  // Un vehículo elegido en el mapa salta a su página.
  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;
  const [followed, setFollowed] = useState<string | null>(null);
  if (selectedId !== followed) {
    setFollowed(selectedId);
    setReveal(selectedIndex >= 0 ? selectedId : null);
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / perPage) + 1);
  }
  const current = Math.min(page, pageCount);
  const slice = rows.slice((current - 1) * perPage, current * perPage);
  const count = (pred: (r: VehicleRow) => boolean) => data.vehicles.filter(pred).length;
  const pinned = pinnedId ? data.vehicles.find((r) => r.id === pinnedId) ?? null : null;
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
        <div role="group" aria-label="Buscar por distancia" className="grid gap-1.5">
          <span className="text-xs text-n500">Buscar por distancia</span>
          <SegmentedControl label="Medir la distancia" value={ref} onChange={(v) => { setRef(v); reset(); }} options={[{ value: "destino", label: "Al destino" }, { value: "origen", label: "Desde el origen" }]} />
          <div className="flex items-center gap-2">
            <label htmlFor="veh-max" className="shrink-0 text-xs text-n400">Hasta</label>
            <TextInput id="veh-max" inputMode="decimal" placeholder="sin límite" value={maxText} error={max === undefined} onChange={(e) => { setMaxText(e.target.value); reset(); }} className="min-w-0 flex-1" />
            <SegmentedControl label="Unidad de la distancia" value={unit} onChange={(v) => { setUnit(v); reset(); }} options={[{ value: "km", label: "km" }, { value: "min", label: "min" }]} />
          </div>
          {max === undefined && <ErrorMessage>Escribe un número de 0 en adelante.</ErrorMessage>}
          <div role="group" aria-label="Llegada o salida" className="flex flex-wrap gap-1.5">
            {PHASES.map(([p, text]) => (
              <Chip key={p} on={phase === p} onClick={() => { setPhase(p); reset(); }}>
                {text}{p !== "todas" && <span className="text-n500 tabular-nums">{count((r) => r.phase === p)}</span>}
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

      {pinned && (
        <section aria-label="Vehículo fijado" className="grid gap-2">
          <span className="flex items-center gap-1.5 text-xs text-n500"><Pin className="size-3.5 text-pink" fill="currentColor" aria-hidden />Vehículo fijado</span>
          <ul role="listbox" className="grid grid-cols-1" aria-label="Vehículo fijado (elígelo para resaltarlo en el mapa)">
            <VehicleItem row={pinned} selected={pinned.id === selectedId} reveal={false} onRevealed={setReveal} pinned onPinChange={onPinChange} onSelect={onSelect} simTime={data.simTime} now={data.minute} />
          </ul>
        </section>
      )}

      {data.vehicles.length === 0 ? (
        <EmptyState icon={<Truck className="size-8" aria-hidden />} title="Aún no hay vehículos">Aparecerán en cuanto el servidor envíe la primera fotografía.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search className="size-7" aria-hidden />} title="Ningún vehículo cumple los filtros">Quita algún filtro para ver más unidades.</EmptyState>
      ) : (
        <>
          <p className="text-xs text-n500" aria-live="polite">{rows.length} de {data.vehicles.length} vehículos</p>
          {/* Sin anclaje de scroll: la lista se reordena con cada foto y el navegador movería la vista siguiendo a la tarjeta anclada. */}
          <ul role="listbox" className="grid grid-cols-1 gap-2 [overflow-anchor:none]" aria-label="Vehículos (elige uno para resaltarlo en el mapa)">
            {slice.map((r) => <VehicleItem key={r.id} row={r} selected={r.id === selectedId} reveal={r.id === reveal} onRevealed={setReveal} pinned={false} onPinChange={onPinChange} onSelect={onSelect} simTime={data.simTime} now={data.minute} />)}
            {Array.from({ length: perPage - slice.length }, (_, i) => <li key={`empty-${i}`} aria-hidden className={CARD_HEIGHT} />)}
          </ul>
          <div className="flex items-center justify-between gap-2 text-[11px] text-n400">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              Por página
              <select
                aria-label="Vehículos por página"
                value={perPage}
                onChange={(e) => { setPerPage(+e.target.value); reset(); }}
                className="h-7 rounded-md border border-line-strong bg-field px-1 text-xs text-white"
              >
                {PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </span>
            <Pagination page={current} pageCount={pageCount} onChange={setPage} />
          </div>
          <p className="text-xs leading-snug text-n600">El almacén de origen y la salida los informa el servidor; si falta, se estiman con lo observado desde que abriste esta pantalla. La distancia recorrida corresponde al itinerario vigente.</p>
        </>
      )}
    </SidePanel>
  );
}

const VehicleItem = memo(function VehicleItem({ row: r, selected, reveal, onRevealed, pinned, onPinChange, onSelect, simTime, now }: {
  row: VehicleRow; selected: boolean; reveal: boolean; onRevealed: (id: null) => void; pinned: boolean; onPinChange: (id: string | null) => void;
  onSelect: (id: string | null) => void; simTime: string | null; now: number | null;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!reveal) return;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    onRevealed(null);
  }, [reveal, onRevealed]);
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
        "grid min-w-0 cursor-pointer content-start gap-2 overflow-hidden rounded-xl border bg-night p-3 text-[13px] outline-none hover:border-n900 focus-visible:border-warning",
        CARD_HEIGHT,
        selected ? "border-pink shadow-[inset_3px_0_0_var(--color-pink)]" : "border-line",
      )}
    >
      <div className="flex h-6 items-center gap-2 leading-6">
        <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
        <b className="min-w-0 truncate text-white">{r.plate}</b>
        <span className="ml-auto flex shrink-0 items-center gap-1.5"><b className="text-white tabular-nums">{pct}</b><ToneBadge tone={r.tone} /></span>
        {/* Solo hay un fijado: fijar otro reemplaza al anterior. */}
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? `Soltar ${r.plate}` : `Fijar ${r.plate} arriba de la lista`}
          title={pinned ? "Soltar" : "Fijar arriba de la lista"}
          onClick={(e) => { e.stopPropagation(); onPinChange(pinned ? null : r.id); }}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn("grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-field", pinned ? "text-pink" : "text-n500 hover:text-white")}
        >
          <Pin className="size-4" fill={pinned ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>
      <p className="h-4 truncate text-xs leading-4 text-n500" title={VEHICLE_STATUS_LABEL[r.status]}>{label} · {VEHICLE_STATUS_LABEL[r.status]}{r.phase && ` · ${PHASE_TEXT[r.phase]}`}</p>
      <Meter value={Number.isFinite(r.occupancy) ? r.occupancy / 100 : 0} color={r.tone ? TONE_COLOR[r.tone] : "var(--color-line-strong)"} label={`Ocupación de ${r.plate}`} />
      <dl className="grid grid-cols-2 gap-x-4 text-xs leading-5 [&_dd]:min-w-0 [&_dd]:truncate [&_dd]:text-right [&_dd]:text-white [&_dd]:tabular-nums [&_div]:flex [&_div]:h-5 [&_div]:min-w-0 [&_div]:items-center [&_div]:justify-between [&_div]:gap-2 [&_dt]:flex [&_dt]:shrink-0 [&_dt]:items-center [&_dt]:gap-1 [&_dt]:whitespace-nowrap [&_dt]:text-n500">
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
