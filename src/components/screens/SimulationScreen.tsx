"use client";

import { Activity, CircleAlert, CircleHelp, Layers, Package, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { SimHud } from "@/components/hud/SimHud";
import { GridMap } from "@/components/map/GridMap";
import { PendingChangeChip } from "@/components/map/PendingChangeChip";
import { ALL_LAYERS } from "@/components/map/layers";
import { BreakdownsPanel } from "@/components/panels/BreakdownsPanel";
import { fleetDraftErrors, parseFleetDraft, sameFleet, toFleetDraft } from "@/components/panels/FleetPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { LegendPanel } from "@/components/panels/LegendPanel";
import { MetricsPanel } from "@/components/panels/MetricsPanel";
import { OccupancyMetrics } from "@/components/panels/OccupancyMetrics";
import { EMPTY_DRAFT, OrdersPanel } from "@/components/panels/OrdersPanel";
import { SectionsPanel } from "@/components/panels/SectionsPanel";
import { SimConfigPanel, type ConfigTab } from "@/components/panels/SimConfigPanel";
import { BufferingDialog } from "@/components/simulation/BufferingDialog";
import { ConfirmCancelDialog } from "@/components/simulation/ConfirmCancelDialog";
import { OtherRunNotice, RUN_TITLE } from "@/components/simulation/OtherRunNotice";
import { SimOnboarding } from "@/components/simulation/SimOnboarding";
import { SimulationSummaryModal } from "@/components/simulation/SimulationSummaryModal";
import { useToast } from "@/components/ui/Toast";
import { PanelPinContext, usePinnedPreference } from "@/components/workspace/PanelPin";
import { SideRail, type RailItem } from "@/components/workspace/SideRail";
import { usePanelParam } from "@/components/workspace/usePanelParam";
import { Workspace } from "@/components/workspace/Workspace";
import { DEFAULT_TRAFFIC_LIGHT, PANEL_WIDTH } from "@/lib/constants";
import { esFinal } from "@/lib/backend/estado";
import { DEFAULT_START_TIME } from "@/config/simulacion";
import { cancelSimulation, forgetSimulation, saveFleet, startSimulation } from "@/lib/data/actions";
import { TIPO_POR_MODO } from "@/lib/data/adapters";
import { useActiveRun, useBreakdowns, useBufferVariant, useFleetSettings, useMapSnapshot, useMetrics, useOrdersWithDestinations, usePlayback, useRunSettings, useSavedTrafficLight, useSimulationFeed, useVehiclePlates } from "@/lib/data/hooks";
import { toISODate } from "@/lib/format";
import { defaultSimSettings } from "@/lib/sim-settings";
import type { DataScope, EntityRef, SimulationMode, SimulationOutcome } from "@/lib/types";
import { WAITING_MESSAGE, highlightFor } from "./shared";

const PANELS = ["menu", "config", "flota", "metricas", "pedidos", "averias", "ayuda", "leyenda"] as const;
type Panel = (typeof PANELS)[number];
const DESCRIPTIONS: Partial<Record<Panel, string>> = {
  config: "Fecha y hora de inicio, flota, semáforos y averías.",
  metricas: "Indicadores acumulados de la simulación.",
  pedidos: "Pedidos activos y su destino en el mapa.",
  averias: "Registra averías y revisa las recientes.",
  ayuda: "Guía rápida de la pantalla.",
  leyenda: "Íconos del mapa y capas visibles.",
};
const SCOPES: Record<SimulationMode, DataScope> = { "5d": { kind: "sim", mode: "5d" }, colapso: { kind: "sim", mode: "colapso" } };
const noop = () => {};

type Phase = "idle" | "running" | "ended";

export function SimulationScreen({ mode }: { mode: SimulationMode }) {
  const scope = SCOPES[mode];
  const toast = useToast();
  const [panel, setPanel] = usePanelParam(PANELS);
  const [pinned, setPinned] = usePinnedPreference();
  const snapshot = useMapSnapshot(scope);
  const { orders, destinations: knownDestinations } = useOrdersWithDestinations(scope);
  const metrics = useMetrics(scope);
  const breakdowns = useBreakdowns(scope);
  const plates = useVehiclePlates(scope);
  const feed = useSimulationFeed(mode);
  const active = useActiveRun();
  const savedTrafficLight = useSavedTrafficLight();
  const fleet = useFleetSettings();
  const bufferVariant = useBufferVariant();
  const play = usePlayback(mode);

  const [cancelledId, setCancelledId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [trafficLight, setTrafficLight] = useState(DEFAULT_TRAFFIC_LIGHT);
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<ConfigTab>("general");
  const [settings, setSettings] = useState(defaultSimSettings);
  // Respaldo estable (no un objeto nuevo en cada render) para las corridas sin configuración conocida.
  const [fallbackSettings] = useState(defaultSimSettings);
  // Borrador de la flota: se reinicia cuando el servidor confirma otros valores.
  const [fleetDraft, setFleetDraft] = useState(() => ({ version: fleet.version, draft: toFleetDraft(fleet.value) }));
  if (fleetDraft.version !== fleet.version) setFleetDraft({ version: fleet.version, draft: toFleetDraft(fleet.value) });

  // La flota ahora es una pestaña de la configuración: ?panel=flota sigue funcionando.
  if (panel === "flota" && configTab !== "flota") setConfigTab("flota");
  useEffect(() => { if (panel === "flota") setPanel("config"); }, [panel, setPanel]);

  // El backend ejecuta una sola corrida a la vez: la fase sale de esa corrida,
  // no de si se inició desde esta pantalla, para retomarla al recargar,
  // al volver a la pantalla o cuando la inició otra sesión.
  const own = active.corrida?.tipo === TIPO_POR_MODO[mode] ? active.corrida : null;
  const other = active.running && active.corrida && !own ? active.corrida : null;
  const syncing = !!active.id && !active.corrida; // id conocido por /salud, detalle aún en camino
  const cancelledByUser = !!own && cancelledId === own.id;
  // La simulación termina por el servidor (éxito, colapso o error) o porque el usuario la cancela.
  const ended = !!own && (esFinal(own.estado) || feed.outcome != null || cancelledByUser);
  const outcome: SimulationOutcome | null = feed.outcome ?? (cancelledByUser ? "cancelada" : null);
  const effectivePhase: Phase = !own ? "idle" : ended ? "ended" : "running";
  const runStartDate = own?.primerDia ?? startDate;
  const runTrafficLight = own ? savedTrafficLight : trafficLight;
  // Durante la corrida se muestran los valores con los que el usuario la comenzó.
  const runSettings = useRunSettings(own?.id);
  const shownSettings = own ? runSettings?.settings ?? fallbackSettings : settings;
  const shownFleet = own ? toFleetDraft(runSettings?.fleet ?? fleet.value) : fleetDraft.draft;

  const width = panel === "config" ? PANEL_WIDTH.wide : PANEL_WIDTH.default;
  const close = () => setPanel(null);

  const start = async () => {
    setStarting(true);
    // La flota se aplica justo antes de comenzar; si el servidor la rechaza, no se inicia.
    const chosenFleet = parseFleetDraft(fleetDraft.draft);
    if (!sameFleet(chosenFleet, fleet.value)) {
      const saved = await saveFleet(chosenFleet, fleet.value);
      if (!saved.ok) {
        setStarting(false);
        setConfigTab("flota");
        return toast.error(saved.message);
      }
    }
    const chosen = { ...settings, startTime: settings.startTime.trim() || DEFAULT_START_TIME };
    const res = await startSimulation({ mode, startDate, trafficLight, settings: chosen, fleet: chosenFleet });
    setStarting(false);
    if (!res.ok) return toast.error(res.message);
    setPanel(null);
  };
  const confirmCancel = async () => {
    if (!confirming) return;
    const stoppingOther = confirming === other?.id;
    setCancelling(true);
    const res = await cancelSimulation(confirming);
    setCancelling(false);
    setConfirming(null);
    if (!res.ok) return toast.error(res.message);
    if (stoppingOther) return toast.success("Se detuvo la corrida anterior. Ya puedes configurar esta simulación.");
    setCancelledId(confirming);
    setPanel(null);
  };
  const newSimulation = () => {
    forgetSimulation();
    setCancelledId(null);
    setDismissedId(null);
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
  const requested = panel === "flota" ? "config" : idle && panel && !["menu", "config", "ayuda", "leyenda"].includes(panel) ? null : panel;
  // Fijado, el panel no se cierra: sin una sección elegida muestra el menú de secciones.
  const shown = requested ?? (pinned ? "menu" : null);
  const section = shown === "menu" ? null : shown;
  const pin = {
    pinned,
    onTogglePin: () => setPinned(!pinned),
    onBack: shown === "menu" ? undefined : () => setPanel("menu"),
  };

  const panelNode =
    shown === "menu" ? <SectionsPanel items={[...items, ...bottom]} descriptions={DESCRIPTIONS} onPick={setPanel} onClose={close} width={width} />
    : shown === "config" ? (
      <SimConfigPanel
        mode={mode}
        readOnly={!idle || !!other || syncing}
        tab={configTab}
        onTab={setConfigTab}
        startDate={runStartDate}
        onStartDate={setStartDate}
        trafficLight={runTrafficLight}
        onTrafficLight={setTrafficLight}
        settings={shownSettings}
        onSettings={setSettings}
        fleet={shownFleet}
        onFleet={(draft) => setFleetDraft((f) => ({ ...f, draft }))}
        fleetErrors={fleetDraftErrors(shownFleet)}
        starting={starting}
        onStart={start}
        onClose={close}
        width={width}
      />
    )
    : shown === "metricas" ? <MetricsPanel metrics={metrics} simulation onClose={close} width={width} occupancy={<OccupancyMetrics scope={scope} settings={shownSettings} />} />
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
          orders={orders}
          knownDestinations={knownDestinations}
            trafficLight={runTrafficLight}
            layers={layers}
            neutralWarehouses={idle}
            vehicleBands={shownSettings.vehicleOccupancy}
            selected={selected}
            onSelect={setSelected}
            highlight={highlightFor(orders, orderId)}
            emptyMessage={idle && !syncing ? undefined : WAITING_MESSAGE}
            status={!idle && (
              <>
                <PendingChangeChip pending={play.pending} />
                {process.env.NODE_ENV === "development" && <span className="rounded bg-panel/80 px-1.5 text-[11px] text-n500">buffer: {bufferVariant} ({play.target})</span>}
              </>
            )}
          />
          {other && !section && <OtherRunNotice tipo={other.tipo} primerDia={other.primerDia} onStop={() => setConfirming(other.id)} />}
          {idle && !other && !syncing && !section && <SimOnboarding mode={mode} onConfigure={() => setPanel("config")} />}
        </>
      }
      hud={
        !idle && (
          <SimHud
            mode={mode}
            startDate={runStartDate}
            clock={feed.clock}
            ended={ended}
            compact={!!shown}
            lagSeconds={play.lagSeconds}
            onCancel={() => own && setConfirming(own.id)}
          />
        )
      }
      panel={panelNode && <PanelPinContext.Provider value={pin}>{panelNode}</PanelPinContext.Provider>}
      panelFloating={!pinned}
      rail={<SideRail items={items} bottomItems={bottom} active={shown} onToggle={(p) => setPanel(shown === p ? (pinned ? "menu" : null) : p)} homeHref="/operaciones" />}
      overlay={
        <>
          {confirming && (
            confirming === other?.id ? (
              <ConfirmCancelDialog
                busy={cancelling}
                onKeep={() => setConfirming(null)}
                onConfirm={confirmCancel}
                title={`¿Detener «${RUN_TITLE[other.tipo]}»?`}
                description="La corrida se detendrá para todas las sesiones conectadas y no podrás reanudarla."
              />
            ) : <ConfirmCancelDialog busy={cancelling} onKeep={() => setConfirming(null)} onConfirm={confirmCancel} />
          )}
          {effectivePhase === "running" && play.phase === "llenando" && <BufferingDialog queued={play.queued} target={play.target} />}
          {ended && outcome && dismissedId !== own?.id && (
            <SimulationSummaryModal
              mode={mode}
              outcome={outcome}
              startDate={feed.summary?.startDate ?? runStartDate}
              summary={feed.summary}
              errorMessage={feed.error}
              onClose={() => setDismissedId(own?.id ?? null)}
              onNew={newSimulation}
            />
          )}
        </>
      }
    />
  );
}
