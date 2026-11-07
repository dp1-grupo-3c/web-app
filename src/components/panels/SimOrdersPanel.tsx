"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useDeliveredOrders, useOrderRows } from "@/lib/data/hooks";
import { formatSimClock } from "@/lib/data/selectors";
import type { DataScope } from "@/lib/types";
import { OrdersPanel, type OrderTracking } from "./OrdersPanel";

/**
 * Panel de pedidos de la simulación: agrega a cada pedido los vehículos que
 * lo entregan, el punto actual, la hora de salida y la llegada estimada.
 * Se calcula solo mientras el panel está abierto, una vez por fotografía.
 */
export function SimOrdersPanel({ scope, ...props }: { scope: DataScope } & Omit<ComponentProps<typeof OrdersPanel>, "tracking" | "audience" | "delivered">) {
  const [deliveredHours, setDeliveredHours] = useState<number | null>(null);
  const deliveredOrders = useDeliveredOrders(scope, deliveredHours);
  const { rows, simTime, minute } = useOrderRows(scope, props.orders);
  const tracking = useMemo(() => {
    const map = new Map<string, OrderTracking>();
    for (const r of rows) {
      map.set(r.id, {
        carriers: r.carriers.map((c) => ({ plate: c.plate, loaded: c.loaded, packages: c.packages })),
        currentPoint: r.currentPoint,
        departure: formatSimClock(simTime, minute, r.departureMinute),
        arrival: formatSimClock(simTime, minute, r.arrivalMinute),
      });
    }
    return map;
  }, [rows, simTime, minute]);
  return <OrdersPanel audience="simulacion" tracking={tracking} delivered={{ hours: deliveredHours, onHoursChange: setDeliveredHours, orders: deliveredOrders }} {...props} />;
}
