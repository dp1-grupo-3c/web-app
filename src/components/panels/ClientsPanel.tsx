"use client";

import { Building2, Crosshair, MapPin, Package, Pencil, Search, UserRound, Users } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/Button";
import { RadioCardGroup, SegmentedControl } from "@/components/ui/choice";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Field, NumberInput, SearchInput, TextInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { GRID } from "@/lib/constants";
import { registerClient, updateClient } from "@/lib/data/actions";
import { useClients } from "@/lib/data/hooks";
import { DOCUMENT_LABEL, DOCUMENT_LENGTH, documentError } from "@/lib/documento";
import { formatCoord } from "@/lib/format";
import type { Client, ClientKind } from "@/lib/types";

/** `editing`: el documento y el tipo quedan fijos; identifican al cliente en el backend. */
export type ClientDraft = {
  editing: boolean;
  kind: ClientKind | "";
  document: string;
  name: string;
  phone: string;
  contact: string;
  address: string;
  x: string;
  y: string;
};
export const EMPTY_CLIENT_DRAFT: ClientDraft = { editing: false, kind: "", document: "", name: "", phone: "", contact: "", address: "", x: "", y: "" };

export const draftFromClient = (c: Client): ClientDraft => ({
  editing: true, kind: c.kind, document: c.document, name: c.name, phone: c.phone, contact: c.contact ?? "",
  address: c.address, x: String(c.location.x), y: String(c.location.y),
});

export type ClientsTab = "lista" | "nuevo";

type Errors = Partial<Record<keyof ClientDraft, string>>;

const KIND_META: Record<ClientKind, { label: string; nameLabel: string; namePlaceholder: string; Icon: typeof UserRound }> = {
  persona: { label: "Persona natural", nameLabel: "Nombres y apellidos", namePlaceholder: "María Quispe Huamán", Icon: UserRound },
  empresa: { label: "Empresa", nameLabel: "Razón social", namePlaceholder: "Comercial Andina S.A.C.", Icon: Building2 },
};

function validate(d: ClientDraft): Errors {
  const e: Errors = {};
  const required = "Completa este campo para continuar.";
  // Longitudes máximas de ServicioClientes en el backend.
  const text = (v: string, max: number) => (!v.trim() ? required : v.trim().length > max ? `Usa como máximo ${max} caracteres.` : undefined);
  if (!d.kind) e.kind = "Elige el tipo de cliente.";
  else e.document = documentError(d.kind, d.document);
  e.name = text(d.name, 200);
  if (!d.phone.trim()) e.phone = required;
  else if (!/^[\d\s+]{7,15}$/.test(d.phone.trim())) e.phone = "Usa solo dígitos (de 7 a 15).";
  if (d.kind === "empresa" && d.contact.trim().length > 200) e.contact = "Usa como máximo 200 caracteres.";
  e.address = text(d.address, 300);
  const coord = (v: string, max: number) => (v === "" ? required : !Number.isInteger(Number(v)) || +v < 0 || +v > max ? `Debe ser un entero de 0 a ${max}.` : undefined);
  e.x = coord(d.x, GRID.width);
  e.y = coord(d.y, GRID.height);
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errors;
}

type ClientsPanelProps = {
  tab: ClientsTab;
  onTabChange: (t: ClientsTab) => void;
  draft: ClientDraft;
  onDraftChange: Dispatch<SetStateAction<ClientDraft>>;
  picking: boolean;
  onTogglePick: () => void;
  /** Tras guardar: la pantalla decide si vuelve al pedido que originó el registro. */
  onSaved: (client: Client, created: boolean) => void;
  onCreateOrder: (client: Client) => void;
  onClose: () => void;
  width: number;
};

