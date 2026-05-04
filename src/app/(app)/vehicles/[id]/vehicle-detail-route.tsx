"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VehicleDetailClient } from "./vehicle-detail-client";
import { useIsClient } from "@/hooks/use-is-client";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { vehicleNewRentHref } from "@/lib/vehicle-new-rent-route";

type Props = { params: Promise<{ id: string }> };

export function VehicleDetailRoute({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sayfa = searchParams.get("sayfa");
  const legacyNewRental = searchParams.get("yeniKiralama") === "1";
  const shuntingNewRent = sayfa === "kiralama" || legacyNewRental;
  const { allVehicles } = useFleetVehicles();
  const mounted = useIsClient();

  useEffect(() => {
    if (!shuntingNewRent) return;
    router.replace(vehicleNewRentHref(id));
  }, [id, router, shuntingNewRent]);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 animate-pulse">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded-lg bg-muted" />
      </div>
    );
  }

  if (shuntingNewRent) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 animate-pulse">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded-lg bg-muted" />
      </div>
    );
  }

  const vehicle = allVehicles.find((v) => v.id === id);
  if (!vehicle) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Bu araç bulunamadı veya kaldırılmış olabilir.</p>
      </div>
    );
  }

  return <VehicleDetailClient vehicle={vehicle} rentalFormAsPage={false} />;
}
