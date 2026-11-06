"use client";

import { useEffect, useState } from "react";
import { defaultSimSettings, validateBands } from "@/lib/sim-settings";
import type { VehicleKind } from "@/lib/types";
import type { OccupancyBands } from "./config/OccupancyBandsEditor";

const KEY = "kindbox.operacion.semaforo";
const KINDS: VehicleKind[] = ["auto", "moto", "bicicleta"];

export const defaultOccupancyBands = (): OccupancyBands => {
  const { vehicleOccupancy, warehouseFill } = defaultSimSettings();
  return { vehicleOccupancy, warehouseFill };
};

export const invalidBands = (b: OccupancyBands) => KINDS.some((k) => !!validateBands(b.vehicleOccupancy[k])) || !!validateBands(b.warehouseFill);

/**
 * Semáforos en % de las operaciones diarias. `bands` es lo que muestra el
 * editor (puede estar a medio escribir); `applied` es el último valor válido,
 * el que colorea el mapa y se recuerda en este navegador.
 */
export function useOperacionBands(): { bands: OccupancyBands; applied: OccupancyBands; setBands: (b: OccupancyBands) => void } {
  const [bands, setDraft] = useState(defaultOccupancyBands);
  const [applied, setApplied] = useState(defaultOccupancyBands);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as OccupancyBands) : null;
      if (parsed?.vehicleOccupancy && parsed.warehouseFill && !invalidBands(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
        setDraft(parsed);
        setApplied(parsed);
      }
    } catch {
      // sin almacenamiento o valor corrupto: se usan los valores por defecto
    }
  }, []);
  const setBands = (next: OccupancyBands) => {
    setDraft(next);
    if (invalidBands(next)) return;
    setApplied(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
  };
  return { bands, applied, setBands };
}
