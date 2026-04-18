"use client";

import Link from "next/link";
import { use } from "react";

import { VehicleAddOptionsFromTemplatesClient } from "@/components/vehicles/vehicle-add-options-from-templates-client";
import { useIsClient } from "@/hooks/use-is-client";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";

type Props = { params: Promise<{ id: string }> };

export default function VehicleOptionsApplyPage({ params }: Props) {
  const { id } = use(params);
  const mounted = useIsClient();
  const { allVehicles } = useFleetVehicles();

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 animate-pulse py-8">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-40 rounded-lg bg-muted" />
      </div>
    );
  }

  const vehicle = allVehicles.find((v) => v.id === id);
  if (!vehicle) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Bu araç bulunamadı veya kaldırılmış olabilir.</p>
        <Link href="/vehicles" className="text-sm text-primary underline-offset-2 hover:underline">
          Araç listesine dön
        </Link>
      </div>
    );
  }

  return <VehicleAddOptionsFromTemplatesClient vehicle={vehicle} />;
}
