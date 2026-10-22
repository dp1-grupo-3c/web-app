import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function pageList(page: number, count: number): (number | null)[] {
  const start = Math.max(1, Math.min(page - 2, count - 4));
  return Array.from({ length: 5 }, (_, i) => start + i <= count ? start + i : null);
}

/** Paginación del estándar: página activa resaltada en Warning. */
export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  const btn = "grid size-7 place-items-center rounded-md text-xs tabular-nums";
  return (
    <nav aria-label={`Paginación: página ${page} de ${pageCount}`} className="grid shrink-0 grid-cols-[repeat(7,1.75rem)] items-center gap-0.5">
      <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)} className={cn(btn, "text-warning hover:bg-field disabled:text-n900 disabled:hover:bg-transparent")}>
        <ChevronLeft className="size-4" />
      </button>
      {pageList(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`e${i}`} aria-hidden className={btn} />
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Página ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
            className={cn(btn, p === page ? "bg-warning font-bold text-night" : "text-n100 hover:bg-field")}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className={cn(btn, "text-warning hover:bg-field disabled:text-n900 disabled:hover:bg-transparent")}>
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
