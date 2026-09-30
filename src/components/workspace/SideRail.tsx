import type { LucideIcon } from "lucide-react";
import Link from "next/link";
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
          "relative flex min-h-[60px] w-[72px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[11px] leading-tight font-medium transition-colors",
          on ? "bg-pink/12 text-pink before:absolute before:inset-y-3.5 before:-right-2 before:w-[3px] before:rounded-full before:bg-pink" : "text-n300 hover:bg-field hover:text-white",
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
    <nav aria-label="Menú" className="z-[7] flex shrink-0 flex-col items-center gap-1 border-l border-line bg-panel pt-3.5 pb-4" style={{ width: RAIL_WIDTH }}>
      <Link href={homeHref} title="Volver al menú" aria-label="Volver al menú" className="grid size-[60px] place-items-center rounded-xl hover:bg-field">
        <Logo size={48} />
      </Link>
      <hr className="mt-1.5 mb-2.5 w-14 border-line-strong" />
      {items.map(renderItem)}
      <span className="flex-1" />
      {bottomItems.map(renderItem)}
    </nav>
  );
}
