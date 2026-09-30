import type { Metadata } from "next";
import { Suspense } from "react";
import { SimulationScreen } from "@/components/screens/SimulationScreen";
import { ScreenFallback } from "@/components/screens/shared";

export const metadata: Metadata = { title: "Simulación hasta el colapso" };

export default function CollapseSimulationPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <SimulationScreen mode="colapso" />
    </Suspense>
  );
}
