import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Distribución de las pantallas con mapa: [mapa + HUD] [panel] [menú].
 * Con el panel acoplado (por defecto, o fijado), el mapa ocupa el espacio libre
 * y se reajusta al abrirlo; con `panelFloating`, el panel flota sobre el mapa.
 */
export function Workspace({ map, hud, panel, panelFloating = false, rail, overlay }: { map: ReactNode; hud?: ReactNode; panel?: ReactNode; panelFloating?: boolean; rail: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas md:flex-row">
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {map}
          {hud && <div className="pointer-events-none absolute top-2 right-2 left-2 z-[4] flex flex-col items-start gap-3 md:top-4 md:right-auto md:left-4 md:max-w-[calc(100%-32px)] [&>*]:pointer-events-auto">{hud}</div>}
        </main>
        {/* En teléfono el panel cubre el mapa; en tablet flota a la derecha; acoplado solo en escritorio. */}
        {panel && <div className={cn("absolute inset-0 z-[6] flex justify-end md:left-auto", !panelFloating && "lg:static")}>{panel}</div>}
      </div>
      {rail}
      {overlay}
    </div>
  );
}
