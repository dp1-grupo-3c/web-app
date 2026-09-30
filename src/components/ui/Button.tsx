import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "danger" | "text";
type Size = "md" | "sm" | "xs";

const VARIANT: Record<Variant, string> = {
  primary: "bg-pink text-night hover:bg-pink-hover active:bg-pink-pressed",
  outline: "border-pink text-pink hover:bg-pink/10 active:bg-pink/20",
  danger: "bg-magenta text-white hover:bg-magenta-hover active:bg-magenta-pressed",
  text: "text-pink hover:bg-pink/10 active:bg-pink/20",
};
const SIZE: Record<Size, string> = {
  md: "h-12 px-[30px] text-base rounded-[10px]",
  sm: "h-10 px-4 text-sm rounded-[10px]",
  xs: "h-8 px-3 text-[13px] rounded-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
};

/** Botón del estándar: 48 px de alto y 30 px de padding lateral (md). */
export function Button({ variant = "primary", size = "md", block, loading, loadingText, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap border-[1.5px] border-transparent font-bold transition-colors",
        SIZE[size],
        variant === "text" && size === "md" && "px-3",
        loading
          ? "cursor-progress bg-pink-pressed text-night"
          : disabled
            ? variant === "outline"
              ? "cursor-not-allowed border-line-strong text-n800"
              : "cursor-not-allowed bg-[#2e353f] text-n800"
            : VARIANT[variant],
        block && "w-full",
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-[18px] animate-spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "md" | "sm" };

/** Botón de ícono neutro (cerrar, acciones secundarias). */
export function IconButton({ label, size = "md", className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        "grid shrink-0 place-items-center rounded-[10px] text-n200 transition-colors hover:bg-field hover:text-white",
        size === "md" ? "size-10" : "size-8",
        className,
      )}
    >
      {children}
    </button>
  );
}

type ControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; solid?: boolean };

/** Botón de control (zoom, reproducción): usa Box Craft según el estándar. */
export function ControlButton({ label, solid, className, children, ...rest }: ControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        "grid size-10 place-items-center rounded-[10px] transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:text-n900",
        solid ? "bg-craft text-night hover:bg-craft-hover" : "text-craft hover:bg-craft/15 active:bg-craft/30",
        className,
      )}
    >
      {children}
    </button>
  );
}
