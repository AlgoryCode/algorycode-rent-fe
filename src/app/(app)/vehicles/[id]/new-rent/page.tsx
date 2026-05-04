import { Suspense } from "react";

import { VehicleNewRentPageRoute } from "./new-rent-page-route";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function VehicleNewRentPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <VehicleNewRentPageRoute params={params} />
    </Suspense>
  );
}
