import type { Metadata } from "next";
import { Suspense } from "react";
import { SimulationScreen } from "@/components/screens/SimulationScreen";
import { ScreenFallback } from "@/components/screens/shared";

export const metadata: Metadata = { title: "Simulación de 5 días" };

export default function FiveDaySimulationPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <SimulationScreen mode="5d" />
    </Suspense>
  );
}
