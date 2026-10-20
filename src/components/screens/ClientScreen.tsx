"use client";

import { ArrowRight, Clock, FlaskConical, Package, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AccessHeading, AccessShell } from "@/components/access/AccessShell";
import { Button } from "@/components/ui/Button";
import { Alert, Badge, EmptyState, type BadgeTone } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { priorityInfo } from "@/lib/constants";
import { useClientDemoOrders } from "@/lib/data/hooks";
import { formatCoord, formatDuration } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const KEY = "kindbox.cliente.id";
const VALID_ID = /^[\w-]{1,24}$/;

const STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  por_asignar: { label: "Por asignar", tone: "warn" },
  en_almacen: { label: "En almacén", tone: "neutral" },
  en_ruta: { label: "En camino", tone: "pink" },
  entregado: { label: "Entregado", tone: "ok" },
};

/**
 * Vista del cliente: primero pide su ID y luego lista sus pedidos con el estado
 * actual. SIMULADA mientras el backend no filtre pedidos por cliente: la lista
 * son 10 pedidos al azar de la corrida en curso (ver useClientDemoOrders).
 */
export function ClientScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const clientId = params.get("id")?.trim() ?? "";
  const valid = VALID_ID.test(clientId);
  const go = (id: string | null) => router.replace(id ? `${pathname}?${new URLSearchParams({ id })}` : pathname, { scroll: false });

  return (
    <AccessShell headerExtra={valid && <Badge><UserRound className="size-3.5" aria-hidden /> Cliente {clientId}</Badge>}>
      <nav aria-label="Ruta de navegación" className="mb-5 flex items-center gap-2 text-sm text-n500">
        <Link href="/" className="text-n300 hover:text-pink hover:underline">Inicio</Link>
        <span aria-hidden>›</span>
        <span aria-current="page" className="text-white">Mis pedidos</span>
      </nav>
      {valid ? <ClientOrders clientId={clientId} onChangeId={() => go(null)} /> : <ClientIdForm onSubmit={(id) => { remember(id); go(id); }} />}
    </AccessShell>
  );
}

function remember(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* sin almacenamiento */ }
}

function ClientIdForm({ onSubmit }: { onSubmit: (id: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
      setValue(localStorage.getItem(KEY) ?? "");
    } catch { /* sin almacenamiento */ }
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim();
    if (!id) return setError("Escribe tu número de cliente para continuar.");
    if (!VALID_ID.test(id)) return setError("Usa solo letras, números o guiones (hasta 24 caracteres).");
    onSubmit(id);
  };
  return (
    <>
      <AccessHeading eyebrow="Mis pedidos" title="¿Cuál es tu número de cliente?" subtitle="Lo encuentras en el mensaje de confirmación de tu pedido. Con él te mostramos todos tus pedidos y en qué estado están." />
      <form noValidate onSubmit={submit} className="mt-10 flex max-w-[520px] flex-col gap-5 rounded-2xl border border-line bg-panel p-6">
        <Field label="Número de cliente" htmlFor="client-id" required error={error}>
          <TextInput id="client-id" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} placeholder="Ej. CLI-00231" autoComplete="off" autoFocus error={!!error} />
        </Field>
        <Button type="submit" block>Ver mis pedidos <ArrowRight className="size-[18px]" aria-hidden /></Button>
      </form>
    </>
  );
}

function ClientOrders({ clientId, onChangeId }: { clientId: string; onChangeId: () => void }) {
  const { orders, running, loading } = useClientDemoOrders(clientId);
  const delivered = orders.filter((o) => o.status === "entregado").length;
  return (
    <>
      <div className="flex max-w-[960px] flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <AccessHeading eyebrow={`Cliente ${clientId}`} title="Tus pedidos" subtitle="El estado se actualiza solo cada pocos segundos." />
        </div>
        <Button variant="outline" size="sm" onClick={onChangeId}>Cambiar número de cliente</Button>
      </div>
      <Alert icon={<FlaskConical className="size-5" aria-hidden />} className="mt-8 max-w-[960px]">
        <b>Vista de demostración.</b> Mientras terminamos el seguimiento por cliente, mostramos 10 pedidos tomados al azar de la simulación en curso.
      </Alert>
      <div className="mt-5 max-w-[960px] overflow-hidden rounded-xl border border-line bg-panel">
        {orders.length === 0 ? (
          <EmptyState icon={<Package className="size-8" aria-hidden />} title={loading ? "Buscando tus pedidos…" : running ? "Todavía no hay pedidos" : "No hay una simulación en curso"} className="py-12">
            {loading ? "Un momento, por favor." : running ? "Aparecerán aquí en cuanto la simulación registre los primeros." : "Inicia una simulación desde Operaciones para ver pedidos de ejemplo."}
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="border-b border-line bg-raised px-4 py-3 text-left text-xs text-n400">
              {orders.length} pedidos · {delivered} entregados
            </caption>
            <thead className="bg-raised text-xs text-n500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Pedido</th>
                <th className="px-4 py-2.5 text-left font-medium">Destino</th>
                <th className="px-4 py-2.5 text-left font-medium">Prioridad</th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Vence en</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = STATUS[o.status];
                const done = o.status === "entregado";
                const late = !done && o.minutesLeft < 0;
                const urgent = !done && !late && o.minutesLeft < 60;
                return (
                  <tr key={o.id} className="border-t border-line tabular-nums">
                    <td className="px-4 py-3"><b className="text-white">{o.id}</b><span className="block text-xs text-n500">{o.packages} paquetes</span></td>
                    <td className="px-4 py-3 text-white">{formatCoord(o.destination)}</td>
                    <td className="px-4 py-3"><Badge>{o.priority} · {priorityInfo(o.priority).hours} h</Badge></td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {o.vehiclePlate && !done && <span className="mt-1 block text-xs text-n500">Vehículo {o.vehiclePlate}</span>}
                    </td>
                    <td className={cn("px-4 py-3 text-right", late ? "text-critic" : urgent ? "text-warning" : done ? "text-n500" : "text-white")}>
                      {done ? "—" : late ? "Vencido" : urgent ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{o.minutesLeft} min</span> : formatDuration(o.minutesLeft)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
