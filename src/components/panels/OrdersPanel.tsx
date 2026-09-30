"use client";

import { Clock, Crosshair, MapPin, Package, Search, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, RadioCardGroup, SegmentedControl } from "@/components/ui/choice";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { ErrorMessage, Field, NumberInput, SearchInput, TextInput } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { DefinitionList } from "@/components/map/EntityPopover";
import { cn } from "@/lib/cn";
import { GRID, PRIORITIES, priorityInfo } from "@/lib/constants";
import { registerOrder } from "@/lib/data/actions";
import { formatCoord, formatDuration } from "@/lib/format";
import type { Order, OrderStatus, PriorityCode } from "@/lib/types";

export type OrderDraft = { clientCode: string; clientPhone: string; clientName: string; x: string; y: string; packages: string; priority: PriorityCode | "" };
export const EMPTY_DRAFT: OrderDraft = { clientCode: "", clientPhone: "", clientName: "", x: "", y: "", packages: "", priority: "" };

type Errors = Partial<Record<keyof OrderDraft, string>>;

function validate(d: OrderDraft): Errors {
  const e: Errors = {};
  const required = "Completa este campo para continuar.";
  if (!d.clientCode.trim()) e.clientCode = required;
  if (!d.clientName.trim()) e.clientName = required;
  if (!d.clientPhone.trim()) e.clientPhone = required;
  else if (!/^[\d\s+]{7,15}$/.test(d.clientPhone.trim())) e.clientPhone = "Usa solo dígitos (de 7 a 15).";
  const coord = (v: string, max: number) => (v === "" ? required : !Number.isInteger(Number(v)) || +v < 0 || +v > max ? `Debe ser un entero de 0 a ${max}.` : undefined);
  e.x = coord(d.x, GRID.width);
  e.y = coord(d.y, GRID.height);
  if (d.packages === "") e.packages = required;
  else if (!Number.isInteger(+d.packages) || +d.packages < 1) e.packages = "Debe ser un número entero mayor que 0.";
  if (!d.priority) e.priority = "Elige una prioridad.";
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errors;
}

const STATUS: Record<OrderStatus, { label: string; tone: "ok" | "warn" | "neutral" }> = {
  por_asignar: { label: "Por asignar", tone: "warn" },
  en_almacen: { label: "En almacén", tone: "neutral" },
  en_ruta: { label: "En ruta", tone: "ok" },
  entregado: { label: "Entregado", tone: "ok" },
};

