import { Package } from "lucide-react";
import { VEHICLE_META } from "@/components/domain/vehicle";
import { Meter } from "@/components/ui/feedback";
import { ToneBadge } from "@/components/ui/ToneBadge";
import { TONE_COLOR, TONE_LABEL } from "@/lib/constants";
import { vehicleOccupancy, vehicleTone, warehouseOccupancy } from "@/lib/occupancy";
import type { Coord, Order, PercentBands, StatusTone, Vehicle, Warehouse } from "@/lib/types";
import { formatCoord, formatDuration } from "@/lib/format";
import { PINK } from "./layers";

/** Altura aproximada del marcador sobre su punta, para que el tooltip no lo tape. */
const PIN_HEIGHT = 46;
const WIDTH = 220;

const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n)} %` : "—");

/** Texto para lectores de pantalla: va en la etiqueta del marcador. */
export function vehicleOccupancyText(v: Vehicle, bands: PercentBands) {
  const occ = vehicleOccupancy(v);
  const tone = vehicleTone(v, bands);
  const label = tone === "empty" ? "vacío" : tone ? TONE_LABEL[tone].toLowerCase() : null;
  return `${v.load} de ${v.capacity} paquetes, ocupación ${pct(occ)}${label ? ` (${label})` : ""}`;
}

export function warehouseStockText(w: Warehouse) {
  return w.stock != null && w.capacity != null ? `stock ${w.stock} de ${w.capacity} paquetes (${pct(warehouseOccupancy(w))})` : "";
}

type Props = { x: number; y: number; mapWidth: number } & (
  | { kind: "vehicle"; vehicle: Vehicle; bands: PercentBands }
  | { kind: "warehouse"; warehouse: Warehouse; tone: StatusTone | null; empty?: boolean }
  | { kind: "blockage"; schedule: { start: string; end: string; duration: string } }
  | { kind: "stop"; stop: number; position: Coord; plate: string; orders: StopOrder[] }
);

/** Pedido de una parada; `order` falta si el servidor ya no lo lista (se está entregando). */
export type StopOrder = { id: string; packages: number; order?: Order };

const STOP_MAX_ROWS = 4;

/**
 * Tooltip del mapa al pasar el cursor (o enfocar con el teclado) un marcador.
 * Solo existe para el marcador bajo el cursor; es informativo (aria-hidden):
 * el mismo texto ya está en la etiqueta accesible del marcador.
 */
export function HoverTooltip(p: Props) {
  const below = p.y < PIN_HEIGHT + 140;
  const left = Math.max(8, Math.min(p.mapWidth - WIDTH - 8, p.x - WIDTH / 2));
  const style = { left, width: WIDTH, ...(below ? { top: p.y + 12 } : { top: p.y - PIN_HEIGHT - 8, transform: "translateY(-100%)" }) };

  let body;
  if (p.kind === "vehicle") {
    const v = p.vehicle;
    const occ = vehicleOccupancy(v);
    const shade = vehicleTone(v, p.bands);
    const empty = shade === "empty";
    const tone = empty ? null : shade;
    const { label, Icon, color } = VEHICLE_META[v.kind];
    body = (
      <>
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
          <b className="flex-1 truncate text-white">{v.plate}</b>
          <span className="text-xs text-n500">{label}</span>
        </div>
        <div className="flex items-baseline justify-between text-xs text-n400">
          <span className="flex items-center gap-1"><Package className="size-3.5" aria-hidden />Paquetes</span>
          <b className="text-[13px] text-white tabular-nums">{v.load} / {v.capacity}</b>
        </div>
        <Meter value={Number.isFinite(occ) ? occ / 100 : 0} color={tone ? TONE_COLOR[tone] : PINK} label="Ocupación" />
        <div className="flex items-center justify-between text-xs text-n400">
          <span>Ocupación <b className="text-white tabular-nums">{pct(occ)}</b></span>
          <ToneBadge tone={tone} empty={empty} />
        </div>
      </>
    );
  } else if (p.kind === "stop") {
    const shown = p.orders.slice(0, STOP_MAX_ROWS);
    body = (
      <>
        <div className="flex items-baseline gap-2">
          <b className="flex-1 text-white">Parada {p.stop} · {formatCoord(p.position)}</b>
          <span className="text-xs text-n500">{p.plate}</span>
        </div>
        {shown.map(({ id, packages, order: o }) => {
          const arrival = o?.expectedDeliveryAt ?? (o?.etaMinutes != null ? `~${o.etaMinutes} min` : null);
          return (
            <div key={id} className="grid gap-0.5 border-t border-line pt-1.5 text-xs text-n400">
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-[13px] text-white">Pedido {id}</b>
                <span className="tabular-nums">{packages} paq.{o ? ` · ${o.priority}` : ""}</span>
              </div>
              {o ? (
                <>
                  <div className="flex justify-between gap-2"><span>Vence en</span><b className={o.minutesLeft < 60 ? "text-warning" : "text-white"}>{formatDuration(o.minutesLeft)}</b></div>
                  {arrival && <div className="flex justify-between gap-2"><span>Llegada estimada</span><b className="text-white tabular-nums">{arrival}</b></div>}
                </>
              ) : <span>Entregándose</span>}
            </div>
          );
        })}
        {p.orders.length > shown.length && <span className="text-xs text-n500">y {p.orders.length - shown.length} más</span>}
        <span className="text-[11px] text-n600">Pulsa para abrir {p.orders.length > 1 ? "el primero" : "el pedido"} en Pedidos</span>
      </>
    );
  } else if (p.kind === "blockage") {
    const rows: [string, string][] = [["Inicio", p.schedule.start], ["Fin", p.schedule.end], ["Duración", p.schedule.duration]];
    body = (
      <>
        <b className="text-white">Vía bloqueada</b>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between text-xs text-n400">
            <span>{k}</span>
            <b className="text-[13px] text-white tabular-nums">{v}</b>
          </div>
        ))}
      </>
    );
  } else if (p.warehouse.kind === "principal") {
    const w = p.warehouse;
    const rows: [string, string][] = [["Stock", "Ilimitado"], ...(w.vehiclesAtBase != null ? [["Vehículos en base", String(w.vehiclesAtBase)] as [string, string]] : []), ["Posición", formatCoord(w.position)]];
    body = (
      <>
        <div className="min-w-0">
          <b className="block break-words text-white">{w.name}</b>
          <span className="text-xs text-n500">Almacén central</span>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 text-xs text-n400">
            <span>{k}</span>
            <b className="text-[13px] text-white tabular-nums">{v}</b>
          </div>
        ))}
      </>
    );
  } else {
    const w = p.warehouse;
    const occ = warehouseOccupancy(w);
    body = (
      <>
        <div className="min-w-0">
          <b className="block break-words text-white">{w.name}</b>
          <span className="text-xs text-n500">Almacén intermedio</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs text-n400">
          <span>Stock actual</span>
          <b className="text-[13px] text-white tabular-nums">{w.stock ?? "—"} / {w.capacity ?? "—"}</b>
        </div>
        <Meter value={Number.isFinite(occ) ? occ / 100 : 0} color={p.tone ? TONE_COLOR[p.tone] : PINK} label="Ocupación del almacén" />
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-n400">
          <span>Ocupación <b className="text-white tabular-nums">{pct(occ)}</b></span>
          {(p.empty || p.tone) && <ToneBadge tone={p.tone} empty={p.empty} />}
        </div>
      </>
    );
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[5] grid gap-1.5 rounded-lg border border-line-strong bg-panel/95 px-3 py-2.5 text-[13px] shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
      style={style}
    >
      {body}
    </div>
  );
}
