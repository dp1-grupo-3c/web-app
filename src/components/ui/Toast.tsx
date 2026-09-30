"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastItem = { id: number; message: string; tone: "success" | "error" };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  const show = useCallback((message: string, tone: ToastItem["tone"]) => {
    clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, message, tone });
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const [api] = useState<ToastApi>(() => ({
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
  }));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" role="status">
        {toast && (
          <div
            key={toast.id}
            className="fixed bottom-6 left-1/2 z-[100] flex max-w-[600px] min-w-[380px] -translate-x-1/2 animate-toast-in items-center gap-3 rounded-xl border border-line-strong bg-[#0f151b] px-[18px] py-3.5 text-sm text-white shadow-[0_12px_28px_rgb(0_0_0/0.5)]"
          >
            {toast.tone === "success" ? <CircleCheck className="size-[22px] shrink-0 text-success" /> : <CircleAlert className="size-[22px] shrink-0 text-critic" />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
