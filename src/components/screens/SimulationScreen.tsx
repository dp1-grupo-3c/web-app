"use client";

import { Activity, CircleAlert, CircleHelp, Layers, Package, Settings } from "lucide-react";
import { useState } from "react";
import { SimHud, type Speed } from "@/components/hud/SimHud";
import { GridMap } from "@/components/map/GridMap";
import { ALL_LAYERS } from "@/components/map/layers";
import { BreakdownsPanel } from "@/components/panels/BreakdownsPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { LegendPanel } from "@/components/panels/LegendPanel";
import { MetricsPanel } from "@/components/panels/MetricsPanel";
import { EMPTY_DRAFT, OrdersPanel } from "@/components/panels/OrdersPanel";
import { SimConfigPanel } from "@/components/panels/SimConfigPanel";
import { ConfirmCancelDialog } from "@/components/simulation/ConfirmCancelDialog";
import { SimOnboarding } from "@/components/simulation/SimOnboarding";
import { SimulationSummaryModal } from "@/components/simulation/SimulationSummaryModal";
import { useToast } from "@/components/ui/Toast";
import { SideRail, type RailItem } from "@/components/workspace/SideRail";
import { usePanelParam } from "@/components/workspace/usePanelParam";
import { Workspace } from "@/components/workspace/Workspace";
import { DEFAULT_TRAFFIC_LIGHT, PANEL_WIDTH } from "@/lib/constants";
import { cancelSimulation, setSimulationPaused, setSimulationSpeed, startSimulation } from "@/lib/data/actions";
import { useBreakdowns, useMapSnapshot, useMetrics, useOrders, useSimulationFeed, useVehiclePlates } from "@/lib/data/hooks";
import { toISODate } from "@/lib/format";
import type { DataScope, EntityRef, SimulationMode, SimulationOutcome } from "@/lib/types";
import { WAITING_MESSAGE, highlightFor } from "./shared";

const PANELS = ["config", "metricas", "pedidos", "averias", "ayuda", "leyenda"] as const;
type Panel = (typeof PANELS)[number];
const SCOPES: Record<SimulationMode, DataScope> = { "5d": { kind: "sim", mode: "5d" }, colapso: { kind: "sim", mode: "colapso" } };
const noop = () => {};

type Phase = "idle" | "running" | "ended";

