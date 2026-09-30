import { Airplay, Building2, Calendar, ChevronRight, Clock, FlaskConical, Sun } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessHeading, AccessShell } from "@/components/access/AccessShell";
import { OptionCard } from "@/components/access/OptionCard";
import { Badge } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Operaciones" };

export default function OperationsMenuPage() {
  return (
    <AccessShell headerExtra={<Badge tone="neutral"><Building2 className="size-3.5" aria-hidden /> Personal PaqRap</Badge>}>
      <nav aria-label="Ruta de navegación" className="mb-5 flex items-center gap-2 text-sm text-n500">
        <Link href="/" className="text-n300 hover:text-pink hover:underline">Inicio</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span aria-current="page" className="text-white">Operaciones</span>
      </nav>
      <AccessHeading eyebrow="Operaciones" title="¿Qué quieres hacer hoy?" subtitle="Monitorea la operación en vivo o pon a prueba la capacidad de la flota con una simulación." />
      <div className="mt-11 grid gap-6 lg:grid-cols-3">
        <OptionCard
          href="/operaciones/diarias"
          icon={<Sun className="size-7" aria-hidden />}
          title="Operaciones diarias"
          description="Monitorea en vivo la flota, los pedidos y los almacenes."
          meta={<Badge tone="ok"><span className="size-1.5 rounded-full bg-success" />En vivo</Badge>}
        />
        <OptionCard
          href="/simulacion/5-dias"
          icon={<Airplay className="size-7" aria-hidden />}
          title="Simulación de 5 días"
          description="Ejecuta cinco días de operación con datos sintéticos."
          meta={<Badge><Calendar className="size-3" aria-hidden /> Duración fija</Badge>}
        />
        <OptionCard
          href="/simulacion/colapso"
          icon={<FlaskConical className="size-7" aria-hidden />}
          title="Simulación hasta el colapso"
          description="Descubre hasta dónde resiste la capacidad operativa."
          meta={<Badge><Clock className="size-3" aria-hidden /> Sin fecha de fin</Badge>}
        />
      </div>
    </AccessShell>
  );
}
