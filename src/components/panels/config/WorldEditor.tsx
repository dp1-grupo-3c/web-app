"use client";

import { Map as MapIcon, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { ErrorMessage, Field, NumberInput } from "@/components/ui/form";
import { PanelSection } from "@/components/workspace/SidePanel";
import type { VistaMundo } from "@/lib/backend/types";
import { useMundo } from "@/lib/data/hooks";
import { cargarMundo, guardarMundo } from "@/lib/data/mundo";
import { validateWorld, worldDraft, worldRequest, type WorldDraft } from "@/lib/validation";

/**
 * Tamaño del mapa y ubicación y capacidad de los almacenes. Se bloquea con una
 * corrida activa: el mapa define los nodos que esa corrida está usando.
 */
export function WorldEditor({ locked }: { locked: boolean }) {
  const { vista } = useMundo();
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  // Cada vez que se abre: otra sesión pudo cambiarlo o iniciar una corrida.
  useEffect(() => { void cargarMundo(); }, []);
  if (!vista) return null;
  return (
    <>
      <Form key={vista.version} vista={vista} locked={locked || !!vista.ejecucionActiva} onSaved={setSavedVersion} />
      {savedVersion === vista.version && <Alert tone="ok" className="text-[13px]">Cambios guardados. Rigen desde la siguiente corrida.</Alert>}
    </>
  );
}

function Form({ vista, locked, onSaved }: { vista: VistaMundo; locked: boolean; onSaved: (version: number) => void }) {
  const [draft, setDraft] = useState<WorldDraft>(() => worldDraft(vista));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const errors = locked ? {} : validateWorld(draft);
  const invalid = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(worldDraft(vista));

  const change = (patch: Partial<WorldDraft>) => { setDraft((d) => ({ ...d, ...patch })); setSaveError(null); };
  const changeWarehouse = (id: number, patch: Partial<WorldDraft["warehouses"][number]>) =>
    change({ warehouses: draft.warehouses.map((w) => (w.id === id ? { ...w, ...patch } : w)) });

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    const r = await guardarMundo(worldRequest(draft));
    setBusy(false);
    if (r.ok) onSaved(r.data.version);
    else setSaveError(r.message);
  };

  return (
    <PanelSection title="Mapa y almacenes" icon={<MapIcon className="size-[18px]" aria-hidden />}>
      {locked
        ? <Alert tone="info" className="text-[13px]">Hay una corrida activa: el mapa y los almacenes se pueden editar cuando termine.</Alert>
        : <p className="text-xs leading-snug text-n500">Rige desde la siguiente corrida. Si achicas el mapa, los pedidos o bloqueos que queden fuera harán que el servidor rechace el inicio.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Largo (km, eje X)" htmlFor="w-width" error={errors.width}>
          <NumberInput id="w-width" value={draft.width} min={1} disabled={locked} error={!!errors.width} onValueChange={(width) => change({ width })} />
        </Field>
        <Field label="Ancho (km, eje Y)" htmlFor="w-height" error={errors.height}>
          <NumberInput id="w-height" value={draft.height} min={1} disabled={locked} error={!!errors.height} onValueChange={(height) => change({ height })} />
        </Field>
      </div>
      {draft.warehouses.map((w) => {
        const e = errors.warehouses?.[w.id];
        return (
          <fieldset key={w.id} className="grid min-w-0 gap-2 rounded-xl border border-line bg-night p-3">
            <legend className="px-1 text-[13px] font-semibold text-white">{w.name}</legend>
            <div className="grid grid-cols-3 gap-2">
              <Field label="X" htmlFor={`w-x-${w.id}`}>
                <NumberInput id={`w-x-${w.id}`} value={w.x} min={0} disabled={locked} error={!!e} onValueChange={(x) => changeWarehouse(w.id, { x })} />
              </Field>
              <Field label="Y" htmlFor={`w-y-${w.id}`}>
                <NumberInput id={`w-y-${w.id}`} value={w.y} min={0} disabled={locked} error={!!e} onValueChange={(y) => changeWarehouse(w.id, { y })} />
              </Field>
              {!w.central && (
                <Field label="Capacidad" htmlFor={`w-c-${w.id}`}>
                  <NumberInput id={`w-c-${w.id}`} value={w.capacity} min={1} disabled={locked} error={!!e} onValueChange={(capacity) => changeWarehouse(w.id, { capacity })} />
                </Field>
              )}
            </div>
            {e && <ErrorMessage>{e}</ErrorMessage>}
          </fieldset>
        );
      })}
      {!locked && (
        <Button variant="outline" size="sm" icon={<Save className="size-4" aria-hidden />} onClick={save} loading={busy} loadingText="Guardando…" disabled={!dirty || invalid}>
          Guardar cambios
        </Button>
      )}
      {saveError && <Alert tone="crit" className="text-[13px]">{saveError}</Alert>}
    </PanelSection>
  );
}
