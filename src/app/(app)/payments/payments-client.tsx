"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentLog, PaymentLogStatus } from "@/lib/mock-payments";
import { rentKeys } from "@/lib/rent-query-keys";
import { fetchPaymentsFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<PaymentLogStatus, string> = {
  completed: "Tamamlandı",
  pending: "Beklemede",
  failed: "Başarısız",
  refunded: "İade",
};

function statusBadgeVariant(s: PaymentLogStatus): "success" | "warning" | "destructive" | "muted" {
  switch (s) {
    case "completed":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "destructive";
    case "refunded":
      return "muted";
    default:
      return "muted";
  }
}

function formatTry(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

function PlateLink({ plate, vehicleId }: { plate: string; vehicleId: string }) {
  if (!vehicleId) {
    return <span className="font-mono font-medium">{plate}</span>;
  }
  return (
    <Link
      href={`/vehicles/${vehicleId}`}
      className="font-mono font-medium text-primary underline-offset-2 hover:underline"
    >
      {plate}
    </Link>
  );
}

export function PaymentsClient() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentLogStatus>("all");

  const {
    data: sourceList = [],
    isPending: loading,
    error,
  } = useQuery({
    queryKey: rentKeys.payments(),
    queryFn: fetchPaymentsFromRentApi,
  });
  const loadError = error ? getRentApiErrorMessage(error) : null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...sourceList].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.plate.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [query, statusFilter, sourceList]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Wallet className="h-5 w-5 text-primary" />
          Ödemeler
        </h1>
        <p className="text-xs text-muted-foreground">
          Ödeme logları rent API üzerinden gelir (`NEXT_PUBLIC_RENT_API_BASE`). Plaka, müşteri veya referans ile arayın;
          duruma göre süzebilirsiniz.
        </p>
      </div>

      <Card className="glow-card">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-sm">Ödeme logları</CardTitle>
          <CardDescription className="text-xs">
            {loading
              ? "Yükleniyor…"
              : loadError
                ? loadError
                : `${rows.length} kayıt listeleniyor · toplam ${sourceList.length} kayıt.`}{" "}
            Kiralama kayıtları için{" "}
            <Link href="/logs" className="font-medium text-primary underline-offset-2 hover:underline">
              Kiralamalar
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="pay-search" className="text-xs">
                Ara
              </Label>
              <Input
                id="pay-search"
                placeholder="Plaka, müşteri, referans…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-full space-y-1 sm:w-[11.5rem]">
              <Label htmlFor="pay-status" className="text-xs">
                Durum
              </Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | PaymentLogStatus)}>
                <SelectTrigger id="pay-status" className="h-9 text-xs font-normal">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all" className="text-xs">
                    Tümü
                  </SelectItem>
                  {(Object.keys(STATUS_LABEL) as PaymentLogStatus[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {STATUS_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Filtreye uygun ödeme kaydı yok.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Tarih</th>
                      <th className="px-3 py-2.5">Tutar</th>
                      <th className="px-3 py-2.5">Durum</th>
                      <th className="px-3 py-2.5">Yöntem</th>
                      <th className="px-3 py-2.5">Plaka</th>
                      <th className="px-3 py-2.5">Müşteri</th>
                      <th className="px-3 py-2.5">Referans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border/60 bg-background transition-colors hover:bg-muted/40 last:border-0"
                      >
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                          {format(parseISO(p.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                        </td>
                        <td className="px-3 py-2.5 font-medium tabular-nums">{formatTry(p.amountTry)}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={statusBadgeVariant(p.status)} className="text-[10px]">
                            {STATUS_LABEL[p.status]}
                          </Badge>
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2.5">{p.method}</td>
                        <td className="px-3 py-2.5">
                          <PlateLink plate={p.plate} vehicleId={p.vehicleId} />
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2.5">{p.customerName}</td>
                        <td className="font-mono text-[10px] text-muted-foreground">{p.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {rows.map((p) => (
                  <li key={p.id} className="rounded-lg border bg-background p-3 text-xs transition-colors hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold tabular-nums">{formatTry(p.amountTry)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(p.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                        </p>
                      </div>
                      <Badge variant={statusBadgeVariant(p.status)} className="shrink-0 text-[10px]">
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">{p.method}</p>
                    <p className="mt-1">
                      <PlateLink plate={p.plate} vehicleId={p.vehicleId} />
                      {" · "}
                      {p.customerName}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{p.reference}</p>
                    {p.note && <p className={cn("mt-1 text-[10px] text-muted-foreground")}>{p.note}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
