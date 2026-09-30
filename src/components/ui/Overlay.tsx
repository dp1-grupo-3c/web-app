"use client";

import { useEffect, type ReactNode } from "react";

/** Fondo modal. Cierra con Escape si se pasa onClose. */
export function Overlay({ children, onClose, labelledBy, role = "dialog" }: { children: ReactNode; onClose?: () => void; labelledBy: string; role?: "dialog" | "alertdialog" }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-[#080c10]/66 p-6">
      <div role={role} aria-modal="true" aria-labelledby={labelledBy} className="contents">
        {children}
      </div>
    </div>
  );
}
