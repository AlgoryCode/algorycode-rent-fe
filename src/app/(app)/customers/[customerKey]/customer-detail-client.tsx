"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { buildRentalRequestMessage, buildRentalRequestUrl, normalizedPhoneForWhatsApp } from "@/lib/customer-contact";
import { findManualCustomer } from "@/lib/manual-customers";
import { aggregateCustomersFromSessions, sessionCreatedAt, vehiclePlate, type CustomerAggregateRow } from "@/lib/rental-metadata";

type Props = {
  customerKey: string;
};

function statusBadge(status?: string) {
  if (status === "completed") return <Badge variant="success">Tamamlandı</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">İptal</Badge>;
  if (status === "pending") return <Badge variant="warning">Beklemede</Badge>;
  return <Badge variant="secondary">Aktif</Badge>;
}

export function CustomerDetailClient({ customerKey }: Props) {
  const { allSessions } = useFleetSessions();
  const { allVehicles } = useFleetVehicles();

  const decodedKey = useMemo(() => {
    try {
      return decodeURIComponent(customerKey);
    } catch {
      return customerKey;
    }
  }, [customerKey]);

  const row = useMemo((): CustomerAggregateRow | null => {
    if (decodedKey.startsWith("manual:")) {
      const m = findManualCustomer(decodedKey);
      if (!m) return null;
      return {
        key: m.key,
        customer: m.customer,
        rentals: [],
        totalRentals: 0,
        lastActivity: m.createdAt,
      };
    }
    const rows = aggregateCustomersFromSessions(allSessions);
    return rows.find((r) => r.key === decodedKey) ?? null;
  }, [allSessions, decodedKey]);

  const vehiclesById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

  const rentalRequestUrl = useMemo(() => {
    if (!row) return "";
    if (typeof window === "undefined") return "/talep";
    return buildRentalRequestUrl(window.location.origin, row.customer);
  }, [row]);

  const copyLink = async () => {
    if (!row || !rentalRequestUrl) return;
    try {
      await navigator.clipboard.writeText(rentalRequestUrl);
      toast.success("Talep formu bağlantısı kopyalandı.");
    } catch {
      toast.error("Bağlantı kopyalanamadı.");
    }
  };

  const sendMail = () => {
    if (!row || !row.customer.email) {
      toast.error("Müşteri e-posta adresi yok.");
      return;
    }
    const subject = encodeURIComponent("Kiralama talep formu bağlantınız");
    const body = encodeURIComponent(buildRentalRequestMessage(row.customer.fullName, rentalRequestUrl));
    window.location.href = `mailto:${encodeURIComponent(row.customer.email)}?subject=${subject}&body=${body}`;
  };

  const sendWhatsApp = () => {
    if (!row) return;
    const phone = normalizedPhoneForWhatsApp(row.customer.phone);
    if (!phone) {
      toast.error("WhatsApp için geçerli telefon bulunamadı.");
      return;
    }
    const text = encodeURIComponent(buildRentalRequestMessage(row.customer.fullName, rentalRequestUrl));
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  if (!row) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Card className="glow-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Müşteri kaydı bulunamadı. Listeyi yenileyip tekrar deneyin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card className="glow-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{row.customer.fullName}</CardTitle>
          <CardDescription className="text-xs">
            {row.totalRentals === 0 && row.key.startsWith("manual:")
              ? "Manuel eklenen müşteri — kiralama geçmişi yok."
              : "Müşteri detayları ve kiralama geçmişi"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p>
            <span className="text-muted-foreground">TC:</span> {row.customer.nationalId || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Pasaport:</span> {row.customer.passportNo || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Telefon:</span> {row.customer.phone || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">E-posta:</span> {row.customer.email || "—"}
          </p>
          <div className="grid gap-2 pt-2 sm:grid-cols-3">
            <Button className="h-8 gap-1.5 text-xs" onClick={sendMail}>
              <Mail className="h-3.5 w-3.5" />
              Mail ile ilet
            </Button>
            <Button className="h-8 gap-1.5 text-xs" variant="secondary" onClick={sendWhatsApp}>
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp ile ilet
            </Button>
            <Button className="h-8 gap-1.5 text-xs" variant="outline" onClick={() => void copyLink()}>
              <Copy className="h-3.5 w-3.5" />
              Link kopyala
            </Button>
          </div>
          <p className="break-all rounded-md border border-border/70 bg-muted/30 px-2 py-1 font-mono text-[11px]">
            {rentalRequestUrl}
          </p>
        </CardContent>
      </Card>

      <Card className="glow-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-sm">Kiralama geçmişi</CardTitle>
          <CardDescription className="text-xs">{row.rentals.length} kayıt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {row.rentals.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Henüz kiralama kaydı yok.</p>
          ) : (
            row.rentals.map((r) => (
            <div key={r.id} className="rounded-md border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {vehiclePlate(vehiclesById, r.vehicleId)} · {r.startDate} → {r.endDate}
                </p>
                {statusBadge(r.status)}
              </div>
              <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Kayıt: {format(parseISO(sessionCreatedAt(r)), "d MMM yyyy HH:mm", { locale: tr })}</p>
                <p>
                  Komisyon: {r.commissionAmount != null ? `${r.commissionAmount} (${r.commissionFlow ?? "-"})` : "—"}
                </p>
              </div>
            </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
