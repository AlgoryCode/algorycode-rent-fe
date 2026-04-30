import { Card, CardContent } from "@/components/ui/card";

export type FleetMetrics = {
  occupancyPct: number;
  pendingApprovals: number;
  rentedToday: number;
  totalVehicles: number;
  available: number;
  maintenance: number;
};

export function RentalLogsFleetMetrics({ metrics }: { metrics: FleetMetrics }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Doluluk</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums text-slate-900">
            {metrics.occupancyPct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%
          </p>
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bekleyen Onaylar</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums text-slate-900">{metrics.pendingApprovals}</p>
          <p className="mt-1 text-xs text-slate-500">Yeni kiralama talebi</p>
        </CardContent>
      </Card>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Filo Özeti</p>
            <p className="text-xs font-bold text-slate-700">{metrics.totalVehicles} Araç</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width]"
              style={{
                width: `${metrics.totalVehicles > 0 ? (metrics.rentedToday / metrics.totalVehicles) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-tight text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Musait: {metrics.available}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Bakım: {metrics.maintenance}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Kirada: {metrics.rentedToday}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
