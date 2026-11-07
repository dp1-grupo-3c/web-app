"use client";

import { CircleDashed, House, Package, PackageCheck, SearchX, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Chip } from "@/components/ui/choice";
import { EmptyState, Meter } from "@/components/ui/feedback";
import { TONE_ICON, ToneBadge } from "@/components/ui/ToneBadge";
import { SidePanel } from "@/components/workspace/SidePanel";
import { RECENT_DELIVERIES_WINDOW_MIN } from "@/config/simulacion";
import { WorldEditor } from "./config/WorldEditor";
import { cn } from "@/lib/cn";
import { TONE_COLOR, TONE_LABEL } from "@/lib/constants";
import { useSimulationRows } from "@/lib/data/hooks";
import type { WarehouseRow } from "@/lib/data/selectors";
import { formatCoord } from "@/lib/format";
import { filterBy, sortBy, toggleIn } from "@/lib/list-tools";
import type { DataScope, SimSettings, StatusTone } from "@/lib/types";

const TONES: StatusTone[] = ["ok", "warn", "crit"];
/** Semáforo de llenado o "vacío" (stock 0); un almacén vacío también puede contar en su color. */
type Filter = StatusTone | "empty";
const isEmpty = (w: WarehouseRow) => w.stock === 0;

const HOURS = RECENT_DELIVERIES_WINDOW_MIN / 60;

/**
 * Listado de almacenes: semáforo de llenado (umbrales en % de la
 * configuración), stock, ocupación y movimiento de pedidos. Elegir uno lo
 * resalta en el mapa; elegirlo en el mapa lo resalta aquí (con scroll).
 */
export function WarehousesPanel({ scope, settings, selectedId, onSelect, onClose, width, locked }: {
  scope: DataScope; settings: SimSettings; selectedId: string | null; onSelect: (id: string | null) => void; onClose: () => void; width: number;
  /** Hay una corrida activa: el mapa y los almacenes no se pueden editar. */
  locked: boolean;
}) {
  const data = useSimulationRows(scope, settings);
  // Filtro por semáforo de llenado: sin colores elegidos se ven todos (el central no tiene semáforo).
  const [tones, setTones] = useState<ReadonlySet<Filter>>(() => new Set());
  const filtered = filterBy(data.warehouses, [tones.size ? (w) => (w.tone != null && tones.has(w.tone)) || (tones.has("empty") && isEmpty(w)) : null]);
  // El central primero; luego los intermedios por nombre.
  const rows = sortBy(filtered, (w) => `${w.kind === "principal" ? 0 : 1}${w.name}`);
  const count = (t: StatusTone) => data.warehouses.filter((w) => w.tone === t).length;
  return (
    <SidePanel title="Almacenes" subtitle="Stock, ocupación, ubicación y capacidad de cada almacén." onClose={onClose} width={width}>
      {data.warehouses.some((w) => w.tone) && (
        <div role="group" aria-label="Filtrar por semáforo de llenado" className="flex flex-wrap items-center gap-1.5">
          {TONES.map((t) => {
            const Icon = TONE_ICON[t];
            return (
              <Chip key={t} on={tones.has(t)} onClick={() => setTones((s) => toggleIn(s, t))}>
                <Icon className="size-3.5" style={{ color: TONE_COLOR[t] }} aria-hidden />{TONE_LABEL[t]} <span className="text-n500 tabular-nums">{count(t)}</span>
              </Chip>
            );
          })}
          <Chip on={tones.has("empty")} onClick={() => setTones((s) => toggleIn(s, "empty"))}>
            <CircleDashed className="size-3.5 text-n400" aria-hidden />Vacío <span className="text-n500 tabular-nums">{data.warehouses.filter(isEmpty).length}</span>
          </Chip>
          {tones.size > 0 && <button type="button" className="px-1 text-xs text-n400 underline-offset-2 hover:underline" onClick={() => setTones(new Set())}>Ver todos</button>}
        </div>
      )}
      {data.warehouses.length > 0 && rows.length === 0 ? (
        <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Ningún almacén cumple el filtro">Prueba con otro filtro o pulsa “Ver todos”.</EmptyState>
      ) : rows.length === 0 ? (
        locked && <EmptyState icon={<WarehouseIcon className="size-8" aria-hidden />} title="Aún no hay almacenes">Aparecerán en cuanto el servidor envíe la primera fotografía.</EmptyState>
      ) : (
        <>
          <ul role="listbox" aria-label="Almacenes (elige uno para resaltarlo en el mapa)" className="grid grid-cols-1 gap-2">
            {rows.map((w) => <WarehouseItem key={w.id} row={w} selected={w.id === selectedId} onSelect={onSelect} />)}
          </ul>
          <p className="text-xs leading-snug text-n600">
            Pedidos en camino, por salir y entregados en las últimas {HOURS} h (tiempo simulado) se estiman con los movimientos observados desde que abriste esta pantalla.
          </p>
        </>
      )}
      <WorldEditor locked={locked} />
    </SidePanel>
  );
}

const WarehouseItem = memo(function WarehouseItem({ row: w, selected, onSelect }: { row: WarehouseRow; selected: boolean; onSelect: (id: string | null) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [selected]);
  const central = w.kind === "principal";
  const known = Number.isFinite(w.occupancy);
  const toggle = () => onSelect(selected ? null : w.id);
  return (
    <li
      ref={ref}
      role="option"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`${w.name}, ${central ? "almacén central" : "almacén intermedio"}`}
      data-id={w.id}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      className={cn(
        "grid cursor-pointer grid-cols-1 gap-2 rounded-xl border bg-night p-3 text-[13px] outline-none hover:border-n900 focus-visible:border-warning",
        selected ? "border-pink shadow-[inset_3px_0_0_var(--color-pink)]" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        {central ? <House className="size-4 shrink-0 text-pink" aria-hidden /> : <Package className="size-4 shrink-0 text-n300" aria-hidden />}
        <b className="truncate text-white">{w.name}</b>
        <span className="truncate text-xs text-n500">{central ? "Central" : "Intermedio"} · {formatCoord(w.position)}</span>
        {!central && <span className="ml-auto flex shrink-0 items-center gap-1.5"><b className="whitespace-nowrap text-white tabular-nums">{known ? `${Math.round(w.occupancy)} %` : "—"}</b><ToneBadge tone={w.tone} /></span>}
      </div>
      {!central && <Meter value={known ? w.occupancy / 100 : 0} color={w.tone ? TONE_COLOR[w.tone] : "var(--color-line-strong)"} label={`Ocupación de ${w.name}`} />}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs [&_dd]:text-right [&_dd]:text-white [&_dd]:tabular-nums [&_div]:flex [&_div]:justify-between [&_div]:gap-2 [&_dt]:flex [&_dt]:items-center [&_dt]:gap-1 [&_dt]:text-n500">
        <div className="col-span-2"><dt><Package className="size-3" aria-hidden />Stock actual</dt><dd>{central ? "Ilimitado" : `${w.stock ?? "—"} / ${w.capacity ?? "—"} paquetes`}</dd></div>
        <div><dt><Truck className="size-3" aria-hidden />En camino</dt><dd>{w.inTransit}</dd></div>
        <div><dt>Por salir</dt><dd>{w.toDepart}</dd></div>
        <div className="col-span-2"><dt><PackageCheck className="size-3" aria-hidden />Entregados (últimas {HOURS} h)</dt><dd>{w.deliveredRecent}</dd></div>
      </dl>
    </li>
  );
});
