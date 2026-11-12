import { useEffect, useRef } from "react";

/**
 * Informa a la pantalla los ids que el mapa debe dibujar (ver idsMatching). Solo
 * avisa cuando el conjunto cambia (no con cada foto) y, al cerrarse el panel,
 * quita el filtro.
 */
export function useReportMapFilter(ids: string[] | null, report?: (ids: ReadonlySet<string> | null) => void) {
  const latest = useRef(report);
  useEffect(() => { latest.current = report; });
  const key = ids == null ? null : JSON.stringify(ids);
  useEffect(() => { latest.current?.(key == null ? null : new Set(JSON.parse(key) as string[])); }, [key]);
  useEffect(() => () => latest.current?.(null), []);
}
