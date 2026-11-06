"use client";

import { Gauge, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import { VEHICLE_META, VEHICLE_ORDER } from "@/components/domain/vehicle";
import { PanelSection } from "@/components/workspace/SidePanel";
import { FLEET_OCCUPANCY_BANDS } from "@/config/simulacion";
import type { SimSettings } from "@/lib/types";
import { PercentBandsEditor } from "./PercentBandsEditor";

export type OccupancyBands = Pick<SimSettings, "vehicleOccupancy" | "warehouseFill">;

/**
 * Semáforos en %: ocupación por tipo de vehículo y llenado de los almacenes
 * intermedios. Lo comparten la simulación (5 días y colapso) y las operaciones diarias.
 */
export function OccupancyBandsEditor({ value, onChange, readOnly }: { value: OccupancyBands; onChange: (v: OccupancyBands) => void; readOnly?: boolean }) {
  return (
    <>
      <PanelSection title="Ocupación de vehículos (%)" icon={<Truck className="size-[18px]" aria-hidden />}>
        <p className="text-xs leading-snug text-n500">Porcentaje de la capacidad ocupado por los paquetes a bordo, por tipo de vehículo. Se usa en el mapa y en el listado de vehículos.</p>
        <div>
          {VEHICLE_ORDER.map((k) => {
            const { plural, Icon, color } = VEHICLE_META[k];
            return (
              <PercentBandsEditor
                key={k}
                id={`occ-${k}`}
                label={plural}
                icon={<Icon className="size-4" style={{ color }} aria-hidden />}
                value={value.vehicleOccupancy[k]}
                onChange={(b) => onChange({ ...value, vehicleOccupancy: { ...value.vehicleOccupancy, [k]: b } })}
                direction="lowIsGreen"
                readOnly={readOnly}
              />
            );
          })}
        </div>
        <p className="flex items-start gap-1.5 text-xs leading-snug text-n600">
          <Gauge className="mt-px size-3.5 shrink-0" aria-hidden />
          La ocupación global de la flota usa un semáforo fijo: verde por debajo de {FLEET_OCCUPANCY_BANDS.low} %, ámbar de {FLEET_OCCUPANCY_BANDS.low} % a {FLEET_OCCUPANCY_BANDS.high} % y rojo por encima de {FLEET_OCCUPANCY_BANDS.high} %.
        </p>
      </PanelSection>
      <PanelSection title="Llenado de almacenes (%)" icon={<WarehouseIcon className="size-[18px]" aria-hidden />}>
        <p className="text-xs leading-snug text-n500">Stock actual sobre la capacidad de los almacenes intermedios. Colorea los almacenes en el mapa, su ficha, el listado de almacenes y el llenado global.</p>
        <PercentBandsEditor id="fill" label="Almacenes intermedios" value={value.warehouseFill} onChange={(b) => onChange({ ...value, warehouseFill: b })} direction="highIsGreen" readOnly={readOnly} />
      </PanelSection>
    </>
  );
}
