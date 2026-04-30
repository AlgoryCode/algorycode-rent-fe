import { Suspense } from "react";

import { RentalLogsClient } from "../logs-client";

export default function LogsListPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-4 text-sm text-muted-foreground">Yükleniyor…</div>}>
      <RentalLogsClient />
    </Suspense>
  );
}