export function ClientsPanel({ tab, onTabChange, draft, onDraftChange, picking, onTogglePick, onSaved, onCreateOrder, onClose, width }: ClientsPanelProps) {
  const toast = useToast();
  const { clients, loaded } = useClients();
  const [checked, setChecked] = useState<{ errors: Errors; draft: ClientDraft }>({ errors: {}, draft: EMPTY_CLIENT_DRAFT });
  const [submitting, setSubmitting] = useState(false);
  const errors = Object.fromEntries(
    Object.entries(checked.errors).filter(([k]) => draft[k as keyof ClientDraft] === checked.draft[k as keyof ClientDraft]),
  ) as Errors;

  const change = (patch: Partial<ClientDraft>) => onDraftChange((d) => ({ ...d, ...patch }));
  const reset = () => { onDraftChange(EMPTY_CLIENT_DRAFT); setChecked({ errors: {}, draft: EMPTY_CLIENT_DRAFT }); };

  const submit = async () => {
    const e = validate(draft);
    setChecked({ errors: e, draft });
    if (Object.keys(e).length) return toast.error("Faltan algunos datos. Revisa los campos marcados.");
    const kind = draft.kind as ClientKind;
    const client: Client = {
      kind,
      document: draft.document,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      contact: kind === "empresa" && draft.contact.trim() ? draft.contact.trim() : undefined,
      address: draft.address.trim(),
      location: { x: +draft.x, y: +draft.y },
    };
    setSubmitting(true);
    const res = await (draft.editing ? updateClient : registerClient)(client);
    setSubmitting(false);
    if (!res.ok || !res.data) return toast.error(res.ok ? "No se pudo guardar el cliente." : res.message);
    toast.success(draft.editing ? `Actualizamos los datos de ${res.data.name}.` : `¡Listo! ${res.data.name} quedó registrado con ${DOCUMENT_LABEL[kind]} ${res.data.document}.`);
    reset();
    onTabChange("lista");
    onSaved(res.data, !draft.editing);
  };

  const formMode = tab === "nuevo";
  return (
    <SidePanel
      title="Clientes"
      subtitle="Registra personas naturales y empresas para sus pedidos."
      onClose={onClose}
      width={width}
      footer={formMode && (
        <>
          <Button variant="text" onClick={() => { reset(); if (draft.editing) onTabChange("lista"); }}>{draft.editing ? "Cancelar" : "Limpiar"}</Button>
          <Button className="flex-1" onClick={submit} loading={submitting} loadingText="Guardando…">{draft.editing ? "Guardar cambios" : "Registrar cliente"}</Button>
        </>
      )}
    >
      <SegmentedControl
        label="Vista de clientes"
        value={tab}
        onChange={onTabChange}
        options={[{ value: "lista", label: "Registrados", count: clients.length }, { value: "nuevo", label: draft.editing ? "Editar cliente" : "Registrar cliente" }]}
      />
      {formMode ? (
        <ClientForm draft={draft} errors={errors} change={change} picking={picking} onTogglePick={onTogglePick} />
      ) : (
        <ClientsList
          clients={clients}
          loaded={loaded}
          onEdit={(c) => { setChecked({ errors: {}, draft: EMPTY_CLIENT_DRAFT }); onDraftChange(draftFromClient(c)); onTabChange("nuevo"); }}
          onCreateOrder={onCreateOrder}
        />
      )}
    </SidePanel>
  );
}

