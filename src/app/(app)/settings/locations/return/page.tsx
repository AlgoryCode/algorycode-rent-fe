import { HandoverLocationsManageClient } from "@/components/settings/handover-locations-manage-client";

export default function HandoverReturnSettingsPage() {
  return (
    <HandoverLocationsManageClient
      kind="RETURN"
      heading="Teslim noktaları"
      intro="Araçların varsayılan teslim (RETURN) noktalarını buradan ekleyip düzenleyebilirsiniz. Pasif kayıtlar listede kalır ancak yeni atamalarda kullanılamaz."
    />
  );
}
