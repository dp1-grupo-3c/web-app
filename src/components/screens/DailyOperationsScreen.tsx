"use client";

import { Activity, CircleAlert, CircleHelp, Layers, Package, SlidersVertical, Users } from "lucide-react";
import { useState } from "react";
import { ConnectionBanner, OpsHud } from "@/components/hud/Hud";
import { GridMap } from "@/components/map/GridMap";
import { ALL_LAYERS } from "@/components/map/layers";
import { BreakdownsPanel } from "@/components/panels/BreakdownsPanel";
import { ClientsPanel, EMPTY_CLIENT_DRAFT, type ClientsTab } from "@/components/panels/ClientsPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { LegendPanel } from "@/components/panels/LegendPanel";
import { MetricsPanel } from "@/components/panels/MetricsPanel";
import { draftForClient, EMPTY_DRAFT, OrdersPanel, type OrdersTab } from "@/components/panels/OrdersPanel";
import { TrafficLightPanel } from "@/components/panels/TrafficLight";
import { SideRail, type RailItem } from "@/components/workspace/SideRail";
import { usePanelParam } from "@/components/workspace/usePanelParam";
import { Workspace } from "@/components/workspace/Workspace";
import { PANEL_WIDTH } from "@/lib/constants";
import {
  useOperacionBreakdowns,
  useOperacionClock,
  useOperacionConnection,
  useOperacionKpis,
  useOperacionMapSnapshot,
  useOperacionMetrics,
  useOperacionOrders,
  useOperacionPlates,
  useOperacionTrafficLight,
} from "@/lib/data/hooks";
import { kindForDocument } from "@/lib/documento";
import type { Client, EntityRef } from "@/lib/types";
import { WAITING_MESSAGE, highlightFor } from "./shared";
import { DailyRunControl } from "./DailyRunControl";

const PANELS = ["semaforo", "metricas", "clientes", "pedidos", "averias", "ayuda", "leyenda"] as const;
type Panel = (typeof PANELS)[number];

export function DailyOperationsScreen() {
  const [panel, setPanel] = usePanelParam(PANELS);
  const connection = useOperacionConnection();
  const snapshot = useOperacionMapSnapshot();
  const kpis = useOperacionKpis();
  const clock = useOperacionClock();
  const orders = useOperacionOrders();
  const metrics = useOperacionMetrics();
  const breakdowns = useOperacionBreakdowns();
  const plates = useOperacionPlates();
  const trafficLight = useOperacionTrafficLight();

  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [orderTab, setOrderTab] = useState<OrdersTab>("lista");
  const [clientDraft, setClientDraft] = useState(EMPTY_CLIENT_DRAFT);
  const [clientTab, setClientTab] = useState<ClientsTab>("lista");
  // El registro de cliente se abrió desde un pedido: al guardar se vuelve a él.
  const [clientFromOrder, setClientFromOrder] = useState(false);
  const [picking, setPicking] = useState(false);

  const open = (p: Panel | null) => { setPicking(false); setClientFromOrder(false); setPanel(p); };

  const registerClientFromOrder = (document: string) => {
    setClientDraft({ ...EMPTY_CLIENT_DRAFT, kind: kindForDocument(document) ?? "", document });
    setClientTab("nuevo");
    open("clientes");
    setClientFromOrder(true);
  };
  const orderForClient = (client: Client) => {
    setDraft((d) => draftForClient(d, client));
    setOrderTab("nuevo");
    open("pedidos");
  };
  const toggle = (p: Panel) => open(panel === p ? null : p);
  const width = panel === "semaforo" ? PANEL_WIDTH.wide : PANEL_WIDTH.default;
  const close = () => open(null);
  const activeBreakdowns = breakdowns.filter((b) => b.status === "activa").length;

  const items: RailItem<Panel>[] = [
    { id: "semaforo", label: "Semáforo", Icon: SlidersVertical },
    { id: "metricas", label: "Métricas", Icon: Activity },
    { id: "clientes", label: "Clientes", Icon: Users },
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
    : panel === "clientes" ? (
      <ClientsPanel
        tab={clientTab}
        onTabChange={setClientTab}
        draft={clientDraft}
        onDraftChange={setClientDraft}
        picking={picking}
        onTogglePick={() => setPicking((p) => !p)}
        onSaved={(client, created) => { if (created && clientFromOrder) orderForClient(client); }}
        onCreateOrder={orderForClient}
        onClose={close}
        width={width}
      />
    )
    : panel === "pedidos" ? (
      <OrdersPanel
        audience="operador"
        orders={orders}
        selectedId={orderId}
        onSelect={setOrderId}
        draft={draft}
        onDraftChange={setDraft}
        tab={orderTab}
        onTabChange={setOrderTab}
        onRegisterClient={registerClientFromOrder}
        picking={picking}
        onTogglePick={() => setPicking((p) => !p)}
        onClose={close}
        width={width}
      />
    )
    : panel === "averias" ? <BreakdownsPanel live plates={plates} recent={breakdowns} onClose={close} width={width} />
    : panel === "ayuda" ? <HelpPanel audience="operador" onClose={close} width={width} />
    : panel === "leyenda" ? <LegendPanel layers={layers} onToggle={(l, on) => setLayers((x) => ({ ...x, [l]: on }))} onClose={close} width={width} />
    : null;

  return (
    <Workspace
      map={
        <GridMap
          snapshot={snapshot}
          orders={orders}
          trafficLight={trafficLight}
          layers={layers}
          selected={selected}
          onSelect={setSelected}
          highlight={panel === "clientes" ? highlightFor(orders, null, clientDraft) : highlightFor(orders, orderId, panel === "pedidos" ? draft : undefined)}
          pickMode={picking}
          onPick={(c) => {
            const coords = { x: String(c.x), y: String(c.y) };
            if (panel === "clientes") setClientDraft((d) => ({ ...d, ...coords }));
            else setDraft((d) => ({ ...d, ...coords }));
            setPicking(false);
          }}
          onCancelPick={() => setPicking(false)}
          emptyMessage={WAITING_MESSAGE}
        />
      }
      hud={
        <>
          <OpsHud connection={connection} clock={clock} kpis={kpis} compact={!!panel} onOpenOrders={() => open("pedidos")} onOpenBreakdowns={() => open("averias")} />
          <ConnectionBanner state={connection} />
          <DailyRunControl />
        </>
      }
      panel={panelNode}
      rail={<SideRail items={items} bottomItems={bottom} active={panel} onToggle={toggle} homeHref="/operaciones" />}
    />
  );
}
