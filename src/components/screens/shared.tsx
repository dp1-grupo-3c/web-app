import { LoaderCircle } from "lucide-react";
import { GRID } from "@/lib/constants";
import type { Coord, Order } from "@/lib/types";
import type { OrderDraft } from "@/components/panels/OrdersPanel";

/** Destino a destacar en el mapa: el pedido seleccionado o el del borrador de registro. */
export function highlightFor(orders: Order[], selectedOrderId: string | null, draft?: OrderDraft): Coord | null {
  const order = selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : undefined;
  if (order) return order.destination;
  if (!draft || draft.x === "" || draft.y === "") return null;
  const x = Number(draft.x), y = Number(draft.y);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= GRID.width && y >= 0 && y <= GRID.height ? { x, y } : null;
}

export const WAITING_MESSAGE = "Esperando datos del servidor";

/** Respaldo mientras se resuelve el estado de la URL. */
export function ScreenFallback() {
  return (
    <div role="status" className="grid h-dvh place-items-center bg-canvas text-sm text-n400">
      <span className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin text-pink" aria-hidden /> Cargando…</span>
    </div>
  );
}
