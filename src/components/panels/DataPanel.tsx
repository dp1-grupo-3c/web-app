"use client";

import { CircleX, Database, FileText, ListChecks, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { DateInput, ErrorMessage, Field, TextInput, TimeInput } from "@/components/ui/form";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { MAX_DATA_FILE_MB } from "@/config/simulacion";
import type { InventarioDatos, VistaRegistroBloqueo } from "@/lib/backend/types";
import { GRID } from "@/lib/constants";
import { borrarBloqueo, cargarInventario, editarBloqueo, listarBloqueos, mesValido, registrarBloqueo, resumenBloqueo, resumenGuardado, subirArchivo, type DataKind } from "@/lib/data/datos";
import { formatTimeOfDay, parseTimeOfDay } from "@/lib/sim-settings";
import { blockageDraft, blockageNodes } from "@/lib/validation";

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
  // Bloqueo guardado que se está editando en el formulario, y versión para volver a listar.
  const [editing, setEditing] = useState<VistaRegistroBloqueo | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);
  // Aviso del formulario: sobrevive a que se vuelva a montar al terminar una edición.
  const [formNotice, setFormNotice] = useState<{ ok: boolean; text: string } | null>(null);
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
          <ManualBlockageSection
            key={editing ? `${editing.mes}:${editing.linea}` : "nuevo"}
            editing={editing}
            notice={formNotice}
            onCancelEdit={() => { setEditing(null); setFormNotice(null); }}
            onSaved={async (text) => { setFormNotice({ ok: true, text }); setEditing(null); setSavedVersion((n) => n + 1); await reload(); }}
          />
          <SavedBlockagesSection version={savedVersion} editing={editing} onEdit={(r) => { setFormNotice(null); setEditing(r); }} onChanged={reload} />
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
function ManualBlockageSection({ editing, notice, onCancelEdit, onSaved }: { editing: VistaRegistroBloqueo | null; notice: { ok: boolean; text: string } | null; onCancelEdit: () => void; onSaved: (text: string) => Promise<void> }) {
  // Al editar, el formulario arranca con el bloqueo guardado.
  const [draft, setDraft] = useState(() => (editing ? blockageDraft(editing) : EMPTY_BLOCKAGE));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(notice);
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
    const solicitud = { nodos: nodes, inicio: start, fin: end };
    const r = editing ? await editarBloqueo(editing, solicitud) : await registrarBloqueo(solicitud);
    setBusy(false);
    const text = r.ok ? resumenBloqueo(r.data) : r.message;
    setResult({ ok: r.ok, text });
    if (!r.ok) return;
    setDraft(EMPTY_BLOCKAGE);
    setTried(false);
    await onSaved(text);
  };

  return (
    <PanelSection title={editing ? "Editar un bloqueo" : "Registrar un bloqueo"} icon={<CircleX className="size-[18px]" aria-hidden />}>
      <p className="text-xs leading-snug text-n500">
        {editing ? `Reemplaza la línea ${editing.linea} de ${editing.archivo}; rige desde la siguiente corrida.` : "Se agrega al archivo de bloqueos del mes y rige desde la siguiente corrida."}
      </p>
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
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={submit} loading={busy} loadingText="Guardando…">{editing ? "Guardar cambios" : "Registrar bloqueo"}</Button>
        {editing && <Button variant="text" size="sm" disabled={busy} onClick={onCancelEdit}>Cancelar edición</Button>}
      </div>
      {result && <Alert tone={result.ok ? "ok" : "crit"} className="text-[13px]">{result.text}</Alert>}
    </PanelSection>
  );
}

const stamp = (t: string) => `${t.slice(8, 10)}/${t.slice(5, 7)} ${t.slice(11, 16)}`;

