import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = [...new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i && p - pages[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/** Paginación del estándar: página activa resaltada en Warning. */
export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  const btn = "grid h-7 min-w-7 place-items-center rounded-md text-[13px]";
  return (
    <nav aria-label="Paginación" className="flex items-center gap-0.5">
      <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)} className={cn(btn, "text-warning hover:bg-field disabled:text-n900 disabled:hover:bg-transparent")}>
        <ChevronLeft className="size-4" />
      </button>
      {pageList(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className={cn(btn, "text-n900")}>…</span>
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
