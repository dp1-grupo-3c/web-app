import { Building2, Users } from "lucide-react";
import { AccessHeading, AccessShell } from "@/components/access/AccessShell";
import { OptionCard } from "@/components/access/OptionCard";

export default function ProfilePage() {
  return (
    <AccessShell>
      <AccessHeading eyebrow="Bienvenido a KindBox" title="¿Cómo quieres ingresar?" subtitle="Elige tu perfil y te mostraremos justo lo que necesitas." />
      <div className="mt-11 grid max-w-[824px] gap-6 md:grid-cols-2">
        <OptionCard href="/cliente" icon={<Users className="size-7" aria-hidden />} title="Soy cliente" description="Busca tu pedido y sigue su recorrido en tiempo real." />
        <OptionCard href="/operaciones" icon={<Building2 className="size-7" aria-hidden />} title="Soy de PaqRap" description="Monitorea las operaciones diarias y ejecuta simulaciones." />
      </div>
    </AccessShell>
  );
}