export function SimulationScreen({ mode }: { mode: SimulationMode }) {
  const scope = SCOPES[mode];
  const toast = useToast();
  const [panel, setPanel] = usePanelParam(PANELS);
  const snapshot = useMapSnapshot(scope);
  const orders = useOrders(scope);
  const metrics = useMetrics(scope);
  const breakdowns = useBreakdowns(scope);
  const plates = useVehiclePlates(scope);
  const feed = useSimulationFeed(mode);

  const [phase, setPhase] = useState<Phase>("idle");
  const [cancelledByUser, setCancelledByUser] = useState(false);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [trafficLight, setTrafficLight] = useState(DEFAULT_TRAFFIC_LIGHT);
  const [starting, setStarting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [orderId, setOrderId] = useState<string | null>(null);

  // La simulación termina por el servidor (éxito o colapso) o porque el usuario la cancela.
  const ended = phase === "ended" || feed.summary != null;
  const outcome: SimulationOutcome | null = feed.summary?.outcome ?? (cancelledByUser ? "cancelada" : null);
  const effectivePhase: Phase = ended ? "ended" : phase;

  const width = panel === "config" ? PANEL_WIDTH.wide : PANEL_WIDTH.default;
  const close = () => setPanel(null);

  const start = async () => {
    setStarting(true);
    const res = await startSimulation({ mode, startDate, trafficLight });
    setStarting(false);
    if (!res.ok) return toast.error(res.message);
    setPhase("running");
    setPaused(false);
    setPanel(null);
  };
  const togglePause = async () => {
    const res = await setSimulationPaused(mode, !paused);
    if (!res.ok) return toast.error(res.message);
    setPaused(!paused);
  };
  const changeSpeed = async (s: Speed) => {
    const res = await setSimulationSpeed(mode, s);
    if (!res.ok) return toast.error(res.message);
    setSpeed(s);
  };
  const confirmCancel = async () => {
    setCancelling(true);
    const res = await cancelSimulation(mode);
    setCancelling(false);
    if (!res.ok) return toast.error(res.message);
    setConfirming(false);
    setCancelledByUser(true);
    setPhase("ended");
    setPanel(null);
  };
  const newSimulation = () => {
    setPhase("idle");
    setCancelledByUser(false);
    setSummaryDismissed(false);
    setPaused(false);
    setSpeed(1);
    setPanel("config");
  };

  const idle = effectivePhase === "idle";
  const items: RailItem<Panel>[] = idle
    ? [{ id: "config", label: "Configurar", Icon: Settings }]
    : [
        { id: "config", label: "Configurar", Icon: Settings },
        { id: "metricas", label: "Métricas", Icon: Activity },
        { id: "pedidos", label: "Pedidos", Icon: Package },
        { id: "averias", label: "Averías", Icon: CircleAlert, badge: breakdowns.filter((b) => b.status === "activa").length },
      ];
  const bottom: RailItem<Panel>[] = [
    { id: "ayuda", label: "Ayuda", Icon: CircleHelp },
    { id: "leyenda", label: "Leyenda", Icon: Layers },
  ];
  // Durante la configuración solo se ofrecen los paneles disponibles.
  const shown = idle && panel && !["config", "ayuda", "leyenda"].includes(panel) ? null : panel;

  const panelNode =
    shown === "config" ? (
      <SimConfigPanel mode={mode} readOnly={!idle} startDate={startDate} onStartDate={setStartDate} trafficLight={trafficLight} onTrafficLight={setTrafficLight} starting={starting} onStart={start} onClose={close} width={width} />
    )
    : shown === "metricas" ? <MetricsPanel metrics={metrics} simulation onClose={close} width={width} />
    : shown === "pedidos" ? (
      <OrdersPanel audience="simulacion" orders={orders} selectedId={orderId} onSelect={setOrderId} draft={EMPTY_DRAFT} onDraftChange={noop} picking={false} onTogglePick={noop} onClose={close} width={width} />
    )
    : shown === "averias" ? <BreakdownsPanel plates={plates} recent={breakdowns} onClose={close} width={width} />
    : shown === "ayuda" ? <HelpPanel audience="simulacion" onClose={close} width={width} />
    : shown === "leyenda" ? <LegendPanel layers={layers} onToggle={(l, on) => setLayers((x) => ({ ...x, [l]: on }))} onClose={close} width={width} />
    : null;

  return (
    <Workspace
      map={
        <>
          <GridMap
            snapshot={snapshot}
            trafficLight={trafficLight}
            layers={layers}
            topInset={112}
            neutralWarehouses={idle}
            selected={selected}
            onSelect={setSelected}
            highlight={highlightFor(orders, orderId)}
            emptyMessage={idle ? undefined : WAITING_MESSAGE}
          />
          {idle && !shown && <SimOnboarding mode={mode} onConfigure={() => setPanel("config")} />}
        </>
      }
      hud={
        !idle && (
          <SimHud
            mode={mode}
            startDate={startDate}
            clock={feed.clock}
            ended={ended}
            paused={paused}
            speed={speed}
            compact={!!shown}
            onTogglePause={togglePause}
            onSpeed={changeSpeed}
            onCancel={() => setConfirming(true)}
          />
        )
      }
      panel={panelNode}
      rail={<SideRail items={items} bottomItems={bottom} active={shown} onToggle={(p) => setPanel(shown === p ? null : p)} homeHref="/operaciones" />}
      overlay={
        <>
          {confirming && <ConfirmCancelDialog busy={cancelling} onKeep={() => setConfirming(false)} onConfirm={confirmCancel} />}
          {ended && outcome && !summaryDismissed && (
            <SimulationSummaryModal mode={mode} outcome={outcome} startDate={feed.summary?.startDate ?? startDate} summary={feed.summary} onClose={() => setSummaryDismissed(true)} onNew={newSimulation} />
          )}
        </>
      }
    />
  );
}
