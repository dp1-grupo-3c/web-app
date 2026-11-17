import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { RAIL_WIDTH } from "@/lib/constants";

export type RailItem<T extends string> = { id: T; label: string; Icon: LucideIcon; badge?: number };

type SideRailProps<T extends string> = {
  items: RailItem<T>[];
  bottomItems: RailItem<T>[];
  active: T | null;
  onToggle: (id: T) => void;
  homeHref: string;
};

/** Menú lateral: ícono + etiqueta (versión compacta del sidebar etiquetado del estándar). */
export function SideRail<T extends string>({ items, bottomItems, active, onToggle, homeHref }: SideRailProps<T>) {
  const renderItem = ({ id, label, Icon, badge }: RailItem<T>) => {
    const on = active === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={on}
        onClick={() => onToggle(id)}
        className={cn(
          "relative flex min-h-[56px] w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[11px] leading-tight font-medium transition-colors md:min-h-[60px] md:w-[72px]",
          on ? "bg-pink/12 text-pink md:before:absolute md:before:inset-y-3.5 md:before:-right-2 md:before:w-[3px] md:before:rounded-full md:before:bg-pink" : "text-n300 hover:bg-field hover:text-white",
        )}
      >
        <Icon className="size-[22px]" aria-hidden />
        <span>{label}</span>
        {!!badge && (
          <span aria-label={`${badge} pendientes`} className="absolute top-1.5 right-3.5 grid h-4 min-w-4 place-items-center rounded-full bg-critic px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>
    );
  };
  return (
    // En teléfono es una barra inferior desplazable; desde tablet, el menú lateral.
    <nav aria-label="Menú" className="z-[7] flex shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-panel px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] md:w-(--rail-w) md:flex-col md:overflow-visible md:border-t-0 md:border-l md:px-0 md:pt-3.5 md:pb-4" style={{ "--rail-w": `${RAIL_WIDTH}px` } as CSSProperties}>
      <Link href={homeHref} title="Volver al menú" aria-label="Volver al menú" className="grid size-[56px] shrink-0 place-items-center rounded-xl hover:bg-field md:size-[60px]">
        <Logo size={48} />
      </Link>
      <hr className="mt-1.5 mb-2.5 hidden w-14 border-line-strong md:block" />
      {items.map(renderItem)}
      <span className="hidden flex-1 md:block" />
      {bottomItems.map(renderItem)}
    </nav>
  );
}
