import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Tarjeta de selección de las pantallas de acceso. */
export function OptionCard({ href, icon, title, description, meta }: { href: string; icon: ReactNode; title: string; description: string; meta?: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[280px] flex-col gap-3 rounded-3xl border border-line-strong bg-panel/60 p-8 transition-[background,border-color,transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-pink hover:bg-panel hover:shadow-[0_16px_36px_rgb(0_0_0/0.35)] focus-visible:outline-3 focus-visible:outline-offset-3"
    >
      <span className="mb-2 grid size-14 place-items-center rounded-2xl bg-pink/12 text-pink">{icon}</span>
      <span className="text-[26px] leading-tight font-bold tracking-tight text-white">{title}</span>
      <span className="text-base text-n300">{description}</span>
      {meta && <span className="flex flex-wrap gap-1.5">{meta}</span>}
      <span className="mt-auto flex items-center gap-1.5 text-[15px] font-bold text-pink">
        Ingresar <ArrowRight className="size-[18px] transition-transform group-hover:translate-x-[3px]" aria-hidden />
      </span>
    </Link>
  );
}
