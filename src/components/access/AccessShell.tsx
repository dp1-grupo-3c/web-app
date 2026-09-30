import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

/** Marco de las pantallas de acceso: barra con logo, contenido y pie. */
export function AccessShell({ children, headerExtra }: { children: ReactNode; headerExtra?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-night">
      {/* Retícula decorativa, eco del mapa */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_75%_at_88%_25%,#000_10%,transparent_70%)]"
      />
      <header className="relative flex h-[72px] items-center gap-3 border-b border-line px-6 lg:px-[100px]">
        <Logo size={44} />
        <span className="text-2xl font-bold tracking-tight text-pink">KindBox</span>
        <span className="flex-1" />
        {headerExtra}
      </header>
      <main className="relative flex-1 px-6 pt-16 pb-12 lg:px-[100px]">{children}</main>
      <footer className="relative flex justify-between border-t border-line px-6 py-5 text-xs text-n700 lg:px-[100px]">
        <span>KindBox · Plataforma de monitoreo logístico</span>
        <span>v1.0 · © 2026 PaqRap</span>
      </footer>
    </div>
  );
}

export function AccessHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <>
      <p className="text-sm font-bold tracking-[0.24em] text-craft uppercase">{eyebrow}</p>
      <h1 className="mt-2 text-4xl leading-tight font-bold tracking-tight text-pink lg:text-5xl">{title}</h1>
      <p className="mt-3 max-w-[640px] text-lg text-n300">{subtitle}</p>
    </>
  );
}
