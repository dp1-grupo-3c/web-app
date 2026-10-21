import { ChevronRight } from "lucide-react";
import type { RailItem } from "@/components/workspace/SideRail";
import { SidePanel } from "@/components/workspace/SidePanel";

/** Menú de secciones del panel fijado: punto de partida para elegir una vista. */
export function SectionsPanel<T extends string>({ items, descriptions, onPick, onClose, width }: {
  items: RailItem<T>[];
  descriptions: Partial<Record<T, string>>;
  onPick: (id: T) => void;
  onClose: () => void;
  width: number;
}) {
  return (
    <SidePanel title="Secciones" subtitle="Elige la vista que quieres mantener abierta." onClose={onClose} width={width}>
      <ul className="grid gap-2">
        {items.map(({ id, label, Icon, badge }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onPick(id)}
              className="flex w-full items-center gap-3.5 rounded-xl border border-line bg-night px-4 py-3.5 text-left transition-colors hover:border-line-strong hover:bg-field"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-pink/12 text-pink"><Icon className="size-[22px]" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <b className="block text-base text-white">{label}</b>
                {descriptions[id] && <span className="block text-[13px] leading-snug text-n400">{descriptions[id]}</span>}
              </span>
              {!!badge && <span aria-label={`${badge} pendientes`} className="grid h-5 min-w-5 place-items-center rounded-full bg-critic px-1.5 text-[11px] font-bold text-white">{badge}</span>}
              <ChevronRight className="size-5 shrink-0 text-n500" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </SidePanel>
  );
}
