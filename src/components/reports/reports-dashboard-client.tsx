"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatISO, subMonths } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, Car, Euro, LineChart, RefreshCw, Timer, TrendingUp } from "lucide-react";

import { FleetOverviewSection } from "@/components/fleet/fleet-overview-section";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  fetchRentalDashboardReport,
  fetchVehiclesFromRentApi,
  type RentalDashboardReport,
} from "@/lib/rent-api";
import { formatEur, formatEurCompact } from "@/lib/format-money";
import { cn } from "@/lib/utils";

function isoDate(d: Date) {
  return formatISO(d, { representation: "date" });
}

export function ReportsDashboardClient() {
  const { t } = useLocale();
  const [from, setFrom] = useState(() => isoDate(subMonths(new Date(), 1)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [vehicleId, setVehicleId] = useState<string>("");

  const { data: vehicles = [] } = useQuery({
    queryKey: rentKeys.vehicles(),
    queryFn: fetchVehiclesFromRentApi,
  });

  const queryParams = useMemo(
    () => ({
      from,
      to,
      vehicleId: vehicleId || undefined,
    }),
    [from, to, vehicleId],
  );

  const {
    data: report,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: rentKeys.reportDashboard(queryParams.from, queryParams.to, queryParams.vehicleId),
    queryFn: () => fetchRentalDashboardReport(queryParams),
  });

  const timelineChart = useMemo(() => {
    if (!report) return [];
    return report.timeline.map((row) => ({
      ...row,
      revenueEur: Number(row.revenueEur),
      rentalStarts: row.rentalStarts,
    }));
  }, [report]);

  const vehicleChart = useMemo(() => {
    if (!report) return [];
    return report.byVehicle.map((v) => ({
      name: `${v.plate} · ${v.brand} ${v.model}`.slice(0, 28),
      revenueEur: Number(v.revenueEur),
      rentals: v.rentalCount,
    }));
  }, [report]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">{t("reports.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("reports.subtitle")}</p>
      </div>

      <FleetOverviewSection />

      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" aria-hidden />
            {t("reports.from")} / {t("reports.to")}
          </CardTitle>
          <CardDescription className="text-xs">
            {report
              ? `${report.fromInclusive} → ${report.toInclusive} · ${
                  report.timelineGranularity === "day"
                    ? t("reports.granularityDay")
                    : t("reports.granularityMonth")
                }`
              : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="rep-from" className="text-xs">
              {t("reports.from")}
            </Label>
            <Input
              id="rep-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-[11rem] text-xs"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-to" className="text-xs">
              {t("reports.to")}
            </Label>
            <Input
              id="rep-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-[11rem] text-xs"
            />
          </div>
          <div className="grid min-w-[12rem] flex-1 gap-2">
            <Label className="text-xs">{t("reports.tableVehicle")}</Label>
            <Select value={vehicleId || "all"} onValueChange={(v) => setVehicleId(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={t("reports.vehicleAll")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("reports.vehicleAll")}</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.plate} · {v.brand} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden />
            {t("reports.apply")}
          </Button>
        </CardContent>
      </Card>

      {isError ? (
        <p className="text-sm text-destructive">{t("reports.errorLoad")}</p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-border bg-muted/40"
              aria-hidden
            />
          ))}
        </div>
      ) : report ? (
        <>
          <KpiRow report={report} t={t} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title={t("reports.chartTimeline")}
              icon={<LineChart className="h-4 w-4 text-primary" aria-hidden />}
              className="animate-in fade-in slide-in-from-bottom-3 duration-500"
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timelineChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={formatEurCompact} />
                  <Tooltip
                    formatter={(v: number, name) =>
                      name === "revenueEur" ? [formatEur(v), t("reports.kpiRevenue")] : [v, t("reports.starts")]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenueEur"
                    name="revenueEur"
                    stroke="hsl(var(--primary))"
                    fill="url(#revFill)"
                    strokeWidth={2}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title={t("reports.chartVehicle")}
              icon={<TrendingUp className="h-4 w-4 text-primary" aria-hidden />}
              className="animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-delay:80ms]"
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={vehicleChart} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={56} />
                  <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={formatEurCompact} />
                  <Tooltip formatter={(v: number) => [formatEur(v), t("reports.kpiRevenue")]} />
                  <Bar
                    dataKey="revenueEur"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <VehicleTable report={report} t={t} />
        </>
      ) : null}
    </div>
  );
}

function KpiRow({
  report,
  t,
}: {
  report: RentalDashboardReport;
  t: (k: import("@/lib/i18n/messages").MessageKey) => string;
}) {
  const s = report.summary;
  const items = [
    {
      label: t("reports.kpiRentals"),
      value: String(s.rentalCount),
      icon: Car,
      sub: `${s.completedCount} done · ${s.activeOrPendingCount} open`,
    },
    {
      label: t("reports.kpiRevenue"),
      value: formatEur(Number(s.totalRevenueEur)),
      icon: Euro,
      sub: `+${formatEurCompact(Number(s.totalOptionsEur))} opts`,
    },
    {
      label: t("reports.kpiDays"),
      value: String(s.rentalDayBooked),
      icon: Timer,
      sub: t("reports.starts"),
    },
    {
      label: t("reports.kpiCommission"),
      value: formatEur(Number(s.totalCommissionEur)),
      icon: TrendingUp,
      sub: `base ${formatEur(Number(s.totalBaseRentalEur))}`,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <Card
          key={item.label}
          className={cn(
            "animate-in fade-in zoom-in-95 border-border/80 bg-card/80 shadow-sm duration-500",
            i === 1 && "ring-1 ring-primary/20",
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-md bg-primary/10 p-2">
              <item.icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="truncate text-lg font-semibold tabular-nums">{item.value}</p>
              <p className="text-[11px] text-muted-foreground">{item.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/80 bg-card/80", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function VehicleTable({
  report,
  t,
}: {
  report: RentalDashboardReport;
  t: (k: import("@/lib/i18n/messages").MessageKey) => string;
}) {
  if (report.byVehicle.length === 0) {
    return null;
  }
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle className="text-base">{t("reports.tableVehicle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t("reports.tableVehicle")}</TableHead>
              <TableHead className="text-right text-xs">{t("reports.kpiRentals")}</TableHead>
              <TableHead className="text-right text-xs">{t("reports.kpiDays")}</TableHead>
              <TableHead className="text-right text-xs">{t("reports.kpiRevenue")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byVehicle.map((v) => (
              <TableRow key={v.vehicleId}>
                <TableCell className="text-xs font-medium">
                  {v.plate} · {v.brand} {v.model}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">{v.rentalCount}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{v.rentalDayBooked}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatEur(Number(v.revenueEur))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
