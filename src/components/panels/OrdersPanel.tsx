"use client";

import { Building2, Clock, Crosshair, MapPin, Package, Search, UserPlus, UserRound, Users } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, RadioCardGroup, SegmentedControl } from "@/components/ui/choice";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { ErrorMessage, Field, NumberInput, SearchInput, TextInput } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { DefinitionList } from "@/components/map/EntityPopover";
import { cn } from "@/lib/cn";
import { GRID, PRIORITIES, priorityInfo } from "@/lib/constants";
import { findClient, registerOrder } from "@/lib/data/actions";
import { DOCUMENT_LABEL, documentError, kindForDocument } from "@/lib/documento";
import { formatCoord, formatDuration } from "@/lib/format";
import type { Client, Order, OrderStatus, PriorityCode } from "@/lib/types";

/**
 * `client` es el cliente registrado que corresponde a `document`; sin él no se
 * puede registrar el pedido. Dirección y destino se precargan del cliente y
 * pueden cambiarse solo para este pedido.
 */
export type OrderDraft = { document: string; client: Client | null; address: string; x: string; y: string; packages: string; priority: PriorityCode | "" };
export const EMPTY_DRAFT: OrderDraft = { document: "", client: null, address: "", x: "", y: "", packages: "", priority: "" };

/** Borrador para un cliente ya elegido; conserva paquetes y prioridad si ya se habían indicado. */
export const draftForClient = (d: OrderDraft, c: Client): OrderDraft =>
  ({ ...d, document: c.document, client: c, address: c.address, x: String(c.location.x), y: String(c.location.y) });

/** La entrega del borrador ya no es la habitual del cliente: se cambió para este pedido. */
const hasCustomDelivery = (d: OrderDraft, c: Client) =>
  d.address !== c.address || d.x !== String(c.location.x) || d.y !== String(c.location.y);

export type OrdersTab = "lista" | "nuevo";

type Errors = Partial<Record<keyof OrderDraft, string>>;

function validate(d: OrderDraft): Errors {
  const e: Errors = {};
  const required = "Completa este campo para continuar.";
  // Longitudes máximas de SolicitudPedidoOperacion en el backend.
  const text = (v: string, max: number) => (!v.trim() ? required : v.trim().length > max ? `Usa como máximo ${max} caracteres.` : undefined);
  if (!d.document) e.document = required;
  else if (d.client?.document !== d.document) e.document = "Este documento no corresponde a un cliente registrado.";
  e.address = text(d.address, 300);
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
  onDraftChange: Dispatch<SetStateAction<OrderDraft>>;
  picking: boolean;
  onTogglePick: () => void;
  onClose: () => void;
  width: number;
  /** Pestaña controlada por la pantalla; sin ella, el panel la gestiona solo. */
  tab?: OrdersTab;
  onTabChange?: (t: OrdersTab) => void;
  /** Documento sin cliente registrado: la pantalla abre el registro de clientes. */
  onRegisterClient?: (document: string) => void;
};

export function OrdersPanel({ audience, orders, selectedId, onSelect, draft, onDraftChange, picking, onTogglePick, onClose, width, tab: controlledTab, onTabChange, onRegisterClient }: OrdersPanelProps) {
  const toast = useToast();
  const canRegister = audience === "operador";
  const [ownTab, setOwnTab] = useState<OrdersTab>("lista");
  const tab = controlledTab ?? ownTab;
  const setTab = onTabChange ?? setOwnTab;
  // Un error se muestra solo mientras el campo conserve el valor que se validó
  // (así desaparece al editarlo o al elegir el destino en el mapa).
  const [checked, setChecked] = useState<{ errors: Errors; draft: OrderDraft }>({ errors: {}, draft: EMPTY_DRAFT });
  const [submitting, setSubmitting] = useState(false);
  const formMode = canRegister && tab === "nuevo";
  const errors = Object.fromEntries(
    Object.entries(checked.errors).filter(([k]) => draft[k as keyof OrderDraft] === checked.draft[k as keyof OrderDraft]),
  ) as Errors;

  const change = (patch: Partial<OrderDraft>) => onDraftChange((d) => ({ ...d, ...patch }));

  const submit = async () => {
    const e = validate(draft);
    setChecked({ errors: e, draft });
    if (Object.keys(e).length) return toast.error("Faltan algunos datos. Revisa los campos marcados.");
    const client = draft.client as Client;
    setSubmitting(true);
    const res = await registerOrder({
      clientCode: client.document,
      clientName: client.name,
      clientPhone: client.phone,
      address: draft.address.trim(),
      destination: { x: +draft.x, y: +draft.y },
      packages: +draft.packages,
      priority: draft.priority as PriorityCode,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(res.data?.orderId ? `¡Listo! El pedido ${res.data.orderId} se registró correctamente.` : "Recibimos el pedido. Aparecerá en la lista en cuanto el servidor lo registre.");
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
        <OrderForm draft={draft} errors={errors} change={change} onDraftChange={onDraftChange} picking={picking} onTogglePick={onTogglePick} onRegisterClient={onRegisterClient} />
      ) : (
        <OrdersList audience={audience} orders={orders} selectedId={selectedId} onSelect={onSelect} />
      )}
    </SidePanel>
  );
}

