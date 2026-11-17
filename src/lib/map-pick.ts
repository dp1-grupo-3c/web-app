import { useSyncExternalStore } from "react";
import type { Coord } from "./types";

/** Pedido de elegir una intersección en el mapa desde un panel sin acceso directo a él. */
export type MapPickRequest = { key: string; label: string; onPick: (c: Coord) => void };

let current: MapPickRequest | null = null;
const listeners = new Set<() => void>();
export function setMapPick(r: MapPickRequest | null) { current = r; listeners.forEach((l) => l()); }
export const clearMapPick = () => setMapPick(null);
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useMapPick = () => useSyncExternalStore(subscribe, () => current, () => null);
