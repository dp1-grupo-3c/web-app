"use client";

import { Activity, CircleAlert, CircleHelp, Database, Layers, Package, Settings, Truck, Users, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConnectionBanner, OpsHud } from "@/components/hud/Hud";
import { GridMap } from "@/components/map/GridMap";
import { ALL_LAYERS } from "@/components/map/layers";
import { BreakdownsPanel } from "@/components/panels/BreakdownsPanel";
import { ClientsPanel, EMPTY_CLIENT_DRAFT, type ClientsTab } from "@/components/panels/ClientsPanel";
import { DataPanel } from "@/components/panels/DataPanel";
import { fleetDraftErrors, parseFleetDraft, sameFleet, toFleetDraft } from "@/components/panels/FleetPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { LegendPanel } from "@/components/panels/LegendPanel";
import { MetricsPanel } from "@/components/panels/MetricsPanel";
import { OccupancyMetrics } from "@/components/panels/OccupancyMetrics";
import { OpsConfigPanel, type OpsConfigTab } from "@/components/panels/OpsConfigPanel";
import { draftForClient, EMPTY_DRAFT, OrdersPanel, type OrdersTab } from "@/components/panels/OrdersPanel";
import { useOperacionBands } from "@/components/panels/TrafficLight";
import { VehiclesPanel } from "@/components/panels/VehiclesPanel";
import { WarehousesPanel } from "@/components/panels/WarehousesPanel";
import { useToast } from "@/components/ui/Toast";
import { SideRail, type RailItem } from "@/components/workspace/SideRail";
import { usePanelParam } from "@/components/workspace/usePanelParam";
import { Workspace } from "@/components/workspace/Workspace";
import { FLEET_DEFAULTS } from "@/config/simulacion";
import { PANEL_WIDTH } from "@/lib/constants";
import { saveFleet, saveOperationSpeeds, startOperation } from "@/lib/data/actions";
import {
  useActiveRun,
  useFleetSettings,
  useOperacion,
  useOperacionBreakdowns,
  useOperacionClock,
  useOperacionConnection,
  useOperacionFleet,
  useOperacionKpis,
  useOperacionMapSnapshot,
  useOperacionMetrics,
  useOperacionDeliveredOrders,
  useOperacionOrders,
  useOperacionPlates,
  useOperacionTrafficLight,
} from "@/lib/data/hooks";
import { kindForDocument } from "@/lib/documento";
import { defaultSimSettings } from "@/lib/sim-settings";
import type { Client, DataScope, EntityRef, FleetSettings, MapFilter, VehicleKind } from "@/lib/types";
import { WAITING_MESSAGE, highlightFor } from "./shared";
import { DailyRunControl } from "./DailyRunControl";

// "semaforo" se mantiene para enlaces antiguos: abre la pestaña Semáforo de Configurar.
const PANELS = ["config", "semaforo", "vehiculos", "almacenes", "metricas", "clientes", "pedidos", "averias", "datos", "ayuda", "leyenda"] as const;
type Panel = (typeof PANELS)[number];
/** Paneles disponibles antes de iniciar la operación. */
const IDLE_PANELS: Panel[] = ["config", "almacenes", "datos", "ayuda", "leyenda"];
const SCOPE: DataScope = { kind: "ops" };
const KINDS: VehicleKind[] = ["auto", "moto", "bicicleta"];

