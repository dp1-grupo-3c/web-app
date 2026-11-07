"use client";

import { CircleX, Database, FileText, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { DateInput, ErrorMessage, Field, TextInput, TimeInput } from "@/components/ui/form";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { MAX_DATA_FILE_MB } from "@/config/simulacion";
import type { InventarioDatos } from "@/lib/backend/types";
import { GRID } from "@/lib/constants";
import { cargarInventario, mesValido, registrarBloqueo, resumenBloqueo, resumenGuardado, subirArchivo, type DataKind } from "@/lib/data/datos";
import { formatTimeOfDay, parseTimeOfDay } from "@/lib/sim-settings";
import { blockageNodes } from "@/lib/validation";

/**
 * Archivos de datos del servidor. Cada carga se valida allí antes de guardarse
 * y rige desde la siguiente corrida; un archivo inválido no reemplaza al vigente.
 */
/**
 * Inventario de archivos y cargas. Los datos solo se cargan antes de los escenarios:
 * con `locked` (hay una corrida u operación en curso) se ven los archivos, pero no se
 * pueden subir ni registrar bloqueos. El servidor también lo rechaza.
 */
export function DataPanel({ onClose, width, locked = false }: { onClose: () => void; width: number; locked?: boolean }) {
  const [inventory, setInventory] = useState<InventarioDatos | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reload = useCallback(() => cargarInventario().then((r) => {
    setInventory(r.ok ? r.data : null);
    setLoadError(r.ok ? null : r.message);
  }), []);
  useEffect(() => {
    cargarInventario().then((r) => {
      setInventory(r.ok ? r.data : null);
      setLoadError(r.ok ? null : r.message);
    });
  }, []);

  return (
    <SidePanel title="Datos" subtitle="Archivos que usa el servidor para cada corrida." onClose={onClose} width={width}>
      <PanelSection
        title="Archivos cargados"
        icon={<Database className="size-[18px]" aria-hidden />}
        action={<Button variant="outline" size="xs" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => void reload()}>Actualizar</Button>}
      >
        {loadError && <Alert tone="crit">{loadError}</Alert>}
        {!inventory && !loadError && <p className="text-sm text-n500">Consultando al servidor…</p>}
        {inventory && (
          <div className="grid gap-1">
            <FileGroup title="Flota" files={inventory.flota ? [inventory.flota] : []} empty="Sin archivo: se usa la flota del enunciado." />
            <FileGroup title="Ventas" files={inventory.ventas} empty="Sin archivos." />
            <FileGroup title="Bloqueos" files={inventory.bloqueos} empty="Sin archivos." />
            <FileGroup title="Mantenimiento" files={inventory.mantenimiento} empty="Sin archivos." />
          </div>
        )}
      </PanelSection>
      {locked ? (
        <Alert tone="info">Hay un escenario en curso. Los datos solo se pueden cargar antes de comenzar: detén o espera a que termine la corrida para subir archivos o registrar bloqueos.</Alert>
      ) : (
        <>
          <UploadSection kind="flota" title="Subir flota" help="Reemplaza flota.txt." onSaved={reload} />
          <UploadSection kind="bloqueos" title="Subir bloqueos" help="Reemplaza el archivo de ese mes. Formato: ##d##h##m-##d##h##m:x1,y1,x2,y2,…" onSaved={reload} withMonth />
          <ManualBlockageSection onSaved={reload} />
          <UploadSection kind="mantenimiento" title="Subir mantenimiento" help="El archivo debe llamarse mant.preventivo.m1.m2, por ejemplo mant.preventivo.09.10." onSaved={reload} />
        </>
      )}
    </SidePanel>
  );
}

function FileGroup({ title, files, empty }: { title: string; files: string[]; empty: ReactNode }) {
  if (files.length <= 1) {
    return (
      <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
        <span className="text-n500">{title}</span>
        <span className="truncate text-right text-white">{files[0] ?? empty}</span>
      </div>
    );
  }
  return (
    <details className="py-1 text-sm">
      <summary className="flex cursor-pointer items-baseline justify-between gap-3">
        <span className="text-n500">{title}</span>
        <span className="text-white tabular-nums">{files.length} archivos</span>
      </summary>
      <ul className="mt-1.5 grid max-h-44 gap-0.5 overflow-y-auto rounded-lg bg-night px-3 py-2 text-xs text-n200">
        {files.map((f) => <li key={f} className="truncate">{f}</li>)}
      </ul>
    </details>
  );
}

const EMPTY_BLOCKAGE = { nodes: "", startDate: "", startTime: "", endDate: "", endTime: "" };

/** "2026-09-02" y "10:30" → "2026-09-02T10:30"; null si falta la fecha o la hora no es válida. */
function dateTime(date: string, time: string) {
  const minutes = parseTimeOfDay(time);
  return date && minutes != null ? `${date}T${formatTimeOfDay(minutes)}` : null;
}

