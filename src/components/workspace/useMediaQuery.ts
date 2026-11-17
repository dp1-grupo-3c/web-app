"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Ancho de escritorio: desde aquí el panel puede fijarse y el HUD se muestra completo. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
/** Ancho de tablet: por debajo, diseño de teléfono (el panel cubre todo el mapa). */
export const TABLET_QUERY = "(min-width: 768px)";

/** true mientras la media query se cumple (en el servidor, false). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);
}
