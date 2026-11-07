"use client";

import { CircleDashed, House, Package, PackageCheck, SearchX, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "@/components/ui/choice";
import { EmptyState, Meter } from "@/components/ui/feedback";
import { NumberInput } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { TONE_ICON, ToneBadge } from "@/components/ui/ToneBadge";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { RECENT_DELIVERIES_WINDOW_MIN } from "@/config/simulacion";
import { cn } from "@/lib/cn";
import { TONE_COLOR, TONE_LABEL } from "@/lib/constants";
import { useSimulationRows, useWarehouseDeliveries, type WarehouseDelivery } from "@/lib/data/hooks";
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
  const selected = selectedId ? data.warehouses.find((w) => w.id === selectedId) ?? null : null;
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
      {selected && <WarehouseDeliveries key={selected.id} scope={scope} warehouse={selected} />}
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

const MAX_DELIVERY_HOURS = 24;
const DELIVERIES_PAGE_SIZE = 8;

/** Horas enteras entre 1 y 24 (lo que guarda el backend); null si el texto no es válido. */
function parseHours(text: string): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DELIVERY_HOURS ? n : null;
}

type DeliveredOrder = { orderId: string; packages: number; plates: string[]; deliveredAt: string };

/**
 * Una fila por pedido: suma los paquetes de sus entregas (puede llegar en partes
 * y en varios vehículos) y toma la hora de la más reciente. `rows` viene de la
 * más reciente a la más antigua, así que se conserva ese orden.
 */
function byOrder(rows: WarehouseDelivery[]): DeliveredOrder[] {
  const orders = new Map<string, DeliveredOrder>();
  for (const d of rows) {
    const o = orders.get(d.orderId);
    if (!o) orders.set(d.orderId, { orderId: d.orderId, packages: d.packages, plates: [d.plate], deliveredAt: d.deliveredAt });
    else {
      o.packages += d.packages;
      if (!o.plates.includes(d.plate)) o.plates.push(d.plate);
    }
  }
  return [...orders.values()];
}

/** Tabla de los pedidos entregados en las últimas X horas que salieron del almacén elegido, uno por fila. */
function WarehouseDeliveries({ scope, warehouse }: { scope: DataScope; warehouse: WarehouseRow }) {
  const [hoursText, setHoursText] = useState(String(HOURS));
  const [hours, setHours] = useState(HOURS);
  const [page, setPage] = useState(1);
  const deliveries = useWarehouseDeliveries(scope, warehouse.id, hours);
  const rows = useMemo(() => (deliveries ? byOrder(deliveries) : null), [deliveries]);
  const totalPackages = rows?.reduce((n, o) => n + o.packages, 0) ?? 0;
  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / DELIVERIES_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const slice = rows?.slice((current - 1) * DELIVERIES_PAGE_SIZE, current * DELIVERIES_PAGE_SIZE) ?? [];
  return (
    <PanelSection title={`Entregados desde ${warehouse.name}`} icon={<PackageCheck className="size-[18px]" aria-hidden />}>
      <div className="flex items-center gap-1.5 text-[13px] text-n200">
        En las últimas
        <NumberInput
          aria-label="Horas hacia atrás de las entregas del almacén"
          className="w-20"
          min={1}
          max={MAX_DELIVERY_HOURS}
          value={hoursText}
          error={parseHours(hoursText) == null}
          onValueChange={(v) => { setHoursText(v); const n = parseHours(v); if (n != null) { setHours(n); setPage(1); } }}
        />
        h
      </div>
      {rows == null ? (
        <p className="text-xs text-n500">Cargando entregas…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<PackageCheck className="size-7" aria-hidden />} title={`Sin entregas en las últimas ${hours} h`}>Amplía el número de horas para ver más.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-night">
          <table className="w-full table-fixed text-[13px]">
            <colgroup><col style={{ width: "24%" }} /><col style={{ width: "22%" }} /><col style={{ width: "28%" }} /><col style={{ width: "26%" }} /></colgroup>
            <thead className="h-10 bg-raised text-[11px] text-n500">
              <tr>
                <th className="px-3 text-left font-medium">Pedido</th>
                <th className="px-3 text-right font-medium">Paquetes</th>
                <th className="px-3 text-left font-medium">Vehículos</th>
                <th className="px-3 text-right font-medium">Entregado</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((o) => (
                <tr key={o.orderId} className="h-10 border-t border-line text-white tabular-nums [&>td]:truncate [&>td]:px-3">
                  <td><b>{o.orderId}</b></td>
                  <td className="text-right">{o.packages}</td>
                  <td title={o.plates.join(", ")}>{o.plates[0]}{o.plates.length > 1 ? ` +${o.plates.length - 1}` : ""}</td>
                  <td className="text-right" title="Hora de la última entrega del pedido">{o.deliveredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex h-11 items-center justify-between gap-2 border-t border-line bg-raised px-3 text-[11px] text-n400">
            <span>{rows.length} {rows.length === 1 ? "pedido" : "pedidos"} · {totalPackages} {totalPackages === 1 ? "paquete" : "paquetes"}</span>
            {pageCount > 1 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
          </div>
        </div>
      )}
    </PanelSection>
  );
}
