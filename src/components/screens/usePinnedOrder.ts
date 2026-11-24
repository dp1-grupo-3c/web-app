"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { orderCarriers, reassignmentMessage, type OrderCarrier } from "@/components/map/order-focus";
import type { Order, Vehicle } from "@/lib/types";

/** Pedido fijado tal como se muestra: datos, si ya se entregó y quién lo lleva en la foto del mapa. */
export type PinnedOrder = { order: Order; delivered: boolean; carriers: OrderCarrier[] };

/**
 * Pedido fijado de una pantalla. Sobrevive al cierre del panel y se descarta
 * al cambiar de corrida. Se considera entregado cuando el servidor ya no lo
 * lista como activo (o lo marca entregado) y ningún vehículo de la foto
 * mostrada lo lleva: así el mapa, que en la simulación va por detrás, no lo
 * da por entregado antes de ver llegar al vehículo.
 */
export function usePinnedOrder(run: string | null, orders: Order[], vehicles: readonly Vehicle[]) {
  const toast = useToast();
  const [pin, setPin] = useState<{ run: string | null; id: string; last: Order } | null>(null);
  const active = pin && pin.run === run ? pin : null;
  const pinnedId = active?.id ?? null;
  const current = pinnedId ? orders.find((o) => o.id === pinnedId) : undefined;
  // Se guarda el último dato conocido: al entregarse, el pedido sale de la lista de activos.
  // Por contenido: la lista puede traer objetos nuevos en cada render sin que nada cambie.
  if (active && current && current !== active.last && JSON.stringify(current) !== JSON.stringify(active.last)) setPin({ ...active, last: current });

  const carriers = useMemo(() => (pinnedId ? orderCarriers(vehicles, pinnedId) : []), [pinnedId, vehicles]);
  const delivered = !!active && carriers.length === 0 && (!current || current.status === "entregado");
  const base = current ?? active?.last;
  const pinned: PinnedOrder | null = active && base ? { order: delivered ? { ...base, status: "entregado" } : base, delivered, carriers } : null;

  // Aviso cuando otro vehículo pasa a llevar el pedido fijado.
  const plates = carriers.map((c) => c.vehicle.plate).sort().join(",");
  const seen = useRef<{ id: string; plates: string } | null>(null);
  useEffect(() => {
    const before = seen.current;
    seen.current = pinnedId ? { id: pinnedId, plates } : null;
    if (!pinnedId || before?.id !== pinnedId) return;
    const message = reassignmentMessage(pinnedId, before.plates ? before.plates.split(",") : [], plates ? plates.split(",") : []);
    if (message) toast.info(message);
  }, [pinnedId, plates, toast]);

  return {
    pinnedId,
    pinned,
    setPinned: (order: Order | null) => setPin(order ? { run, id: order.id, last: order } : null),
  };
}