function ClientForm({ draft, errors, change, picking, onTogglePick }: { draft: ClientDraft; errors: Errors; change: (p: Partial<ClientDraft>) => void; picking: boolean; onTogglePick: () => void }) {
  const kind = draft.kind || null;
  const meta = kind ? KIND_META[kind] : null;
  return (
    <form id="client-form" noValidate onSubmit={(e) => e.preventDefault()} className="contents">
      <PanelSection title="Tipo de cliente" icon={<Users className="size-[18px]" aria-hidden />}>
        {draft.editing && kind ? (
          <p className="text-sm text-n300">{KIND_META[kind].label} · {DOCUMENT_LABEL[kind]} {draft.document}. El tipo y el documento no se pueden cambiar.</p>
        ) : (
          <Field label="Tipo" required error={errors.kind}>
            <RadioCardGroup
              name="c-kind"
              label="Tipo de cliente"
              invalid={!!errors.kind}
              value={draft.kind}
              // Al cambiar de tipo, un documento de la longitud del otro ya no aplica.
              onChange={(k) => change({ kind: k, document: draft.document.slice(0, DOCUMENT_LENGTH[k]), contact: k === "empresa" ? draft.contact : "" })}
              options={[
                { value: "persona", title: "Persona natural", description: "Se identifica con DNI (8 dígitos)." },
                { value: "empresa", title: "Empresa", description: "Se identifica con RUC (11 dígitos, empieza con 10 o 20)." },
              ]}
            />
          </Field>
        )}
      </PanelSection>

      {kind && meta && (
        <>
          <PanelSection title="Datos del cliente" icon={<meta.Icon className="size-[18px]" aria-hidden />}>
            {!draft.editing && (
              <Field label={DOCUMENT_LABEL[kind]} htmlFor="c-doc" required error={errors.document}>
                <TextInput
                  id="c-doc"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={DOCUMENT_LENGTH[kind]}
                  value={draft.document}
                  onChange={(e) => change({ document: e.target.value.replace(/\D/g, "").slice(0, DOCUMENT_LENGTH[kind]) })}
                  placeholder={kind === "persona" ? "45678912" : "20600000005"}
                  error={!!errors.document}
                />
              </Field>
            )}
            <Field label={meta.nameLabel} htmlFor="c-name" required error={errors.name}>
              <TextInput id="c-name" value={draft.name} onChange={(e) => change({ name: e.target.value })} placeholder={meta.namePlaceholder} error={!!errors.name} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono" htmlFor="c-phone" required error={errors.phone}>
                <TextInput id="c-phone" type="tel" value={draft.phone} onChange={(e) => change({ phone: e.target.value })} placeholder="987 654 321" error={!!errors.phone} />
              </Field>
              {kind === "empresa" && (
                <Field label="Contacto" htmlFor="c-contact" error={errors.contact}>
                  <TextInput id="c-contact" value={draft.contact} onChange={(e) => change({ contact: e.target.value })} placeholder="Opcional" error={!!errors.contact} />
                </Field>
              )}
            </div>
          </PanelSection>

          <PanelSection
            title="Entrega habitual"
            icon={<MapPin className="size-[18px]" aria-hidden />}
            action={<Button variant="outline" size="xs" icon={<Crosshair className="size-4" aria-hidden />} onClick={onTogglePick} aria-pressed={picking}>{picking ? "Eligiendo…" : "Elegir en el mapa"}</Button>}
          >
            <Field label="Dirección" htmlFor="c-address" required error={errors.address}>
              <TextInput id="c-address" value={draft.address} onChange={(e) => change({ address: e.target.value })} placeholder="Av. Universitaria 1801" error={!!errors.address} autoComplete="street-address" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Coordenada X" htmlFor="c-x" required error={errors.x}>
                <NumberInput id="c-x" value={draft.x} onValueChange={(x) => change({ x })} min={0} max={GRID.width} placeholder={`0 – ${GRID.width}`} error={!!errors.x} />
              </Field>
              <Field label="Coordenada Y" htmlFor="c-y" required error={errors.y}>
                <NumberInput id="c-y" value={draft.y} onValueChange={(y) => change({ y })} min={0} max={GRID.height} placeholder={`0 – ${GRID.height}`} error={!!errors.y} />
              </Field>
            </div>
            <p className="text-xs leading-snug text-n600">Se precarga en cada pedido del cliente y puede cambiarse al registrarlo.</p>
          </PanelSection>
        </>
      )}
    </form>
  );
}

function ClientsList({ clients, loaded, onEdit, onCreateOrder }: { clients: Client[]; loaded: boolean; onEdit: (c: Client) => void; onCreateOrder: (c: Client) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = clients.filter((c) => !q || c.document.startsWith(q) || c.name.toLowerCase().includes(q));

  if (clients.length === 0)
    return (
      <EmptyState icon={<Users className="size-8" aria-hidden />} title={loaded ? "Aún no hay clientes registrados" : "Cargando clientes…"}>
        {loaded && "Registra personas naturales con su DNI o empresas con su RUC para tomar sus pedidos."}
      </EmptyState>
    );

  return (
    <>
      <SearchInput value={query} onChange={setQuery} label="Buscar cliente" placeholder="Buscar por DNI, RUC o nombre" />
      {rows.length === 0 ? (
        <EmptyState icon={<Search className="size-7" aria-hidden />} title={`No encontramos clientes con “${query}”.`}>Revisa el documento o el nombre.</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {rows.map((c) => {
            const { Icon, label } = KIND_META[c.kind];
            return (
              <li key={c.document} className="grid gap-2 rounded-xl border border-line bg-night p-3">
                <div className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 size-5 shrink-0 text-pink" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-semibold text-white" title={c.name}>{c.name}</b>
                    <small className="block text-xs text-n500">{DOCUMENT_LABEL[c.kind]} {c.document} · {c.phone}{c.contact ? ` · ${c.contact}` : ""}</small>
                  </div>
                  <Badge>{label}</Badge>
                </div>
                <p className="truncate text-xs text-n400" title={c.address}><MapPin className="mr-1 inline size-3.5" aria-hidden />{c.address} · {formatCoord(c.location)}</p>
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" icon={<Package className="size-3.5" aria-hidden />} onClick={() => onCreateOrder(c)}>Nuevo pedido</Button>
                  <Button size="xs" variant="text" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => onEdit(c)}>Editar</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
