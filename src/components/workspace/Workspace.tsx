import type { ReactNode } from "react";

/**
 * Distribución de las pantallas con mapa: [mapa + HUD] [panel] [menú].
 * El mapa ocupa el espacio libre y se reajusta cuando se abre un panel.
 */
export function Workspace({ map, hud, panel, rail, overlay }: { map: ReactNode; hud?: ReactNode; panel?: ReactNode; rail: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="flex h-dvh min-w-[1100px] overflow-hidden bg-canvas">
      <main className="relative min-w-0 flex-1">
        {map}
        {hud && <div className="pointer-events-none absolute top-4 left-4 z-[4] flex flex-col items-start gap-3 [&>*]:pointer-events-auto">{hud}</div>}
      </main>
      {panel}
      {rail}
      {overlay}
    </div>
  );
}
