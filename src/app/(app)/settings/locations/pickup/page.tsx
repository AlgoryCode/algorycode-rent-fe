import { HandoverLocationsManageClient } from "@/components/settings/handover-locations-manage-client";

export default function HandoverPickupSettingsPage() {
  return (
    <HandoverLocationsManageClient
      kind="PICKUP"
      heading="Alış noktaları"
      intro="Araçların varsayılan alış (PICKUP) noktalarını buradan ekleyip düzenleyebilirsiniz. Pasif kayıtlar listede kalır ancak yeni atamalarda kullanılamaz."
    />
  );
}
