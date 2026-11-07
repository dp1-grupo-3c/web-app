import { CircleX, Flag, Hourglass, House, Package, PackageCheck, Utensils, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { PinGlyph } from "@/components/map/MapPin";
import { PINK, VEHICLE_EMPTY_COLOR, type MapLayer, type MapLayers } from "@/components/map/layers";
import { Switch } from "@/components/ui/choice";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { cn } from "@/lib/cn";
import { BREAKDOWN_COLOR, BREAKDOWN_TYPES, GRID } from "@/lib/constants";
import type { VehicleKind } from "@/lib/types";

function Item({ children, glyph }: { children: ReactNode; glyph: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 py-[5px] text-sm leading-snug text-white">
      <span className="grid w-[30px] shrink-0 place-items-center">{glyph}</span>
      <span>{children}</span>
    </li>
  );
}
const pin = (color: string, Icon: LucideIcon) => <PinGlyph color={color} Icon={Icon} />;

export function LegendPanel({ layers, onToggle, onClose, width }: { layers: MapLayers; onToggle: (layer: MapLayer, on: boolean) => void; onClose: () => void; width: number }) {
  const anyKind = VEHICLE_ORDER.some((k) => layers[k]);
  // Los tipos y el interruptor de Flota van enlazados: encender un tipo con la flota
  // apagada muestra solo ese tipo; apagar el último tipo apaga la flota.
  const setKind = (k: VehicleKind, on: boolean) => {
    if (on && !layers.flota) {
      onToggle("flota", true);
      for (const other of VEHICLE_ORDER) onToggle(other, other === k);
      return;
    }
    onToggle(k, on);
    if (!on && VEHICLE_ORDER.every((o) => o === k || !layers[o])) onToggle("flota", false);
  };
  const toggle = (layer: MapLayer, label: string) => <Switch checked={layers[layer]} onChange={(v) => onToggle(layer, v)} label={`Mostrar ${label}`} />;
  return (
    <SidePanel title="Leyenda" subtitle="Qué significa cada elemento y qué capas ver." onClose={onClose} width={width}>
      <PanelSection title="Almacenes" action={toggle("almacenes", "almacenes")}>
        <ul>
          <Item glyph={pin(PINK, House)}>Almacén principal</Item>
          <Item glyph={pin(PINK, Package)}>Almacén secundario (sin datos aún)</Item>
          <Item glyph={pin("var(--color-success)", Package)}>Verde · stock suficiente</Item>
          <Item glyph={pin("var(--color-warning)", Package)}>Ámbar · conviene reabastecer</Item>
          <Item glyph={pin("var(--color-critic)", Package)}>Rojo · nivel crítico</Item>
        </ul>
      </PanelSection>
      <PanelSection
        title="Flota"
        action={
          <Switch
            checked={layers.flota && anyKind}
            onChange={(v) => { onToggle("flota", v); for (const k of VEHICLE_ORDER) onToggle(k, v); }}
            label="Mostrar flota"
          />
        }
      >
        <ul>
          {VEHICLE_ORDER.map((k) => (
            <li key={k} className="flex items-center gap-3.5 py-[5px] text-sm leading-snug text-white">
              <span className="grid w-[30px] shrink-0 place-items-center">{pin(VEHICLE_EMPTY_COLOR, VEHICLE_META[k].Icon)}</span>
              <span className={cn("flex-1", !(layers.flota && layers[k]) && "text-n500")}>{VEHICLE_META[k].plural} (el ícono indica el tipo)</span>
              <Switch checked={layers.flota && layers[k]} onChange={(v) => setKind(k, v)} label={`Mostrar ${VEHICLE_META[k].plural.toLowerCase()}`} />
            </li>
          ))}
          <Item glyph={pin("var(--color-success)", VEHICLE_META.auto.Icon)}>Verde · ocupación baja</Item>
          <Item glyph={pin("var(--color-warning)", VEHICLE_META.auto.Icon)}>Ámbar · ocupación media</Item>
          <Item glyph={pin("var(--color-critic)", VEHICLE_META.auto.Icon)}>Rojo · ocupación alta</Item>
          <Item glyph={pin(VEHICLE_EMPTY_COLOR, VEHICLE_META.auto.Icon)}>Gris · vacío, sin carga a bordo</Item>
          {BREAKDOWN_TYPES.map((b) => (
            <Item key={b.code} glyph={<PinGlyph color={VEHICLE_EMPTY_COLOR} Icon={VEHICLE_META.auto.Icon} BadgeIcon={Wrench} badgeColor={BREAKDOWN_COLOR[b.code].color} badgeGlyph={BREAKDOWN_COLOR[b.code].glyph} />}>
              Llave {b.code === "T1" ? "ámbar" : b.code === "T2" ? "roja" : "rojo oscuro"} · avería {b.code} ({b.name.toLowerCase()}); el vehículo conserva el color de su ocupación
            </Item>
          ))}
          <Item glyph={<Utensils className="size-5 text-warning" />}>Cubiertos · pausa de alimentación</Item>
          <Item glyph={<PackageCheck className="size-5 text-success" />}>Paquete con check · pedido entregado, acondicionamiento (1 h)</Item>
          <Item glyph={<span className="rounded bg-panel px-2 text-xs">3</span>}>Vehículos agrupados en un almacén; pulsa para consultar sus estados</Item>
          <Item glyph={<svg width="20" height="20" aria-hidden><circle cx="10" cy="10" r="9" fill={VEHICLE_META.auto.color} stroke="#10161c" strokeWidth="2" /><text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#161d25">2</text></svg>}>Punto numerado · vehículos en espera fuera de un almacén, con el color de su tipo (repartido si hay varios tipos); pulsa para desplegarlos y en el mapa vacío para volver a agruparlos</Item>
        </ul>
      </PanelSection>
      <PanelSection title="Rutas" action={toggle("rutas", "rutas")}>
        <ul>
          <Item glyph={<svg width="30" height="10" aria-hidden><line x1="0" y1="5" x2="30" y2="5" stroke="#fff" strokeWidth="4" strokeDasharray="8 7" /></svg>}>Tramo por recorrer</Item>
          <Item glyph={<svg width="20" height="20" aria-hidden><circle cx="10" cy="10" r="7" fill="#fff" stroke="#161d25" strokeWidth="2.5" /></svg>}>Destino del vehículo</Item>
        </ul>
        <p className="text-xs text-n600">La ruta toma el color del tipo de vehículo que la recorre: <span style={{ color: VEHICLE_META.auto.color }}>auto</span>, <span style={{ color: VEHICLE_META.moto.color }}>moto</span> o <span style={{ color: VEHICLE_META.bicicleta.color }}>bicicleta</span>.</p>
        <p className="text-xs text-n600">Selecciona un vehículo para ver su ruta parpadear y los destinos de sus pedidos.</p>
        <ul>
          <Item glyph={pin(PINK, Package)}>Pedido asignado; la bandera señala su destino de entrega</Item>
          <Item glyph={pin("var(--color-warning)", Flag)}>Destino final del itinerario seleccionado</Item>
        </ul>
      </PanelSection>
      <PanelSection title="Bloqueos" action={toggle("bloqueos", "bloqueos")}>
        <ul>
          <Item glyph={pin("var(--color-critic)", CircleX)}>Vía bloqueada</Item>
          <Item glyph={<svg width="30" height="10" aria-hidden><line x1="3" y1="5" x2="27" y2="5" stroke="var(--color-critic)" strokeWidth="6" strokeLinecap="round" /></svg>}>Tramo sin paso</Item>
          <Item glyph={pin("var(--color-critic)", Hourglass)}>Bloqueo por terminar: parpadea en su tramo final</Item>
          <Item glyph={<svg width="30" height="10" aria-hidden><line x1="3" y1="5" x2="27" y2="5" stroke="var(--color-critic)" strokeWidth="6" strokeLinecap="round" strokeDasharray="9 8" /></svg>}>Tramo que se liberará pronto (discontinuo)</Item>
        </ul>
      </PanelSection>
      <PanelSection title="Retícula">
        <ul>
          <Item
            glyph={
              <svg width="30" height="30" aria-hidden>
                <rect x=".5" y=".5" width="29" height="29" rx="4" fill="#1e2833" stroke="#2c3845" />
                <path d="M0 10h30M0 20h30M10 0v30M20 0v30" stroke="#2c3845" />
                <circle cx="20" cy="10" r="5" fill="none" stroke="var(--color-warning)" strokeWidth="1.5" />
                <circle cx="20" cy="10" r="1.8" fill="var(--color-warning)" />
              </svg>
            }
          >
            Cada intersección es una coordenada válida (x 0–{GRID.width}, y 0–{GRID.height}). Las líneas gruesas marcan cada 10 unidades.
          </Item>
        </ul>
      </PanelSection>
    </SidePanel>
  );
}