type Lookup = { document: string; state: "buscando" | "no_registrado" | "error"; message?: string } | null;

/** Espera tras el último dígito: con 8 dígitos aún puede estar escribiéndose un RUC. */
const LOOKUP_DELAY_MS = 350;

type OrderFormProps = {
  draft: OrderDraft;
  errors: Errors;
  change: (p: Partial<OrderDraft>) => void;
  onDraftChange: Dispatch<SetStateAction<OrderDraft>>;
  picking: boolean;
  onTogglePick: () => void;
  onRegisterClient?: (document: string) => void;
};

function OrderForm({ draft, errors, change, onDraftChange, picking, onTogglePick, onRegisterClient }: OrderFormProps) {
  const [lookup, setLookup] = useState<Lookup>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onDocument = (raw: string) => {
    const document = raw.replace(/\D/g, "").slice(0, 11);
    // Otro documento invalida el cliente elegido. Su entrega precargada se quita; una escrita a mano se conserva.
    onDraftChange((d) => {
      if (!d.client || d.client.document === document) return { ...d, document };
      const prefilled = !hasCustomDelivery(d, d.client);
      return { ...d, document, client: null, ...(prefilled ? { address: "", x: "", y: "" } : {}) };
    });
    clearTimeout(timer.current);
    const kind = kindForDocument(document);
    const invalid = kind && documentError(kind, document);
    if (!kind || invalid) return setLookup(invalid ? { document, state: "error", message: invalid } : null);
    if (draft.client?.document === document) return setLookup(null);
    setLookup({ document, state: "buscando" });
    timer.current = setTimeout(async () => {
      const res = await findClient(document);
      // Solo aplica si el documento sigue siendo el que se buscó.
      setLookup((l) => {
        if (l?.document !== document) return l;
        if (!res.ok) return { document, state: "error", message: res.message };
        return res.data ? null : { document, state: "no_registrado" };
      });
      if (res.ok && res.data) {
        const client = res.data;
        onDraftChange((d) => (d.document === document ? draftForClient(d, client) : d));
      }
    }, LOOKUP_DELAY_MS);
  };

  const client = draft.client?.document === draft.document ? draft.client : null;
  const current = lookup?.document === draft.document ? lookup : null;
  const custom = client && hasCustomDelivery(draft, client);
  return (
    <form id="order-form" noValidate onSubmit={(e) => e.preventDefault()} className="contents">
      <PanelSection title="Cliente" icon={<Users className="size-[18px]" aria-hidden />}>
        <Field
          label="DNI o RUC"
          htmlFor="o-doc"
          required
          error={errors.document && !current ? errors.document : current?.state === "error" ? current.message : undefined}
          help={current?.state === "buscando" ? "Buscando cliente…" : !client && !current ? "Escribe el documento del cliente registrado." : undefined}
        >
          <TextInput id="o-doc" inputMode="numeric" autoComplete="off" maxLength={11} value={draft.document} onChange={(e) => onDocument(e.target.value)} placeholder="8 dígitos (DNI) u 11 (RUC)" error={!!errors.document || current?.state === "error"} />
        </Field>
        {client && <ClientCard client={client} />}
        {current?.state === "no_registrado" && (
          <Alert tone="warn"icon={<UserPlus className="size-5" aria-hidden />}>
            <span className="block">No hay un cliente registrado con el {DOCUMENT_LABEL[kindForDocument(current.document) ?? "persona"]} {current.document}.</span>
            {onRegisterClient && <Button className="mt-2" size="xs" variant="outline" onClick={() => onRegisterClient(current.document)}>Registrar cliente</Button>}
          </Alert>
        )}
      </PanelSection>

      <PanelSection
        title="Entrega"
        icon={<MapPin className="size-[18px]" aria-hidden />}
        action={<Button variant="outline" size="xs" icon={<Crosshair className="size-4" aria-hidden />} onClick={onTogglePick} aria-pressed={picking}>{picking ? "Eligiendo…" : "Elegir en el mapa"}</Button>}
      >
        <Field
          label="Dirección de entrega"
          htmlFor="o-address"
          required
          error={errors.address}
          help={client ? (custom ? "Distinta de la habitual del cliente: solo aplica a este pedido." : "Precargada del cliente. Puedes cambiarla para este pedido.") : undefined}
        >
          <TextInput id="o-address" value={draft.address} onChange={(e) => change({ address: e.target.value })} placeholder="Av. Universitaria 1801" error={!!errors.address} autoComplete="street-address" />
        </Field>
        {custom && client && (
          <Button className="self-start" size="xs" variant="text" onClick={() => onDraftChange((d) => draftForClient(d, client))}>Usar la entrega habitual del cliente</Button>
        )}
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

function ClientCard({ client: c }: { client: Client }) {
  const Icon = c.kind === "empresa" ? Building2 : UserRound;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-night p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-pink" aria-hidden />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-sm font-semibold text-white" title={c.name}>{c.name}</b>
        <small className="block text-xs text-n500">{DOCUMENT_LABEL[c.kind]} {c.document} · {c.phone}{c.contact ? ` · ${c.contact}` : ""}</small>
      </div>
      <Badge tone="ok">{c.kind === "empresa" ? "Empresa" : "Persona"}</Badge>
    </div>
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
      <div className="shrink-0 overflow-hidden rounded-xl border border-line bg-night">
        <table className="w-full table-fixed text-[13px]">
          <colgroup><col style={{ width: "22%" }} /><col style={{ width: "23%" }} /><col style={{ width: "25%" }} /><col style={{ width: "30%" }} /></colgroup>
          <thead className="h-10 bg-raised text-[11px] text-n500 [&_th]:px-2 [&_th]:py-0">
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
                <td colSpan={4} style={{ height: perPage * 64 }}>
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
                    className={cn("h-16 cursor-pointer border-t border-line tabular-nums first:border-t-0 hover:bg-field [&>td]:overflow-hidden [&>td]:px-2 [&>td]:py-0 [&>td]:whitespace-nowrap", on && "bg-pink/10 [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-pink)]")}
                  >
                    <td title={`${o.id} · ${o.packages} paquetes`}><b className="block truncate text-white">{o.id}</b><span className="block truncate text-xs text-n500">{o.packages} paq.</span></td>
                    <td className="text-white" title={formatCoord(o.destination)}><span className="block truncate">{formatCoord(o.destination)}</span></td>
                    <td className="px-3 py-2.5"><Badge>{o.priority} · {priorityInfo(o.priority).hours} h</Badge></td>
                    <td className={cn("text-right", urgent ? "text-warning" : "text-white")} title={formatDuration(o.minutesLeft)}>
                      <span className="block truncate">{urgent ? `${o.minutesLeft} min` : formatDuration(o.minutesLeft)}</span>
                    </td>
                  </tr>
                );
              })
            )}
            {slice.length > 0 && Array.from({ length: perPage - slice.length }, (_, i) => <tr key={`empty-${i}`} aria-hidden className="h-16"><td colSpan={4} /></tr>)}
          </tbody>
        </table>
        <div className="flex h-12 items-center justify-between gap-1 border-t border-line bg-raised px-2 text-[11px] text-n400">
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
            <span title={`${rows.length} pedidos`}>/ {rows.length}</span>
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
