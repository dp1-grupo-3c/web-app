"use client";

import { ChevronDown, ChevronUp, CircleAlert, Search, X } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { formatDate, parseISODate } from "@/lib/format";
import { calendarDate, isoFromParts } from "@/lib/validation";

export const fieldClass = (error?: boolean) =>
  cn(
    "h-10 w-full rounded-lg border bg-field px-3 text-base text-white outline-none transition-[border-color,box-shadow] placeholder:text-n800",
    "hover:border-n900 focus:border-warning focus:shadow-[0_0_0_3px_rgb(253_192_69/0.16)]",
    "disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-n600",
    error ? "border-critic" : "border-line-strong",
  );

export function ErrorMessage({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} role="alert" className="flex items-center gap-2 rounded-lg bg-critic/12 px-2.5 py-2 text-xs leading-snug text-[#ff8fae]">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Etiqueta (Medium 14) + control + mensaje de error o ayuda. */
export function Field({ label, htmlFor, required, error, help, children, className }: FieldProps) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor} className="text-sm leading-none font-medium text-n50">
        {label} {required && <span className="text-critic">*</span>}
      </Label>
      {children}
      {error ? <ErrorMessage>{error}</ErrorMessage> : help ? <p className="text-xs leading-snug text-n600">{help}</p> : null}
    </div>
  );
}

export function TextInput({ error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...rest} aria-invalid={error || undefined} className={cn(fieldClass(error), className)} />;
}

type DateInputProps = {
  id?: string;
  /** Fecha en ISO ("YYYY-MM-DD"), o "" si está vacía. */
  value: string;
  /**
   * Recibe la fecha ISO, o "" si el campo está vacío, incompleto o no es una
   * fecha real; en esos dos últimos casos `problem` explica por qué.
   */
  onChange: (value: string, problem: string | null) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
};

/**
 * Fecha en formato peruano (dd/mm/aaaa), sin depender del idioma del
 * navegador: el `<input type="date">` nativo muestra el orden de fecha del
 * sistema operativo o del navegador (a menudo mm/dd/aaaa en inglés) y la
 * página no puede forzarlo, así que se reemplaza por un campo de texto con
 * máscara propia.
 */
export function DateInput({ id, value, onChange, disabled, error, className }: DateInputProps) {
  const format = (v: string) => (v ? formatDate(parseISODate(v)) : "");
  const [text, setText] = useState(() => format(value));
  // Si el valor cambia desde afuera (p. ej. un reinicio del formulario), sincroniza el texto
  // durante el render (en vez de un efecto) para no disparar un renderizado extra.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(format(value));
  }

  // Un texto incompleto o imposible (31/02) ya no conserva en silencio la
  // fecha anterior: se informa "" y el motivo, sin borrar lo escrito.
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setText([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/"));
    const iso = digits.length === 8 ? isoFromParts(+digits.slice(0, 2), +digits.slice(2, 4), +digits.slice(4, 8)) : null;
    const next = iso ?? "";
    setLastValue(next);
    onChange(next, iso ? null : calendarDate(digits));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      value={text}
      disabled={disabled}
      aria-invalid={error || undefined}
      onChange={(e) => handleChange(e.target.value)}
      className={cn(fieldClass(error), "tabular-nums", className)}
    />
  );
}

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  step?: number;
  error?: boolean;
};

/** Campo numérico con flechas propias (estándar "Number"). */
export function NumberInput({ value, onValueChange, step = 1, min, max, error, disabled, className, ...rest }: NumberInputProps) {
  const bump = (dir: 1 | -1) => {
    const lo = min != null ? Number(min) : -Infinity;
    const hi = max != null ? Number(max) : Infinity;
    const next = Math.max(lo, Math.min(hi, (Number(value) || 0) + dir * step));
    onValueChange(String(next));
  };
  return (
    <div className={cn("relative", className)}>
      <input
        type="number"
        inputMode="numeric"
        {...rest}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        aria-invalid={error || undefined}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(fieldClass(error), "pr-9 tabular-nums")}
      />
      {!disabled && (
        <div className="absolute inset-y-1 right-1 flex flex-col justify-center">
          {([1, -1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              tabIndex={-1}
              aria-label={dir === 1 ? "Aumentar" : "Disminuir"}
              onClick={() => bump(dir)}
              className="grid h-[15px] w-[26px] place-items-center text-n200 hover:text-warning"
            >
              {dir === 1 ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Select({ error, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <div className="relative">
      <select {...rest} aria-invalid={error || undefined} className={cn(fieldClass(error), "cursor-pointer appearance-none pr-9 [&_optgroup]:bg-panel [&_option]:bg-panel", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-2.5 right-2.5 size-5 text-n50" aria-hidden />
    </div>
  );
}

type SearchInputProps = { value: string; onChange: (value: string) => void; placeholder: string; label: string };

export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-2.5 left-3 size-5 text-n400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(fieldClass(), "rounded-[20px] pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute top-2 right-2 grid size-6 place-items-center rounded-full text-n300 hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
