import type { Metadata } from "next";
import { Suspense } from "react";
import { DailyOperationsScreen } from "@/components/screens/DailyOperationsScreen";
import { ScreenFallback } from "@/components/screens/shared";

export const metadata: Metadata = { title: "Operaciones diarias" };

export default function DailyOperationsPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <DailyOperationsScreen />
    </Suspense>
  );
}
