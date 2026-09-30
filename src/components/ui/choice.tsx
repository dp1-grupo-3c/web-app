import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SegmentOption<T extends string> = { value: T; label: ReactNode; count?: number };

/** Pestañas segmentadas. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-[10px] border border-line bg-night p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              on ? "bg-field text-white shadow-[0_1px_2px_rgb(0_0_0/0.3)]" : "text-n300 hover:text-white",
            )}
          >
            {o.label}
            {o.count != null && <span className="rounded-full bg-line-strong px-1.5 text-xs text-n100">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

type RadioOption<T extends string> = { value: T; title: ReactNode; description?: ReactNode; hint?: string };

/** Tarjetas de opción única (radio del estándar en Box Craft). */
export function RadioCardGroup<T extends string>({
  options, value, onChange, label, compact, invalid, name,
}: { options: RadioOption<T>[]; value: T | ""; onChange: (v: T) => void; label: string; compact?: boolean; invalid?: boolean; name: string }) {
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} className={cn("grid gap-2", compact && "grid-cols-5 gap-1.5")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            title={o.hint}
            className={cn(
              "flex cursor-pointer gap-3 rounded-[10px] border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-warning",
              compact && "flex-col items-center gap-0.5 px-1 py-2.5 text-center",
              on ? "border-craft bg-craft/8" : invalid ? "border-critic/70 hover:border-critic" : "border-line-strong hover:border-n900",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
            {!compact && (
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-craft">
                <span className={cn("size-2.5 rounded-full bg-craft transition-transform", on ? "scale-100" : "scale-0")} />
              </span>
            )}
            <span>
              <b className={cn("block leading-tight font-semibold", compact ? "text-[15px]" : "text-sm", on && compact ? "text-craft" : "text-white")}>{o.title}</b>
              {o.description && <span className="mt-0.5 block text-xs leading-snug text-n400">{o.description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Interruptor (Box Craft). */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-craft" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
        on ? "border-pink bg-pink/12 text-pink" : "border-line-strong text-n200 hover:border-n800",
      )}
    >
      {children}
    </button>
  );
}
