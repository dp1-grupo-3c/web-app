"use client";

import { Crosshair, House, Map as MapIcon, Package, RotateCcw, Save, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { ErrorMessage, Field, NumberInput } from "@/components/ui/form";
import { PanelSection } from "@/components/workspace/SidePanel";
import { cn } from "@/lib/cn";
import { clearMapPick, setMapPick, useMapPick } from "@/lib/map-pick";
import { obtenerMundoPorDefecto } from "@/lib/backend/api";
import type { VistaMundo } from "@/lib/backend/types";
import { useMundo } from "@/lib/data/hooks";
import { cargarMundo, guardarMundo } from "@/lib/data/mundo";
import { validateWorld, worldDraft, worldRequest, type WorldDraft } from "@/lib/validation";

/**
 * Tamaño del mapa y ubicación y capacidad de los almacenes. Se bloquea con una
 * corrida activa: el mapa define los nodos que esa corrida está usando.
 */
export function WorldEditor({ locked, part }: { locked: boolean; part: "mapa" | "almacenes" }) {
  const { vista } = useMundo();
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  // Cada vez que se abre: otra sesión pudo cambiarlo o iniciar una corrida.
  useEffect(() => { void cargarMundo(); }, []);
  if (!vista) return null;
  return (
    <>
      <Form key={vista.version} vista={vista} part={part} locked={locked || !!vista.ejecucionActiva} onSaved={setSavedVersion} />
      {savedVersion === vista.version && <Alert tone="ok" className="text-[13px]">Cambios guardados. Rigen desde la siguiente corrida.</Alert>}
    </>
  );
}

function Form({ vista, part, locked, onSaved }: { vista: VistaMundo; part: "mapa" | "almacenes"; locked: boolean; onSaved: (version: number) => void }) {
  const [draft, setDraft] = useState<WorldDraft>(() => worldDraft(vista));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pick = useMapPick();
  // Al cerrar el panel no queda el mapa esperando un clic.
  useEffect(() => clearMapPick, []);
  const errors = locked ? {} : validateWorld(draft);
  const invalid = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(worldDraft(vista));

  const change = (patch: Partial<WorldDraft>) => { setDraft((d) => ({ ...d, ...patch })); setSaveError(null); };
  const changeWarehouse = (id: number, patch: Partial<WorldDraft["warehouses"][number]>) =>
    change({ warehouses: draft.warehouses.map((w) => (w.id === id ? { ...w, ...patch } : w)) });

  // Solo rellena el borrador de la pestaña visible; se guarda con "Guardar cambios".
  const restore = async () => {
    try {
      const d = worldDraft(await obtenerMundoPorDefecto());
      change(part === "mapa" ? { width: d.width, height: d.height } : { warehouses: d.warehouses });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudieron cargar los valores por defecto.");
    }
  };

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    const r = await guardarMundo(worldRequest(draft));
    setBusy(false);
    if (r.ok) onSaved(r.data.version);
    else setSaveError(r.message);
  };

  return (
    <PanelSection title={part === "mapa" ? "Dimensiones del mapa" : "Ubicación de almacenes"} icon={part === "mapa" ? <MapIcon className="size-[18px]" aria-hidden /> : <Warehouse className="size-[18px]" aria-hidden />}>
      {locked
        ? <Alert tone="info" className="text-[13px]">Hay una corrida activa: el mapa y los almacenes se pueden editar cuando termine.</Alert>
        : <p className="text-xs leading-snug text-n500">Rige desde la siguiente corrida. Si achicas el mapa, los pedidos o bloqueos que queden fuera harán que el servidor rechace el inicio.</p>}
      {part === "mapa" && <div className="grid grid-cols-2 gap-3">
        <Field label="Largo (km, eje X)" htmlFor="w-width" error={errors.width}>
          <NumberInput id="w-width" value={draft.width} min={1} disabled={locked} error={!!errors.width} onValueChange={(width) => change({ width })} />
        </Field>
        <Field label="Ancho (km, eje Y)" htmlFor="w-height" error={errors.height}>
          <NumberInput id="w-height" value={draft.height} min={1} disabled={locked} error={!!errors.height} onValueChange={(height) => change({ height })} />
        </Field>
      </div>}
      {part === "almacenes" && draft.warehouses.map((w) => {
        const e = errors.warehouses?.[w.id];
        const choosing = pick?.key === `wh-${w.id}`;
        return (
          <div key={w.id} className={cn("grid min-w-0 gap-3 rounded-xl border bg-night p-3", e ? "border-critic" : choosing ? "border-warning" : "border-line")}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {w.central ? <House className="size-4 shrink-0 text-pink" aria-hidden /> : <Package className="size-4 shrink-0 text-n300" aria-hidden />}
              <b className="text-[13px] text-white">{w.name}</b>
              <span className="shrink-0 text-xs text-n500">{w.central ? "Central" : "Intermedio"}</span>
              {!locked && (
                <Button variant="outline" size="xs" className="ml-auto shrink-0" icon={<Crosshair className="size-4" aria-hidden />} aria-pressed={choosing}
                  onClick={() => setMapPick(choosing ? null : { key: `wh-${w.id}`, label: `Haz clic en una intersección para ubicar ${w.name}`, onPick: (c) => changeWarehouse(w.id, { x: String(c.x), y: String(c.y) }) })}>
                  {choosing ? "Eligiendo…" : "Ubicar en el mapa"}
                </Button>
              )}
            </div>
            <div className={cn("grid gap-2", w.central ? "grid-cols-2" : "grid-cols-3")}>
              <Field label="X (km)" htmlFor={`w-x-${w.id}`}>
                <NumberInput id={`w-x-${w.id}`} value={w.x} min={0} disabled={locked} error={!!e} onValueChange={(x) => changeWarehouse(w.id, { x })} />
              </Field>
              <Field label="Y (km)" htmlFor={`w-y-${w.id}`}>
                <NumberInput id={`w-y-${w.id}`} value={w.y} min={0} disabled={locked} error={!!e} onValueChange={(y) => changeWarehouse(w.id, { y })} />
              </Field>
              {!w.central && (
                <Field label="Capacidad" htmlFor={`w-c-${w.id}`}>
                  <NumberInput id={`w-c-${w.id}`} value={w.capacity} min={1} disabled={locked} error={!!e} onValueChange={(capacity) => changeWarehouse(w.id, { capacity })} />
                </Field>
              )}
            </div>
            {e && <ErrorMessage>{e}</ErrorMessage>}
          </div>
        );
      })}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<Save className="size-4" aria-hidden />} onClick={save} loading={busy} loadingText="Guardando…" disabled={!dirty || invalid}>
            Guardar cambios
          </Button>
          <Button variant="text" size="sm" icon={<RotateCcw className="size-4" aria-hidden />} onClick={restore}>
            Restaurar valores por defecto
          </Button>
        </div>
      )}
      {saveError && <Alert tone="crit" className="text-[13px]">{saveError}</Alert>}
    </PanelSection>
  );
}
