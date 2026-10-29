import { CircleX, House, Package, TriangleAlert, Utensils, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Meter, Tile, Alert } from "@/components/ui/feedback";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { TONE_COLOR, TONE_LABEL, breakdownInfo } from "@/lib/constants";
import { formatCoord } from "@/lib/format";
import type { Blockage, TrafficLight, Vehicle, Warehouse } from "@/lib/types";
import { PINK, VEHICLE_STATUS_LABEL, vehicleAppearance, warehouseAppearance } from "./layers";

export const POPOVER_WIDTH = 320;

type Anchor = { x: number; y: number; above: boolean; left: number };

function Shell({ anchor, head, children, onClose, mapHeight, docked = false }: { anchor: Anchor; head: ReactNode; children: ReactNode; onClose: () => void; mapHeight: number; docked?: boolean }) {
  return (
    <div
      role="dialog"
      aria-label="Detalle"
      className="absolute z-[5] rounded-[14px] border border-line-strong bg-panel text-[13px] shadow-[0_16px_36px_rgb(0_0_0/0.5)]"
      style={{ width: POPOVER_WIDTH, ...(docked ? { right: 16, top: 16 } : { left: anchor.left, ...(anchor.above ? { bottom: mapHeight - anchor.y + 48 } : { top: anchor.y + 14 }) }) }}
    >
      <div className="flex items-center gap-3 py-3 pr-2.5 pl-3.5">
        {head}
        <IconButton label="Cerrar" size="sm" onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      <div className="grid gap-2.5 px-3.5 pb-3.5 text-n50">{children}</div>
      {!docked && <span
        aria-hidden
        className={cn("absolute -ml-2 size-3.5 rotate-45 border-line-strong bg-panel", anchor.above ? "-bottom-2 border-r border-b" : "-top-2 border-t border-l")}
        style={{ left: anchor.x - anchor.left }}
      />}
    </div>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-w-0 flex-1">
      <b className="block text-[15px] leading-tight text-white">{title}</b>
      <small className="block text-xs text-n500">{subtitle}</small>
    </div>
  );
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-n500">{k}</dt>
          <dd className="text-right text-white tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function MeterRow({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-n400">
        <span>{label}</span>
        <b className="text-[13px] text-white tabular-nums">{value} / {max} {unit}</b>
      </div>
      <Meter value={max ? value / max : 0} color={color} label={label} />
    </div>
  );
}

