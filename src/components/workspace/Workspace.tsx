import type { ReactNode } from "react";

/**
 * Distribución de las pantallas con mapa: [mapa + HUD] [panel] [menú].
 * Con el panel acoplado (por defecto, o fijado), el mapa ocupa el espacio libre
 * y se reajusta al abrirlo; con `panelFloating`, el panel flota sobre el mapa.
 */
export function Workspace({ map, hud, panel, panelFloating = false, rail, overlay }: { map: ReactNode; hud?: ReactNode; panel?: ReactNode; panelFloating?: boolean; rail: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="flex h-dvh min-w-[1100px] overflow-hidden bg-canvas">
      <div className="relative flex min-w-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {map}
          {hud && <div className="pointer-events-none absolute top-4 left-4 z-[4] flex flex-col items-start gap-3 [&>*]:pointer-events-auto">{hud}</div>}
        </main>
        {panel && (panelFloating ? <div className="absolute inset-y-0 right-0 z-[6] flex">{panel}</div> : panel)}
      </div>
      {rail}
      {overlay}
    </div>
  );
}
