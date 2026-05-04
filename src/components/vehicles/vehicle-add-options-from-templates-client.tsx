"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleOptionTemplatesPickPanel } from "@/components/vehicles/vehicle-option-templates-pick-panel";
import type { Vehicle } from "@/lib/mock-fleet";

type Props = {
  vehicle: Vehicle;
};

export function VehicleAddOptionsFromTemplatesClient({ vehicle }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Opsiyon ekle</h1>
      </div>

      <VehicleOptionTemplatesPickPanel vehicle={vehicle} />

      {vehicle.optionDefinitions && vehicle.optionDefinitions.length > 0 ? (
        <Card className="glow-card">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Mevcut araç opsiyonları</CardTitle>
            <CardDescription className="text-xs">Kayıttan sonra liste araç detayında güncellenir.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60 text-sm">
              {vehicle.optionDefinitions.map((d) => (
                <li key={d.id} className="flex justify-between gap-2 py-2">
                  <span className="min-w-0 truncate font-medium">{d.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">+{d.price}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
