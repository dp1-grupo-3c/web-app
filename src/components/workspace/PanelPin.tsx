"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Controles del panel fijado: el botón de fijar y la flecha que vuelve al menú
 * de secciones. Los paneles no los reciben por props: SidePanel los lee de aquí.
 */
export type PanelPin = { pinned: boolean; onTogglePin: () => void; onBack?: () => void };

export const PanelPinContext = createContext<PanelPin | null>(null);
export const usePanelPin = () => useContext(PanelPinContext);

const KEY = "kindbox.panel.fijado";

/** Preferencia de panel fijado, recordada en este navegador. */
export function usePinnedPreference(): [boolean, (pinned: boolean) => void] {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
      setPinned(localStorage.getItem(KEY) === "1");
    } catch {
      // sin almacenamiento: el panel empieza sin fijar
    }
  }, []);
  const set = (next: boolean) => {
    setPinned(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* sin almacenamiento */ }
  };
  return [pinned, set];
}
