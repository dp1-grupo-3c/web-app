"use client";

import { CircleHelp, Layers, Package } from "lucide-react";
import { useState } from "react";
import { ConnectionBanner, ConnectionStatus, HudBar, HudSection } from "@/components/hud/Hud";
import { GridMap } from "@/components/map/GridMap";
import { ALL_LAYERS } from "@/components/map/layers";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { LegendPanel } from "@/components/panels/LegendPanel";
import { EMPTY_DRAFT, OrdersPanel } from "@/components/panels/OrdersPanel";
import { SideRail, type RailItem } from "@/components/workspace/SideRail";
import { usePanelParam } from "@/components/workspace/usePanelParam";
import { Workspace } from "@/components/workspace/Workspace";
import { PANEL_WIDTH } from "@/lib/constants";
import { useConnection, useMapSnapshot, useOrders, useSavedTrafficLight } from "@/lib/data/hooks";
import type { DataScope, EntityRef } from "@/lib/types";
import { WAITING_MESSAGE, highlightFor } from "./shared";

const SCOPE: DataScope = { kind: "client" };
const PANELS = ["pedidos", "ayuda", "leyenda"] as const;
type Panel = (typeof PANELS)[number];
const noop = () => {};

export function ClientScreen() {
  const [panel, setPanel] = usePanelParam(PANELS);
  const connection = useConnection(SCOPE);
  const snapshot = useMapSnapshot(SCOPE);
  const orders = useOrders(SCOPE);
  const trafficLight = useSavedTrafficLight();
  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [orderId, setOrderId] = useState<string | null>(null);

  const width = PANEL_WIDTH.default;
  const close = () => setPanel(null);
  const items: RailItem<Panel>[] = [{ id: "pedidos", label: "Pedidos", Icon: Package }];
  const bottom: RailItem<Panel>[] = [
    { id: "ayuda", label: "Ayuda", Icon: CircleHelp },
    { id: "leyenda", label: "Leyenda", Icon: Layers },
  ];

  const panelNode =
    panel === "pedidos" ? (
      <OrdersPanel audience="cliente" orders={orders} selectedId={orderId} onSelect={setOrderId} draft={EMPTY_DRAFT} onDraftChange={noop} picking={false} onTogglePick={noop} onClose={close} width={width} />
    )
    : panel === "ayuda" ? <HelpPanel audience="cliente" onClose={close} width={width} />
    : panel === "leyenda" ? <LegendPanel layers={layers} onToggle={(l, on) => setLayers((x) => ({ ...x, [l]: on }))} onClose={close} width={width} />
    : null;

  return (
    <Workspace
      map={
        <GridMap
          snapshot={snapshot}
          trafficLight={trafficLight}
          layers={layers}
          topInset={92}
          selected={selected}
          onSelect={setSelected}
          highlight={highlightFor(orders, orderId)}
          emptyMessage={WAITING_MESSAGE}
        />
      }
      hud={
        <>
          <HudBar><HudSection><ConnectionStatus state={connection} /></HudSection></HudBar>
          <ConnectionBanner state={connection} />
        </>
      }
      panel={panelNode}
      rail={<SideRail items={items} bottomItems={bottom} active={panel} onToggle={(p) => setPanel(panel === p ? null : p)} homeHref="/" />}
    />
  );
}
