"use client";

import { CircleCheck, FileText, Upload, Wrench, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { Button, IconButton } from "@/components/ui/Button";
import { RadioCardGroup, SegmentedControl } from "@/components/ui/choice";
import { Badge, EmptyState, Tile } from "@/components/ui/feedback";
import { ErrorMessage, Field, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { PanelSection, SidePanel } from "@/components/workspace/SidePanel";
import { cn } from "@/lib/cn";
import { BREAKDOWN_TYPES, breakdownInfo } from "@/lib/constants";
import { registerBreakdown, uploadBreakdownFile } from "@/lib/data/actions";
import type { BreakdownRecord, BreakdownType, VehiclePlates } from "@/lib/types";

const MAX_FILE_MB = 5;
const ACCEPTED = /\.(txt|csv)$/i;

type Props = { plates: VehiclePlates; recent: BreakdownRecord[]; onClose: () => void; width: number };

export function BreakdownsPanel({ plates, recent, onClose, width }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<"individual" | "masiva">("individual");
  const [plate, setPlate] = useState("");
  const [type, setType] = useState<BreakdownType | "">("");
  const [errors, setErrors] = useState<{ plate?: string; type?: string }>({});
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noPlates = VEHICLE_ORDER.every((k) => plates[k].length === 0);

  const submitOne = async () => {
    const e = { plate: plate ? undefined : "Elige la placa del vehículo.", type: type ? undefined : "Elige el tipo de avería." };
    setErrors(e);
    if (e.plate || e.type) return;
    setBusy(true);
    const res = await registerBreakdown({ plate, type: type as BreakdownType });
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(`Registramos la avería ${type} de ${plate}. Sus pedidos se reasignarán automáticamente.`);
    setPlate("");
    setType("");
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPTED.test(f.name)) { setFile(null); setFileError("No podemos leer ese formato. Usa un archivo .txt o .csv."); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setFile(null); setFileError(`El archivo supera los ${MAX_FILE_MB} MB. Divídelo e inténtalo nuevamente.`); return; }
    setFileError(null);
    setFile(f);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); };

  const submitFile = async () => {
    if (!file) return;
    setBusy(true);
    const res = await uploadBreakdownFile(file);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(res.data?.registered != null ? `¡Listo! Registramos ${res.data.registered} averías correctamente.` : "¡Listo! Recibimos el archivo correctamente.");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <SidePanel
      title="Averías"
      subtitle="Reporta averías de la flota."
      onClose={onClose}
      width={width}
      footer={
        tab === "individual" ? (
          <Button block onClick={submitOne} loading={busy} loadingText="Registrando…" disabled={noPlates}>Registrar avería</Button>
        ) : (
          <Button block onClick={submitFile} loading={busy} loadingText="Enviando…" disabled={!file}>Enviar archivo</Button>
        )
      }
    >
      <SegmentedControl label="Tipo de registro" value={tab} onChange={setTab} options={[{ value: "individual", label: "Individual" }, { value: "masiva", label: "Carga masiva" }]} />

      {tab === "individual" ? (
        <PanelSection title="Nueva avería" icon={<Wrench className="size-[18px]" aria-hidden />}>
          <Field label="Vehículo" htmlFor="b-plate" required error={errors.plate} help={noPlates ? "Aún no recibimos la lista de vehículos del servidor." : undefined}>
            <Select id="b-plate" value={plate} disabled={noPlates} error={!!errors.plate} onChange={(e) => { setPlate(e.target.value); setErrors((x) => ({ ...x, plate: undefined })); }}>
              <option value="">{noPlates ? "No hay vehículos disponibles" : "Selecciona la placa"}</option>
              {VEHICLE_ORDER.filter((k) => plates[k].length).map((k) => (
                <optgroup key={k} label={VEHICLE_META[k].plural}>
                  {plates[k].map((p) => <option key={p}>{p}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de avería" required>
            <RadioCardGroup
              name="b-type"
              label="Tipo de avería"
              invalid={!!errors.type}
              value={type}
              onChange={(t) => { setType(t); setErrors((x) => ({ ...x, type: undefined })); }}
              options={BREAKDOWN_TYPES.map((b) => ({ value: b.code, title: `${b.code} · ${b.name}`, description: b.description }))}
            />
            {errors.type && <ErrorMessage>{errors.type}</ErrorMessage>}
          </Field>
        </PanelSection>
      ) : (
        <PanelSection title="Carga masiva" icon={<Upload className="size-[18px]" aria-hidden />}>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed px-4 py-7 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-warning",
              dragOver ? "border-pink bg-pink/5" : "border-line-strong hover:border-pink hover:bg-pink/5",
            )}
          >
            <Upload className="size-7 text-pink" aria-hidden />
            <b className="text-white">Arrastra tu archivo aquí</b>
            <span className="text-sm text-n400">o haz clic para elegirlo · .txt o .csv, hasta {MAX_FILE_MB} MB</span>
            <input ref={inputRef} type="file" accept=".txt,.csv" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          {fileError && <ErrorMessage>{fileError}</ErrorMessage>}
          {file && (
            <div className="flex items-center gap-3 rounded-[10px] border border-line-strong bg-night px-3 py-2.5">
              <FileText className="size-[22px] shrink-0 text-pink" aria-hidden />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm font-semibold text-white">{file.name}</b>
                <small className="text-xs text-n500">{(file.size / 1024).toFixed(1)} KB · listo para enviar</small>
              </div>
              <IconButton label="Quitar archivo" size="sm" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}><X className="size-4" /></IconButton>
            </div>
          )}
        </PanelSection>
      )}

      <PanelSection title="Averías recientes" action={recent.some((r) => r.status === "activa") && <Badge tone="crit">{recent.filter((r) => r.status === "activa").length} activas</Badge>}>
        {recent.length === 0 ? (
          <EmptyState icon={<Wrench className="size-7" aria-hidden />} title="Sin averías registradas" className="py-4">Cuando se registre una avería, la verás aquí.</EmptyState>
        ) : (
          <ul>
            {recent.map((r) => {
              const { Icon } = VEHICLE_META[r.vehicleKind];
              const active = r.status === "activa";
              return (
                <li key={r.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <Tile color={active ? "var(--color-critic)" : "var(--color-n300)"}><Icon className="size-5" aria-hidden /></Tile>
                  <div className="min-w-0 flex-1">
                    <b className="block text-sm font-semibold text-white">{r.plate} · {breakdownInfo(r.type).name} ({r.type})</b>
                    <small className="block text-xs text-n500">{r.when}{r.reassignedOrders ? ` · ${r.reassignedOrders} pedidos reasignados` : ""}</small>
                  </div>
                  {active ? <Badge tone="crit">Activa</Badge> : <Badge tone="ok"><CircleCheck className="size-3" aria-hidden /> Resuelta</Badge>}
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>
    </SidePanel>
  );
}
