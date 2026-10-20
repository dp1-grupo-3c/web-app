"use client";

import { Activity, CircleAlert, CircleHelp, Layers, Package, SlidersVertical } from "lucide-react";
import { useState } from "react";
import { ConnectionBanner, OpsHud } from "@/components/hud/Hud";
import { GridMap } from "@/components/map/GridMap";
import { ALL_LAYERS } from "@/components/map/layers";
import { BreakdownsPanel } from "@/components/panels/BreakdownsPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { LegendPanel } from "@/components/panels/LegendPanel";
import { MetricsPanel } from "@/components/panels/MetricsPanel";
import { EMPTY_DRAFT, OrdersPanel } from "@/components/panels/OrdersPanel";
import { TrafficLightPanel } from "@/components/panels/TrafficLight";
import { SideRail, type RailItem } from "@/components/workspace/SideRail";
import { usePanelParam } from "@/components/workspace/usePanelParam";
import { Workspace } from "@/components/workspace/Workspace";
import { PANEL_WIDTH } from "@/lib/constants";
import { useBreakdowns, useConnection, useMapSnapshot, useMetrics, useOpsKpis, useOrders, useSavedTrafficLight, useVehiclePlates } from "@/lib/data/hooks";
import type { DataScope, EntityRef } from "@/lib/types";
import { WAITING_MESSAGE, highlightFor } from "./shared";
import { DailyRunControl } from "./DailyRunControl";

const SCOPE: DataScope = { kind: "live" };
const PANELS = ["semaforo", "metricas", "pedidos", "averias", "ayuda", "leyenda"] as const;
type Panel = (typeof PANELS)[number];

export function DailyOperationsScreen() {
  const [panel, setPanel] = usePanelParam(PANELS);
  const connection = useConnection(SCOPE);
  const snapshot = useMapSnapshot(SCOPE);
  const kpis = useOpsKpis();
  const orders = useOrders(SCOPE);
  const metrics = useMetrics(SCOPE);
  const breakdowns = useBreakdowns(SCOPE);
  const plates = useVehiclePlates(SCOPE);
  const trafficLight = useSavedTrafficLight();

  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [picking, setPicking] = useState(false);

  const open = (p: Panel | null) => { setPicking(false); setPanel(p); };
  const toggle = (p: Panel) => open(panel === p ? null : p);
  const width = panel === "semaforo" ? PANEL_WIDTH.wide : PANEL_WIDTH.default;
  const close = () => open(null);
  const activeBreakdowns = breakdowns.filter((b) => b.status === "activa").length;

  const items: RailItem<Panel>[] = [
    { id: "semaforo", label: "Semáforo", Icon: SlidersVertical },
    { id: "metricas", label: "Métricas", Icon: Activity },
    { id: "pedidos", label: "Pedidos", Icon: Package },
    { id: "averias", label: "Averías", Icon: CircleAlert, badge: activeBreakdowns },
  ];
  const bottom: RailItem<Panel>[] = [
    { id: "ayuda", label: "Ayuda", Icon: CircleHelp },
    { id: "leyenda", label: "Leyenda", Icon: Layers },
  ];

  const panelNode =
    panel === "semaforo" ? <TrafficLightPanel key={JSON.stringify(trafficLight)} saved={trafficLight} onClose={close} width={width} />
    : panel === "metricas" ? <MetricsPanel metrics={metrics} simulation={false} onClose={close} width={width} />
    : panel === "pedidos" ? (
      <OrdersPanel audience="operador" orders={orders} selectedId={orderId} onSelect={setOrderId} draft={draft} onDraftChange={setDraft} picking={picking} onTogglePick={() => setPicking((p) => !p)} onClose={close} width={width} />
    )
    : panel === "averias" ? <BreakdownsPanel plates={plates} recent={breakdowns} onClose={close} width={width} />
    : panel === "ayuda" ? <HelpPanel audience="operador" onClose={close} width={width} />
    : panel === "leyenda" ? <LegendPanel layers={layers} onToggle={(l, on) => setLayers((x) => ({ ...x, [l]: on }))} onClose={close} width={width} />
    : null;

  return (
    <Workspace
      map={
        <GridMap
          snapshot={snapshot}
          trafficLight={trafficLight}
          layers={layers}
          selected={selected}
          onSelect={setSelected}
          highlight={highlightFor(orders, orderId, panel === "pedidos" ? draft : undefined)}
          pickMode={picking}
          onPick={(c) => { setDraft((d) => ({ ...d, x: String(c.x), y: String(c.y) })); setPicking(false); }}
          onCancelPick={() => setPicking(false)}
          emptyMessage={WAITING_MESSAGE}
        />
      }
      hud={
        <>
          <OpsHud connection={connection} kpis={kpis} onOpenOrders={() => open("pedidos")} onOpenBreakdowns={() => open("averias")} />
          <ConnectionBanner state={connection} />
          <DailyRunControl />
        </>
      }
      panel={panelNode}
      rail={<SideRail items={items} bottomItems={bottom} active={panel} onToggle={toggle} homeHref="/operaciones" />}
    />
  );
}
