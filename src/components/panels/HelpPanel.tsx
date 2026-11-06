import { Activity, CircleAlert, CircleHelp, Database, Layers, Package, Settings, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import { Alert, Tile } from "@/components/ui/feedback";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";

type Audience = "operador" | "cliente" | "simulacion";

const ITEMS: Record<Audience, [LucideIcon, string, string][]> = {
  operador: [
    [Settings, "Configurar", "Antes de iniciar, ajusta la flota y el semáforo (%) e inicia la operación; el semáforo se puede cambiar en curso."],
    [Database, "Datos", "Revisa los archivos del servidor y sube flota, bloqueos o mantenimiento."],
    [Truck, "Vehículos", "Ocupación, carga y avance de cada vehículo (con la operación en curso)."],
    [Warehouse, "Almacenes", "Stock y ocupación de cada almacén; sin operación en curso, edita el mapa y los almacenes."],
    [Activity, "Métricas", "Revisa tiempos de entrega, costos y ocupación del día."],
    [Users, "Clientes", "Registra personas naturales (DNI) y empresas (RUC)."],
    [Package, "Pedidos", "Registra pedidos con el DNI o RUC del cliente y busca los activos."],
    [CircleAlert, "Averías", "Reporta la avería de un vehículo."],
    [Layers, "Leyenda", "Consulta los íconos y oculta capas del mapa."],
  ],
  cliente: [
    [Package, "Pedidos", "Escribe el número que te enviamos para ver dónde está tu pedido."],
    [Layers, "Leyenda", "Qué significa cada ícono y color del mapa."],
  ],
  simulacion: [
    [Settings, "Configurar", "Elige la fecha y hora de inicio, la flota, los semáforos y las averías."],
    [Database, "Datos", "Revisa los archivos del servidor y sube flota, bloqueos o mantenimiento."],
    [Truck, "Vehículos", "Ocupación, carga y avance de cada vehículo, con filtros y orden."],
    [Warehouse, "Almacenes", "Stock, ocupación y pedidos de cada almacén; sin corrida activa, edita el mapa y los almacenes."],
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
