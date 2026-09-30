import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientScreen } from "@/components/screens/ClientScreen";
import { ScreenFallback } from "@/components/screens/shared";

export const metadata: Metadata = { title: "Mis pedidos" };

export default function ClientPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <ClientScreen />
    </Suspense>
  );
}