// Bloqueos guardados de un mes: cada uno se edita en el formulario de arriba o se borra.
function SavedBlockagesSection({ version, editing, onEdit, onChanged }: { version: number; editing: VistaRegistroBloqueo | null; onEdit: (r: VistaRegistroBloqueo) => void; onChanged: () => Promise<void> }) {
  const [month, setMonth] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [rows, setRows] = useState<VistaRegistroBloqueo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const monthError = month.trim() && !mesValido(month) ? "Escribe el mes como AAAA-MM, por ejemplo 2026-09." : null;

  const consult = useCallback(async (mes: string) => {
    setBusy(true);
    const r = await listarBloqueos(mes);
    setBusy(false);
    setConfirm(null);
    setShown(mes);
    setRows(r.ok ? r.data : null);
    if (!r.ok) setResult({ ok: false, text: r.message });
  }, []);

  // Tras guardar una edición se vuelve a listar el mes mostrado.
  useEffect(() => {
    if (!shown || version === 0) return;
    let vivo = true;
    listarBloqueos(shown).then((r) => {
      if (!vivo) return;
      setConfirm(null);
      setRows(r.ok ? r.data : null);
    });
    return () => { vivo = false; };
    // Solo cuando cambia la versión, no el mes mostrado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const remove = async (r: VistaRegistroBloqueo) => {
    setBusy(true);
    const res = await borrarBloqueo(r);
    setBusy(false);
    setResult(res.ok ? { ok: true, text: `Bloqueo borrado de ${res.data.ruta}; quedan ${res.data.registros}.` } : { ok: false, text: res.message });
    if (res.ok) {
      await consult(r.mes);
      await onChanged();
    }
  };

  return (
    <PanelSection title="Bloqueos guardados" icon={<ListChecks className="size-[18px]" aria-hidden />}>
      <p className="text-xs leading-snug text-n500">Consulta los bloqueos de un mes para editarlos o borrarlos. Un bloqueo que cruzó de mes quedó partido en un registro por mes.</p>
      <div className="flex items-end gap-2">
        <Field label="Mes" htmlFor="bq-list-month" error={monthError}>
          <TextInput id="bq-list-month" value={month} placeholder="AAAA-MM" maxLength={7} error={!!monthError} onChange={(e) => { setMonth(e.target.value); setResult(null); }} />
        </Field>
        <Button variant="outline" size="sm" loading={busy} disabled={!month.trim() || !!monthError} onClick={() => { setResult(null); void consult(month.trim()); }}>Consultar</Button>
      </div>
      {result && <Alert tone={result.ok ? "ok" : "crit"} className="text-[13px]">{result.text}</Alert>}
      {rows && shown && (rows.length === 0 ? (
        <p className="text-sm text-n500">{shown} no tiene bloqueos guardados.</p>
      ) : (
        <>
          <p className="text-xs text-n500" aria-live="polite">{rows.length} bloqueos en {rows[0].archivo}</p>
          <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-lg bg-night p-2 text-xs" aria-label={`Bloqueos de ${shown}`}>
            {rows.map((r) => (
              <li key={r.linea} className={`grid gap-1 rounded-md px-2 py-1.5 ${editing?.linea === r.linea && editing.mes === r.mes ? "bg-pink/10" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white tabular-nums">{stamp(r.inicio)} → {stamp(r.fin)}</span>
                  <span className="text-n500">línea {r.linea}</span>
                </div>
                <span className="truncate text-n300" title={r.registro}>{r.nodos.map((n) => `${n.x},${n.y}`).join(" ")}</span>
                {confirm === r.linea ? (
                  <div className="flex items-center gap-2">
                    <span className="text-n200">¿Borrar este bloqueo?</span>
                    <Button size="xs" variant="outline" disabled={busy} onClick={() => setConfirm(null)}>No</Button>
                    <Button size="xs" variant="danger" loading={busy} onClick={() => void remove(r)}>Borrar</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" disabled={busy} onClick={() => onEdit(r)}>Editar</Button>
                    <Button size="xs" variant="text" disabled={busy} onClick={() => setConfirm(r.linea)}>Borrar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      ))}
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
