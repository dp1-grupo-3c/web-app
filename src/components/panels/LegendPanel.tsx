import { CircleX, Flag, Hourglass, House, Package, Utensils, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { PinGlyph } from "@/components/map/MapPin";
import { PINK, type MapLayer, type MapLayers } from "@/components/map/layers";
import { Switch } from "@/components/ui/choice";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { GRID } from "@/lib/constants";

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
      <PanelSection title="Flota" action={toggle("flota", "flota")}>
        <ul>
          {VEHICLE_ORDER.map((k) => <Item key={k} glyph={pin(VEHICLE_META[k].color, VEHICLE_META[k].Icon)}>{VEHICLE_META[k].label}</Item>)}
          <Item glyph={pin("var(--color-critic)", VEHICLE_META.auto.Icon)}>Vehículo averiado (cualquier tipo)</Item>
          <Item glyph={<Utensils className="size-5 text-warning" />}>Cubiertos · pausa de alimentación</Item>
          <Item glyph={<span className="rounded bg-panel px-2 text-xs">3</span>}>Vehículos agrupados en un almacén; pulsa para consultar sus estados</Item>
        </ul>
      </PanelSection>
      <PanelSection title="Rutas" action={toggle("rutas", "rutas")}>
        <ul>
          <Item glyph={<svg width="30" height="10" aria-hidden><line x1="0" y1="5" x2="30" y2="5" stroke="#fff" strokeWidth="4" strokeDasharray="8 7" /></svg>}>Tramo por recorrer</Item>
          <Item glyph={<svg width="20" height="20" aria-hidden><circle cx="10" cy="10" r="7" fill="#fff" stroke="#161d25" strokeWidth="2.5" /></svg>}>Destino del vehículo</Item>
        </ul>
        <p className="text-xs text-n600">La ruta toma el color del vehículo que la recorre.</p>
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