/** Registra un bloqueo sin subir un archivo: se agrega al archivo del mes en el servidor. */
function ManualBlockageSection({ onSaved }: { onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(EMPTY_BLOCKAGE);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const change = (patch: Partial<typeof EMPTY_BLOCKAGE>) => { setDraft((d) => ({ ...d, ...patch })); setResult(null); };

  const { nodes, error: nodesError } = blockageNodes(draft.nodes, GRID);
  const start = dateTime(draft.startDate, draft.startTime);
  const end = dateTime(draft.endDate, draft.endTime);
  const startError = start ? null : "Indica la fecha y la hora (hh:mm) de inicio.";
  const endError = !end ? "Indica la fecha y la hora (hh:mm) de fin." : start && end <= start ? "El fin debe ser posterior al inicio." : null;

  const submit = async () => {
    setTried(true);
    if (nodesError || startError || endError || !start || !end) return;
    setBusy(true);
    const r = await registrarBloqueo({ nodos: nodes, inicio: start, fin: end });
    setBusy(false);
    setResult(r.ok ? { ok: true, text: resumenBloqueo(r.data) } : { ok: false, text: r.message });
    if (!r.ok) return;
    setDraft(EMPTY_BLOCKAGE);
    setTried(false);
    await onSaved();
  };

  return (
    <PanelSection title="Registrar un bloqueo" icon={<CircleX className="size-[18px]" aria-hidden />}>
      <p className="text-xs leading-snug text-n500">Se agrega al archivo de bloqueos del mes y rige desde la siguiente corrida.</p>
      <Field label="Nodos del tramo" htmlFor="bq-nodes" required error={tried ? nodesError : null} help={`Cada nodo como x,y separados por espacios, por ejemplo 12,20 13,20 13,25. X de 0 a ${GRID.width} e Y de 0 a ${GRID.height}.`}>
        <TextInput id="bq-nodes" value={draft.nodes} error={tried && !!nodesError} onChange={(e) => change({ nodes: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de inicio" htmlFor="bq-start" required error={tried ? startError : null}>
          <DateInput id="bq-start" value={draft.startDate} error={tried && !!startError} onChange={(v) => change({ startDate: v })} />
        </Field>
        <Field label="Hora de inicio" htmlFor="bq-start-time" required>
          <TimeInput id="bq-start-time" value={draft.startTime} error={tried && !!startError} onChange={(v) => change({ startTime: v })} />
        </Field>
        <Field label="Fecha de fin" htmlFor="bq-end" required error={tried ? endError : null}>
          <DateInput id="bq-end" value={draft.endDate} error={tried && !!endError} onChange={(v) => change({ endDate: v })} />
        </Field>
        <Field label="Hora de fin" htmlFor="bq-end-time" required>
          <TimeInput id="bq-end-time" value={draft.endTime} error={tried && !!endError} onChange={(v) => change({ endTime: v })} />
        </Field>
      </div>
      <Button variant="outline" size="sm" onClick={submit} loading={busy} loadingText="Guardando…">Registrar bloqueo</Button>
      {result && <Alert tone={result.ok ? "ok" : "crit"} className="text-[13px]">{result.text}</Alert>}
    </PanelSection>
  );
}

function UploadSection({ kind, title, help, onSaved, withMonth }: { kind: DataKind; title: string; help: string; onSaved: () => Promise<void>; withMonth?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const tooBig = !!file && file.size > MAX_DATA_FILE_MB * 1024 * 1024;
  const monthError = withMonth && !mesValido(month) ? "Escribe el mes como AAAA-MM, por ejemplo 2026-09." : null;

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const r = await subirArchivo(kind, file, month.trim() || undefined);
    setBusy(false);
    setResult(r.ok ? { ok: true, text: resumenGuardado(r.data) } : { ok: false, text: r.message });
    if (!r.ok) return;
    setFile(null);
    setMonth("");
    if (inputRef.current) inputRef.current.value = "";
    await onSaved();
  };

  return (
    <PanelSection title={title} icon={<Upload className="size-[18px]" aria-hidden />}>
      <p className="text-xs leading-snug text-n500">{help}</p>
      <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-line-strong bg-night px-3 py-2.5 hover:border-pink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-warning">
        <FileText className="size-5 shrink-0 text-pink" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-white">{file ? file.name : "Elegir archivo"}</span>
        {file && <small className="shrink-0 text-xs text-n500">{(file.size / 1024).toFixed(1)} KB</small>}
        <input ref={inputRef} type="file" aria-label={title} className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
      </label>
      {tooBig && <ErrorMessage>{`El archivo supera ${MAX_DATA_FILE_MB} MB, el máximo que acepta el servidor.`}</ErrorMessage>}
      {withMonth && (
        <Field label="Mes (opcional)" htmlFor={`mes-${kind}`} error={monthError} help="Solo si el nombre del archivo no lo indica.">
          <TextInput id={`mes-${kind}`} value={month} placeholder="AAAA-MM" maxLength={7} error={!!monthError} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      )}
      <Button variant="outline" size="sm" onClick={submit} loading={busy} loadingText="Validando…" disabled={!file || tooBig || !!monthError}>Validar y guardar</Button>
      {result && <Alert tone={result.ok ? "ok" : "crit"} className="text-[13px]">{result.text}</Alert>}
    </PanelSection>
  );
}
