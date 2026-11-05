"use client";

import { Database, FileText, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/feedback";
import { ErrorMessage, Field, TextInput } from "@/components/ui/form";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { MAX_DATA_FILE_MB } from "@/config/simulacion";
import type { InventarioDatos } from "@/lib/backend/types";
import { cargarInventario, mesValido, resumenGuardado, subirArchivo, type DataKind } from "@/lib/data/datos";

/**
 * Archivos de datos del servidor. Cada carga se valida allí antes de guardarse
 * y rige desde la siguiente corrida; un archivo inválido no reemplaza al vigente.
 */
export function DataPanel({ onClose, width }: { onClose: () => void; width: number }) {
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
      <UploadSection kind="flota" title="Subir flota" help="Reemplaza flota.txt. No se puede con una corrida en curso." onSaved={reload} />
      <UploadSection kind="bloqueos" title="Subir bloqueos" help="Reemplaza el archivo de ese mes. Formato: ##d##h##m-##d##h##m:x1,y1,x2,y2,…" onSaved={reload} withMonth />
      <UploadSection kind="mantenimiento" title="Subir mantenimiento" help="El archivo debe llamarse mant.preventivo.m1.m2, por ejemplo mant.preventivo.09.10." onSaved={reload} />
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