type OrdersPanelProps = {
  audience: "operador" | "cliente" | "simulacion";
  orders: Order[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  draft: OrderDraft;
  onDraftChange: (d: OrderDraft) => void;
  picking: boolean;
  onTogglePick: () => void;
  onClose: () => void;
  width: number;
};

export function OrdersPanel({ audience, orders, selectedId, onSelect, draft, onDraftChange, picking, onTogglePick, onClose, width }: OrdersPanelProps) {
  const toast = useToast();
  const canRegister = audience === "operador";
  const [tab, setTab] = useState<"lista" | "nuevo">("lista");
  // Un error se muestra solo mientras el campo conserve el valor que se validó
  // (así desaparece al editarlo o al elegir el destino en el mapa).
  const [checked, setChecked] = useState<{ errors: Errors; draft: OrderDraft }>({ errors: {}, draft: EMPTY_DRAFT });
  const [submitting, setSubmitting] = useState(false);
  const formMode = canRegister && tab === "nuevo";
  const errors = Object.fromEntries(
    Object.entries(checked.errors).filter(([k]) => draft[k as keyof OrderDraft] === checked.draft[k as keyof OrderDraft]),
  ) as Errors;

  const change = (patch: Partial<OrderDraft>) => onDraftChange({ ...draft, ...patch });

  const submit = async () => {
    const e = validate(draft);
    setChecked({ errors: e, draft });
    if (Object.keys(e).length) return toast.error("Faltan algunos datos. Revisa los campos marcados.");
    setSubmitting(true);
    const res = await registerOrder({
      clientCode: draft.clientCode.trim(),
      clientName: draft.clientName.trim(),
      clientPhone: draft.clientPhone.trim(),
      destination: { x: +draft.x, y: +draft.y },
      packages: +draft.packages,
      priority: draft.priority as PriorityCode,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(res.data?.orderId ? `¡Listo! El pedido ${res.data.orderId} se registró correctamente.` : "¡Listo! Registramos el pedido correctamente.");
    onDraftChange(EMPTY_DRAFT);
    setTab("lista");
  };

  return (
    <SidePanel
      title="Pedidos"
      subtitle={audience === "cliente" ? "Encuentra tu pedido y mira dónde está." : canRegister ? "Registra y sigue los pedidos activos." : "Pedidos activos de la simulación."}
      onClose={onClose}
      width={width}
      footer={formMode && (
        <>
          <Button variant="text" onClick={() => { onDraftChange(EMPTY_DRAFT); setChecked({ errors: {}, draft: EMPTY_DRAFT }); }}>Limpiar</Button>
          <Button className="flex-1" onClick={submit} loading={submitting} loadingText="Registrando…">Registrar pedido</Button>
        </>
      )}
    >
      {canRegister && (
        <SegmentedControl
          label="Vista de pedidos"
          value={tab}
          onChange={setTab}
          options={[{ value: "lista", label: "Activos", count: orders.length }, { value: "nuevo", label: "Registrar pedido" }]}
        />
      )}
      {formMode ? (
        <OrderForm draft={draft} errors={errors} change={change} picking={picking} onTogglePick={onTogglePick} />
      ) : (
        <OrdersList audience={audience} orders={orders} selectedId={selectedId} onSelect={onSelect} />
      )}
    </SidePanel>
  );
}

function OrderForm({ draft, errors, change, picking, onTogglePick }: { draft: OrderDraft; errors: Errors; change: (p: Partial<OrderDraft>) => void; picking: boolean; onTogglePick: () => void }) {
  return (
    <form id="order-form" noValidate onSubmit={(e) => e.preventDefault()} className="contents">
      <PanelSection title="Cliente" icon={<Users className="size-[18px]" aria-hidden />}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" htmlFor="o-code" required error={errors.clientCode}>
            <TextInput id="o-code" value={draft.clientCode} onChange={(e) => change({ clientCode: e.target.value })} placeholder="CLI-00231" error={!!errors.clientCode} autoComplete="off" />
          </Field>
          <Field label="Teléfono" htmlFor="o-phone" required error={errors.clientPhone}>
            <TextInput id="o-phone" type="tel" value={draft.clientPhone} onChange={(e) => change({ clientPhone: e.target.value })} placeholder="987 654 321" error={!!errors.clientPhone} />
          </Field>
        </div>
        <Field label="Nombre completo" htmlFor="o-name" required error={errors.clientName}>
          <TextInput id="o-name" value={draft.clientName} onChange={(e) => change({ clientName: e.target.value })} placeholder="María Quispe" error={!!errors.clientName} />
        </Field>
      </PanelSection>

      <PanelSection
        title="Destino en la retícula"
        icon={<MapPin className="size-[18px]" aria-hidden />}
        action={<Button variant="outline" size="xs" icon={<Crosshair className="size-4" aria-hidden />} onClick={onTogglePick} aria-pressed={picking}>{picking ? "Eligiendo…" : "Elegir en el mapa"}</Button>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Coordenada X" htmlFor="o-x" required error={errors.x}>
            <NumberInput id="o-x" value={draft.x} onValueChange={(x) => change({ x })} min={0} max={GRID.width} placeholder={`0 – ${GRID.width}`} error={!!errors.x} />
          </Field>
          <Field label="Coordenada Y" htmlFor="o-y" required error={errors.y}>
            <NumberInput id="o-y" value={draft.y} onValueChange={(y) => change({ y })} min={0} max={GRID.height} placeholder={`0 – ${GRID.height}`} error={!!errors.y} />
          </Field>
        </div>
        <p className="text-xs leading-snug text-n600">Cualquier intersección de la retícula es un destino válido: X de 0 a {GRID.width} y Y de 0 a {GRID.height}.</p>
      </PanelSection>

      <PanelSection title="Pedido" icon={<Package className="size-[18px]" aria-hidden />}>
        <Field label="Cantidad de paquetes" htmlFor="o-pk" required error={errors.packages}>
          <NumberInput id="o-pk" value={draft.packages} onValueChange={(packages) => change({ packages })} min={1} placeholder="Ej. 12" error={!!errors.packages} />
        </Field>
        <Field label="Prioridad" required>
          <RadioCardGroup
            name="o-priority"
            label="Prioridad"
            compact
            invalid={!!errors.priority}
            value={draft.priority}
            onChange={(priority) => change({ priority })}
            options={PRIORITIES.map((p) => ({ value: p.code, title: p.code, description: `${p.hours} h`, hint: `${p.name} · ${p.hours} h` }))}
          />
          {errors.priority ? <ErrorMessage>{errors.priority}</ErrorMessage> : <p className="text-xs text-n600">P1 es la más urgente (4 h de plazo). Normal tiene 36 h.</p>}
        </Field>
      </PanelSection>
    </form>
  );
}

const PAGE_SIZES = [6, 10, 15];

function OrdersList({ audience, orders, selectedId, onSelect }: { audience: OrdersPanelProps["audience"]; orders: Order[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PAGE_SIZES[0]);
  const client = audience === "cliente";

  const q = query.trim().toLowerCase().replace(/[()\s]/g, "");
  const rows = orders
    .filter((o) => !urgentOnly || o.minutesLeft < 60)
    .filter((o) => !q || o.id.toLowerCase().includes(q) || `${o.destination.x},${o.destination.y}`.startsWith(q));
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pageCount);
  const slice = rows.slice((current - 1) * perPage, current * perPage);
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  if (orders.length === 0)
    return (
      <EmptyState icon={<Package className="size-8" aria-hidden />} title={client ? "Todavía no vemos pedidos" : "Aún no hay pedidos activos"}>
        {client ? "Cuando tu pedido esté en camino, podrás buscarlo aquí por su número." : "Aparecerán aquí en cuanto el servidor los envíe."}
      </EmptyState>
    );

  return (
    <>
      <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} label="Buscar pedido" placeholder={client ? "Número de pedido" : "Buscar por pedido o coordenada (x, y)"} />
      {!client && (
        <div className="flex gap-1.5">
          <Chip on={!urgentOnly} onClick={() => { setUrgentOnly(false); setPage(1); }}>Todos</Chip>
          <Chip on={urgentOnly} onClick={() => { setUrgentOnly(true); setPage(1); }}><Clock className="size-3.5 text-warning" aria-hidden />Vencen en menos de 1 h</Chip>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-line bg-night">
        <table className="w-full text-sm">
          <thead className="bg-raised text-xs text-n500">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Pedido</th>
              <th className="px-3 py-2.5 text-left font-medium">Destino</th>
              <th className="px-3 py-2.5 text-left font-medium">Prioridad</th>
              <th className="px-3 py-2.5 text-right font-medium">Vence en</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={<Search className="size-7" aria-hidden />} title={`No encontramos pedidos con “${query}”.`}>Revisa el número e inténtalo nuevamente.</EmptyState>
                </td>
              </tr>
            ) : (
              slice.map((o) => {
                const on = o.id === selectedId;
                const urgent = o.minutesLeft < 60;
                return (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => onSelect(on ? null : o.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(on ? null : o.id))}
                    className={cn("cursor-pointer border-t border-line tabular-nums first:border-t-0 hover:bg-field", on && "bg-pink/10 [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-pink)]")}
                  >
                    <td className="px-3 py-2.5"><b className="text-white">{o.id}</b><span className="block text-xs text-n500">{o.packages} paquetes</span></td>
                    <td className="px-3 py-2.5 text-white">{formatCoord(o.destination)}</td>
                    <td className="px-3 py-2.5"><Badge>{o.priority} · {priorityInfo(o.priority).hours} h</Badge></td>
                    <td className={cn("px-3 py-2.5 text-right", urgent ? "text-warning" : "text-white")}>
                      {urgent ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{o.minutesLeft} min</span> : formatDuration(o.minutesLeft)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between gap-2 border-t border-line bg-raised px-3 py-2 text-xs text-n400">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            Filas
            <select
              aria-label="Filas por página"
              value={perPage}
              onChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
              className="h-7 rounded-md border border-line-strong bg-field px-1 text-xs text-white"
            >
              {PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}
            </select>
            de {rows.length}
          </span>
          <Pagination page={current} pageCount={pageCount} onChange={setPage} />
        </div>
      </div>
      {selected && <OrderDetail order={selected} />}
    </>
  );
}

function OrderDetail({ order: o }: { order: Order }) {
  const st = STATUS[o.status];
  const p = priorityInfo(o.priority);
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-night p-4">
      <div className="flex items-center gap-2.5">
        <b className="flex-1 text-base text-white">Pedido {o.id}</b>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <DefinitionList
        items={[
          ...(o.etaMinutes != null ? ([["Llegada estimada", `~${o.etaMinutes} min`]] as [string, string][]) : []),
          ["Vence en", formatDuration(o.minutesLeft)],
          ["Destino", formatCoord(o.destination)],
          ["Prioridad", `${p.name} · ${p.hours} h`],
          ["Paquetes", o.packages],
          ["Vehículo", o.vehiclePlate ?? "Por asignar"],
        ]}
      />
      <p className="flex items-center gap-1.5 text-xs text-n600"><MapPin className="size-3.5" aria-hidden /> Lo marcamos en el mapa con un indicador rosado.</p>
    </div>
  );
}