export function VehiclePopover({ vehicle: v, anchor, onClose, mapHeight, docked = false }: { vehicle: Vehicle; anchor: Anchor; onClose: () => void; mapHeight: number; docked?: boolean }) {
  const { color, Icon, meta } = vehicleAppearance(v);
  const broken = v.status === "averiado";
  const dest = v.destination;
  const feeding = v.status === "en_alimentacion";
  return (
    <Shell
      anchor={anchor}
      onClose={onClose}
      mapHeight={mapHeight}
      docked={docked}
      head={
        <>
          <Tile color={color}><Icon className="size-5" aria-hidden /></Tile>
          <Title title={v.plate} subtitle={meta.label} />
          {broken ? <Badge tone="crit"><TriangleAlert className="size-3" aria-hidden /> Averiado</Badge> : <Badge tone={feeding ? "warn" : v.status === "en_ruta" ? "ok" : "neutral"}>{feeding && <Utensils className="size-3" aria-hidden />}{feeding ? "Alimentación" : VEHICLE_STATUS_LABEL[v.status]}</Badge>}
        </>
      }
    >
      {feeding && <Alert tone="warn" className="text-[13px]">Pausa de alimentación. El vehículo está detenido y conserva su ruta pendiente.</Alert>}
      {broken && (
        <Alert tone="crit" className="text-[13px]">
          <b>Avería {v.breakdownType ? `${v.breakdownType} · ${breakdownInfo(v.breakdownType).name}` : ""}.</b> Sus {v.orders.length} pedidos se reasignarán a otros vehículos.
        </Alert>
      )}
      <DefinitionList
        items={[
          ["Posición", formatCoord(v.position)],
          ...(dest && !broken ? ([["Destino", formatCoord(dest)]] as [string, ReactNode][]) : []),
          ...(v.etaMinutes != null && !broken ? ([["Llegada estimada", `${v.etaMinutes} min`]] as [string, ReactNode][]) : []),
        ]}
      />
      <MeterRow label="Carga a bordo" value={v.load} max={v.capacity} color={PINK} unit="paquetes" />
      {v.orders.length > 0 && (
        <div className="max-h-[120px] overflow-auto rounded-[10px] border border-line">
          <table className="w-full text-xs">
            <caption className="border-b border-line bg-raised px-2 py-2 text-left font-semibold text-white">Pedidos asignados</caption>
            <thead>
              <tr className="sticky top-0 bg-raised text-[11px] text-n500">
                <th className="px-2 py-1.5 text-left font-medium">Pedido</th>
                <th className="px-2 py-1.5 text-right font-medium">Paquetes asignados</th>
                <th className="px-2 py-1.5 text-right font-medium">Total del pedido</th>
              </tr>
            </thead>
            <tbody>
              {v.orders.map((o) => (
                <tr key={o.orderId} className="border-t border-line tabular-nums">
                  <td className="px-2 py-1.5">{o.orderId}</td>
                  <td className="px-2 py-1.5 text-right">{o.packagesInVehicle}</td>
                  <td className="px-2 py-1.5 text-right">{o.packagesTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

export function WarehousePopover({ warehouse: w, trafficLight, neutral, anchor, onClose, mapHeight, vehicles = [], onSelectVehicle }: { warehouse: Warehouse; trafficLight: TrafficLight; neutral: boolean; anchor: Anchor; onClose: () => void; mapHeight: number; vehicles?: Vehicle[]; onSelectVehicle?: (id: string) => void }) {
  const { color, tone } = warehouseAppearance(w, trafficLight, neutral);
  const principal = w.kind === "principal";
  return (
    <Shell
      anchor={anchor}
      onClose={onClose}
      mapHeight={mapHeight}
      head={
        <>
          <Tile color={color}>{principal ? <House className="size-5" aria-hidden /> : <Package className="size-5" aria-hidden />}</Tile>
          <Title title={w.name} subtitle={principal ? "Base de la flota" : "Almacén secundario"} />
          {tone && <Badge tone={tone}>{TONE_LABEL[tone]}</Badge>}
        </>
      }
    >
      {!principal && w.stock != null && w.capacity != null && !neutral && (
        <MeterRow label="Ocupación" value={w.stock} max={w.capacity} color={tone ? TONE_COLOR[tone] : PINK} unit="paquetes" />
      )}
      <DefinitionList
        items={[
          ["Posición", formatCoord(w.position)],
          ...(principal && w.vehiclesAtBase != null ? ([["Vehículos en base", w.vehiclesAtBase]] as [string, ReactNode][]) : []),
          ...(!principal && w.capacity != null ? ([["Capacidad", `${w.capacity} paquetes`]] as [string, ReactNode][]) : []),
        ]}
      />
      {neutral && !principal && <p className="text-xs text-n600">El semáforo se activa al comenzar la simulación.</p>}
      {!neutral && vehicles.length > 0 && <div className="max-h-40 overflow-auto rounded-lg border border-line" aria-label="Vehículos en el almacén">
        {vehicles.map((v) => <button key={v.id} type="button" onClick={() => onSelectVehicle?.(v.id)} className="flex w-full items-center justify-between gap-2 border-b border-line px-2 py-2 text-left last:border-0 hover:bg-raised">
          <span>{v.plate}</span><span className="flex items-center gap-1 text-xs" style={{ color: v.status === "en_alimentacion" ? "var(--color-warning)" : undefined }}>{v.status === "en_alimentacion" && <Utensils className="size-3" aria-hidden />}{VEHICLE_STATUS_LABEL[v.status]}</span>
        </button>)}
      </div>}
    </Shell>
  );
}

export function BlockagePopover({ blockage: b, endsIn, anchor, onClose, mapHeight }: { blockage: Blockage; endsIn?: number | null; anchor: Anchor; onClose: () => void; mapHeight: number }) {
  return (
    <Shell
      anchor={anchor}
      onClose={onClose}
      mapHeight={mapHeight}
      head={
        <>
          <Tile color="var(--color-critic)"><CircleX className="size-5" aria-hidden /></Tile>
          <Title title="Vía bloqueada" subtitle={endsIn != null ? `Se libera pronto: en ~${endsIn} min simulados` : "Los vehículos la evitan"} />
        </>
      }
    >
      <DefinitionList
        items={[
          ["Tramo", `${formatCoord(b.from)} → ${formatCoord(b.to)}`],
          ...(b.until ? ([["Bloqueada hasta", b.until]] as [string, ReactNode][]) : []),
        ]}
      />
    </Shell>
  );
}
