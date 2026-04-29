"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentLogStatus } from "@/lib/mock-payments";
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
            <div className="rounded-lg border">
              <div className="space-y-2 p-3 md:hidden">
                {rows.map((p) => (
                  <div key={`mobile-${p.id}`} className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums">{formatTry(p.amountTry)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.customerName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{p.reference}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(p.status)} className="text-[10px]">
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(parseISO(p.createdAt), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      <span>{p.method}</span>
                    </div>
                    <div className="mt-1 text-xs">
                      <PlateLink plate={p.plate} vehicleId={p.vehicleId} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
              <Table className="min-w-[640px] text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Yöntem</TableHead>
                    <TableHead>Plaka</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Referans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {format(parseISO(p.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{formatTry(p.amountTry)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(p.status)} className="text-[10px]">
                          {STATUS_LABEL[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[8rem] truncate">{p.method}</TableCell>
                      <TableCell>
                        <PlateLink plate={p.plate} vehicleId={p.vehicleId} />
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate">{p.customerName}</TableCell>
                      <TableCell>
                        <span className="font-mono text-[10px] text-muted-foreground">{p.reference}</span>
                        {p.note ? <p className={cn("mt-1 max-w-[12rem] text-[10px] text-muted-foreground")}>{p.note}</p> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
