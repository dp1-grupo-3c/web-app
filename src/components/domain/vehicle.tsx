import { Bike, Motorbike, Truck, type LucideIcon } from "lucide-react";
import type { VehicleKind } from "@/lib/types";

export const VEHICLE_META: Record<VehicleKind, { label: string; plural: string; color: string; Icon: LucideIcon }> = {
  auto: { label: "Auto", plural: "Autos", color: "var(--color-truck)", Icon: Truck },
  moto: { label: "Motocicleta", plural: "Motocicletas", color: "var(--color-moto)", Icon: Motorbike },
  bicicleta: { label: "Bicicleta", plural: "Bicicletas", color: "var(--color-bike)", Icon: Bike },
};

export const VEHICLE_ORDER: VehicleKind[] = ["auto", "moto", "bicicleta"];
