"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Panel abierto sincronizado con ?panel= (enlaces compartibles y botón "atrás").
 * Requiere un <Suspense> por encima (useSearchParams).
 */
export function usePanelParam<T extends string>(allowed: readonly T[]): [T | null, (panel: T | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("panel");
  const panel = raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;

  const setPanel = useCallback(
    (next: T | null) => {
      const q = new URLSearchParams(params.toString());
      if (next) q.set("panel", next);
      else q.delete("panel");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [panel, setPanel];
}