export function DailyOperationsScreen() {
  const toast = useToast();
  const [panel, setPanel] = usePanelParam(PANELS);
  const { cargado, running } = useOperacion();
  const connection = useOperacionConnection();
  const snapshot = useOperacionMapSnapshot();
  const kpis = useOperacionKpis();
  const clock = useOperacionClock();
  const orders = useOperacionOrders();
  const [deliveredHours, setDeliveredHours] = useState<number | null>(null);
  const deliveredOrders = useOperacionDeliveredOrders(deliveredHours);
  const metrics = useOperacionMetrics();
  const breakdowns = useOperacionBreakdowns();
  const plates = useOperacionPlates();
  const trafficLight = useOperacionTrafficLight();
  const opsFleet = useOperacionFleet();
  const serverFleet = useFleetSettings();
  // Una simulación en curso (de otra pantalla o sesión) también impide cargar datos.
  const simulationRunning = useActiveRun().running;
  const { bands, applied, setBands } = useOperacionBands();
  // Los listados reciben la configuración completa; solo usan los semáforos en %.
  const settings = useMemo(() => ({ ...defaultSimSettings(), ...applied }), [applied]);

  const [configTab, setConfigTab] = useState<OpsConfigTab>("general");
  // Cada operación nueva parte de la flota por defecto (config/simulacion.ts).
  const [fleetDraft, setFleetDraft] = useState(() => toFleetDraft(FLEET_DEFAULTS));
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  // Lo que dibuja el mapa mientras los chips de color de Vehículos o Almacenes están activos.
  const [mapFilter, setMapFilter] = useState<MapFilter>({});
  const filterMapVehicles = (ids: ReadonlySet<string> | null) => setMapFilter((f) => ({ ...f, vehicles: ids }));
  const filterMapWarehouses = (ids: ReadonlySet<string> | null) => setMapFilter((f) => ({ ...f, warehouses: ids }));
  const [orderId, setOrderId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [orderTab, setOrderTab] = useState<OrdersTab>("lista");
  const [clientDraft, setClientDraft] = useState(EMPTY_CLIENT_DRAFT);
  const [clientTab, setClientTab] = useState<ClientsTab>("lista");
  // El registro de cliente se abrió desde un pedido: al guardar se vuelve a él.
  const [clientFromOrder, setClientFromOrder] = useState(false);
  const [picking, setPicking] = useState(false);

  // Enlaces antiguos a ?panel=semaforo.
  if (panel === "semaforo" && configTab !== "semaforo") setConfigTab("semaforo");
  useEffect(() => { if (panel === "semaforo") setPanel("config"); }, [panel, setPanel]);

  const open = (p: Panel | null) => { setPicking(false); setClientFromOrder(false); setPanel(p); };

  const start = async () => {
    setStarting(true);
    const chosen = parseFleetDraft(fleetDraft);
    // La cantidad se fija en el servidor antes de iniciar (la operación carga la flota al arrancar);
    // la velocidad es propia de la operación y se envía en cuanto está en curso.
    const quantities = Object.fromEntries(KINDS.map((k) => [k, { quantity: chosen[k].quantity, speed: serverFleet.value[k].speed }])) as FleetSettings;
    if (!sameFleet(quantities, serverFleet.value)) {
      const saved = await saveFleet(quantities, serverFleet.value);
      if (!saved.ok) {
        setStarting(false);
        setConfigTab("flota");
        return toast.error(saved.message);
      }
    }
    const res = await startOperation();
    if (!res.ok) {
      setStarting(false);
      return toast.error(res.message);
    }
    const speeds = await saveOperationSpeeds(Object.fromEntries(KINDS.map((k) => [k, chosen[k].speed])) as Record<VehicleKind, number>);
    setStarting(false);
    if (!speeds.ok) toast.error(`La operación inició, pero no se aplicaron las velocidades: ${speeds.message}`);
    setFleetDraft(toFleetDraft(FLEET_DEFAULTS));
    setPanel(null);
  };

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

  // Antes de iniciar solo se ofrecen los paneles de configuración.
  const shown = panel === "semaforo" ? "config" : panel && !running && !IDLE_PANELS.includes(panel) ? null : panel;
  const toggle = (p: Panel) => open(shown === p ? null : p);
  const width = shown === "config" ? PANEL_WIDTH.wide : PANEL_WIDTH.default;
  const close = () => open(null);
  const activeBreakdowns = breakdowns.filter((b) => b.status === "activa").length;
  const selectedWarehouse = selected?.type === "warehouse" ? selected.id : null;
  // Vehículo fijado en el panel de vehículos: se resalta en el mapa aunque el panel esté cerrado.
  const [pinnedVehicle, setPinnedVehicle] = useState<string | null>(null);
  const emphasis = useMemo(
    () => {
      const vehicles = pinnedVehicle ? { vehicles: new Set([pinnedVehicle]) } : {};
      return shown === "almacenes" && selectedWarehouse ? { warehouses: new Set([selectedWarehouse]), ...vehicles } : pinnedVehicle ? vehicles : undefined;
    },
    [shown, selectedWarehouse, pinnedVehicle],
  );

  const items: RailItem<Panel>[] = running
    ? [
        { id: "config", label: "Configurar", Icon: Settings },
        { id: "vehiculos", label: "Vehículos", Icon: Truck },
        { id: "almacenes", label: "Almacenes", Icon: Warehouse },
        { id: "metricas", label: "Métricas", Icon: Activity },
        { id: "clientes", label: "Clientes", Icon: Users },
        { id: "pedidos", label: "Pedidos", Icon: Package },
        { id: "averias", label: "Averías", Icon: CircleAlert, badge: activeBreakdowns },
        { id: "datos", label: "Datos", Icon: Database },
      ]
    : [
        { id: "config", label: "Configurar", Icon: Settings },
        { id: "almacenes", label: "Almacenes", Icon: Warehouse },
        { id: "datos", label: "Datos", Icon: Database },
      ];
  const bottom: RailItem<Panel>[] = [
    { id: "ayuda", label: "Ayuda", Icon: CircleHelp },
    { id: "leyenda", label: "Leyenda", Icon: Layers },
  ];

  const shownFleet = running && opsFleet ? toFleetDraft(opsFleet) : fleetDraft;

  const panelNode =
    shown === "config" ? (
      <OpsConfigPanel
        running={running}
        loading={!cargado}
        tab={configTab}
        onTab={setConfigTab}
        fleet={shownFleet}
        onFleet={setFleetDraft}
        fleetErrors={fleetDraftErrors(shownFleet)}
        bands={bands}
        onBands={setBands}
        starting={starting}
        onStart={start}
        onClose={close}
        width={width}
      />
    )
    : shown === "vehiculos" ? (
      <VehiclesPanel scope={SCOPE} settings={settings} selectedId={selected?.type === "vehicle" ? selected.id : null} onSelect={(id) => setSelected(id ? { type: "vehicle", id } : null)} pinnedId={pinnedVehicle} onPinChange={setPinnedVehicle} onClose={close} width={width} onMapFilter={filterMapVehicles} />
    )
    : shown === "almacenes" ? (
      <WarehousesPanel scope={SCOPE} settings={settings} selectedId={selectedWarehouse} onSelect={(id) => setSelected(id ? { type: "warehouse", id } : null)} onClose={close} width={width} locked={running || !cargado} onMapFilter={filterMapWarehouses} />
    )
    : shown === "metricas" ? <MetricsPanel metrics={metrics} simulation={false} onClose={close} width={width} occupancy={<OccupancyMetrics scope={SCOPE} settings={settings} />} />
    : shown === "datos" ? <DataPanel onClose={close} width={width} locked={running || !cargado || simulationRunning} />
    : shown === "clientes" ? (
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
    : shown === "pedidos" ? (
      <OrdersPanel
        audience="operador"
        orders={orders}
        delivered={{ hours: deliveredHours, onHoursChange: setDeliveredHours, orders: deliveredOrders }}
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
    : shown === "averias" ? <BreakdownsPanel live plates={plates} recent={breakdowns} onClose={close} width={width} />
    : shown === "ayuda" ? <HelpPanel audience="operador" onClose={close} width={width} />
    : shown === "leyenda" ? <LegendPanel layers={layers} onToggle={(l, on) => setLayers((x) => ({ ...x, [l]: on }))} onClose={close} width={width} />
    : null;

  return (
    <Workspace
      map={
        <GridMap
          snapshot={snapshot}
          filter={mapFilter}
          orders={orders}
          trafficLight={trafficLight}
          vehicleBands={applied.vehicleOccupancy}
          warehouseFillBands={applied.warehouseFill}
          neutralWarehouses={!running}
          emphasis={emphasis}
          layers={layers}
          selected={selected}
          onSelect={setSelected}
          highlight={shown === "clientes" ? highlightFor(orders, null, clientDraft) : highlightFor(orders, orderId, shown === "pedidos" ? draft : undefined)}
          pickMode={picking}
          onPick={(c) => {
            const coords = { x: String(c.x), y: String(c.y) };
            if (shown === "clientes") setClientDraft((d) => ({ ...d, ...coords }));
            else setDraft((d) => ({ ...d, ...coords }));
            setPicking(false);
          }}
          onCancelPick={() => setPicking(false)}
          emptyMessage={running ? WAITING_MESSAGE : undefined}
        />
      }
      hud={
        <>
          {running && <OpsHud connection={connection} clock={clock} kpis={kpis} compact={!!shown} onOpenOrders={() => open("pedidos")} onOpenBreakdowns={() => open("averias")} />}
          {running && <ConnectionBanner state={connection} />}
          <DailyRunControl onConfigure={() => open("config")} />
        </>
      }
      panel={panelNode}
      rail={<SideRail items={items} bottomItems={bottom} active={shown} onToggle={toggle} homeHref="/operaciones" />}
    />
  );
}
