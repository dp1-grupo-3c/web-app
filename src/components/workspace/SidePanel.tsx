"use client";

import { ArrowLeft, Pin, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { usePanelPin } from "./PanelPin";

type SidePanelProps = { title: string; subtitle?: string; onClose: () => void; footer?: ReactNode; children: ReactNode; width: number };

/**
 * Panel lateral, junto al menú. Si la pantalla permite fijarlo (PanelPinContext),
 * sin fijar flota sobre el mapa; fijado, el mapa se reajusta al espacio libre y
 * la flecha vuelve al menú de secciones.
 */
export function SidePanel({ title, subtitle, onClose, footer, children, width }: SidePanelProps) {
  const pin = usePanelPin();
  const pinned = pin?.pinned ?? false;
  return (
    <section aria-label={title} className={cn("z-[6] flex h-full w-full shrink-0 animate-panel-in flex-col border-line bg-panel md:w-[min(var(--panel-w),90vw)] md:border-l", !pinned && "shadow-[-16px_0_40px_rgb(0_0_0/0.35)]")} style={{ "--panel-w": `${width}px` } as CSSProperties}>
      <header className={cn("flex items-start gap-3 pt-4 pr-4 pb-4 md:pt-6", pinned && pin?.onBack ? "pl-3" : "pl-4 md:pl-6")}>
        {pinned && pin?.onBack && (
          <IconButton label="Volver a las secciones" onClick={pin.onBack} className="mt-0.5"><ArrowLeft className="size-[22px]" /></IconButton>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-bold tracking-tight text-pink md:text-[32px]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-n400">{subtitle}</p>}
        </div>
        {pin && (
          <IconButton label={pinned ? "Soltar panel" : "Fijar panel"} aria-pressed={pinned} onClick={pin.onTogglePin} className={cn(pinned && "bg-pink/12 text-pink hover:text-pink")}>
            <Pin className="size-[20px]" fill={pinned ? "currentColor" : "none"} />
          </IconButton>
        )}
        {!pinned && <IconButton label="Cerrar panel" onClick={onClose}><X className="size-[22px]" /></IconButton>}
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-1 pb-6 [scrollbar-gutter:stable] md:px-6">{children}</div>
      {footer && <footer className="flex gap-3 border-t border-line px-4 pt-4 pb-6 md:px-6">{footer}</footer>}
    </section>
  );
}

/** Sección dentro de un panel, con separador superior. */
export function PanelSection({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 [&+&]:border-t [&+&]:border-line [&+&]:pt-5">
      <div className="flex items-center gap-2 text-n300">
        {icon}
        <h3 className="flex-1 text-base font-bold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
