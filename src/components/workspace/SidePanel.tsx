import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";

type SidePanelProps = { title: string; subtitle?: string; onClose: () => void; footer?: ReactNode; children: ReactNode; width: number };

/** Panel lateral: se abre junto al menú y el mapa se reajusta al espacio libre. */
export function SidePanel({ title, subtitle, onClose, footer, children, width }: SidePanelProps) {
  return (
    <section aria-label={title} className="z-[6] flex shrink-0 animate-panel-in flex-col border-l border-line bg-panel shadow-[-16px_0_40px_rgb(0_0_0/0.35)]" style={{ width }}>
      <header className="flex items-start gap-3 pt-6 pr-4 pb-4 pl-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[32px] leading-tight font-bold tracking-tight text-pink">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-n400">{subtitle}</p>}
        </div>
        <IconButton label="Cerrar panel" onClick={onClose}><X className="size-[22px]" /></IconButton>
      </header>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-6">{children}</div>
      {footer && <footer className="flex gap-3 border-t border-line px-6 pt-4 pb-6">{footer}</footer>}
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
