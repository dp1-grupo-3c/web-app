import { Activity, CircleAlert, CircleHelp, Layers, Package, Settings, SlidersVertical, type LucideIcon } from "lucide-react";
import { Alert, Tile } from "@/components/ui/feedback";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";

type Audience = "operador" | "cliente" | "simulacion";

const ITEMS: Record<Audience, [LucideIcon, string, string][]> = {
  operador: [
    [SlidersVertical, "Semáforo", "Ajusta los rangos de ocupación de los almacenes."],
    [Activity, "Métricas", "Revisa tiempos de entrega y costos del día."],
    [Package, "Pedidos", "Registra pedidos y busca los activos."],
    [CircleAlert, "Averías", "Reporta una avería o varias con un archivo."],
    [Layers, "Leyenda", "Consulta los íconos y oculta capas del mapa."],
  ],
  cliente: [
    [Package, "Pedidos", "Escribe el número que te enviamos para ver dónde está tu pedido."],
    [Layers, "Leyenda", "Qué significa cada ícono y color del mapa."],
  ],
  simulacion: [
    [Settings, "Configurar", "Elige la fecha de inicio y los rangos del semáforo."],
    [Activity, "Métricas", "Indicadores acumulados de la simulación."],
    [Package, "Pedidos", "Pedidos activos dentro de la simulación."],
    [CircleAlert, "Averías", "Registra averías para ver cómo reacciona la flota."],
    [Layers, "Leyenda", "Consulta los íconos y oculta capas del mapa."],
  ],
};

export function HelpPanel({ audience, onClose, width }: { audience: Audience; onClose: () => void; width: number }) {
  return (
    <SidePanel title="Ayuda" subtitle="Guía rápida de la pantalla." onClose={onClose} width={width}>
      <ul>
        {ITEMS[audience].map(([Icon, title, text]) => (
          <li key={title} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
            <Tile color="var(--color-pink)"><Icon className="size-5" aria-hidden /></Tile>
            <div><b className="block text-sm font-semibold text-white">{title}</b><small className="block text-xs text-n500">{text}</small></div>
          </li>
        ))}
      </ul>
      <PanelSection title="En el mapa">
        <dl className="grid gap-2 text-sm">
          {[["Arrastra", "para moverte por la retícula"], ["Rueda del mouse o + / −", "para acercar o alejar"], ["Clic en un marcador", "para ver su detalle"], ["Esc", "cierra ventanas y cancela la selección de punto"]].map(([k, v]) => (
            <div key={k}><dt className="inline font-semibold text-white">{k}</dt> <dd className="inline text-n400">{v}</dd></div>
          ))}
        </dl>
      </PanelSection>
      <Alert tone="info" icon={<CircleHelp className="size-5" aria-hidden />}>¿Algo no funciona como esperabas? Escríbenos a soporte y te respondemos lo antes posible.</Alert>
    </SidePanel>
  );
}
