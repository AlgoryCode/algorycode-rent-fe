"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  buildEmptyTalepFormMessage,
  buildEmptyTalepFormUrl,
  buildGenericTalepFormInviteMessage,
  normalizedPhoneForWhatsApp,
} from "@/lib/customer-contact";
import {
  fetchRentalRequestsFromRentApi,
  getRentApiErrorMessage,
  updateRentalRequestStatusOnRentApi,
  type RentalRequestDto,
  type RentalRequestStatus,
} from "@/lib/rent-api";

function statusBadge(s: RentalRequestStatus) {
  if (s === "approved") return <Badge variant="success">Onaylandı</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Reddedildi</Badge>;
  return <Badge variant="warning">Beklemede</Badge>;
}

export function RequestsClient() {
  const qc = useQueryClient();
  const [statusMessage, setStatusMessage] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetEmail, setTargetEmail] = useState("");

  const { data = [], isPending, error } = useQuery({
    queryKey: rentKeys.rentalRequests(),
    queryFn: fetchRentalRequestsFromRentApi,
  });

  const rows = useMemo(
    () =>
      [...data].sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      }),
    [data],
  );

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      message,
    }: {
      id: string;
      status: RentalRequestStatus;
      message?: string;
    }) => updateRentalRequestStatusOnRentApi(id, status, message),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rentKeys.rentalRequests() });
      toast.success("Talep durumu güncellendi.");
    },
    onError: (e) => {
      toast.error(getRentApiErrorMessage(e));
    },
  });

  const loadError = error ? getRentApiErrorMessage(error) : null;

  const applyStatus = async (row: RentalRequestDto, status: RentalRequestStatus) => {
    await updateMutation.mutateAsync({
      id: row.id,
      status,
      message: statusMessage.trim() || undefined,
    });
  };

  const emptyFormUrl = () => buildEmptyTalepFormUrl(typeof window !== "undefined" ? window.location.origin : "");

  const sendGenericFormInviteWhatsApp = () => {
    const url = emptyFormUrl();
    if (!url) return;
    const text = buildGenericTalepFormInviteMessage(url);
    const phone = normalizedPhoneForWhatsApp(targetPhone);
    if (!phone) {
      toast.error("WhatsApp için geçerli telefon girin.");
      return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    toast.success("WhatsApp penceresi açıldı.");
    setSendDialogOpen(false);
  };

  const sendGenericFormInviteMail = () => {
    const url = emptyFormUrl();
    if (!url) return;
    const email = targetEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Geçerli e-posta girin.");
      return;
    }
    const subject = encodeURIComponent("Kiralama talep formu");
    const body = encodeURIComponent(buildGenericTalepFormInviteMessage(url));
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    setSendDialogOpen(false);
  };

  const copyEmptyFormLink = async (row: RentalRequestDto) => {
    const url = emptyFormUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Boş talep formu bağlantısı kopyalandı.");
    } catch {
      toast.error("Bağlantı kopyalanamadı.");
    }
  };

  const sendEmptyFormMail = (row: RentalRequestDto) => {
    if (!row.customer.email?.trim()) {
      toast.error("Müşteri e-posta adresi yok.");
      return;
    }
    const url = emptyFormUrl();
    if (!url) return;
    const subject = encodeURIComponent("Kiralama talep formu");
    const body = encodeURIComponent(buildEmptyTalepFormMessage(row.customer.fullName, url));
    window.location.href = `mailto:${encodeURIComponent(row.customer.email)}?subject=${subject}&body=${body}`;
  };

  const sendEmptyFormWhatsApp = (row: RentalRequestDto) => {
    const phone = normalizedPhoneForWhatsApp(row.customer.phone);
    if (!phone) {
      toast.error("WhatsApp için geçerli telefon bulunamadı.");
      return;
    }
    const url = emptyFormUrl();
    if (!url) return;
    const text = encodeURIComponent(buildEmptyTalepFormMessage(row.customer.fullName, url));
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Kiralama talep formu gönder</DialogTitle>
            <DialogDescription className="text-xs">
              Telefon veya e-posta girip uygun kanaldan form bağlantısını iletebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input
                className="h-9 text-sm"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="+90 5xx..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-posta</Label>
              <Input
                className="h-9 text-sm"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="ornek@mail.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setSendDialogOpen(false)}>
              Kapat
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-9 text-xs" onClick={sendGenericFormInviteMail}>
              <Mail className="mr-1 h-3.5 w-3.5" />
              Mail ile gönder
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={sendGenericFormInviteWhatsApp}>
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              WhatsApp ile gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Kiralama talepleri</h1>
          <p className="text-xs text-muted-foreground">
            Müşteri taleplerini referans numarasıyla takip edin, onaylayın veya reddedin.
          </p>
        </div>
        <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSendDialogOpen(true)}>
          <MessageCircle className="h-3.5 w-3.5" />
          Kiralama talep formu gönder
        </Button>
      </div>

      <Card className="glow-card">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-sm">Durum notu (opsiyonel)</CardTitle>
          <CardDescription className="text-xs">
            Durum değişiminde bu not müşteriye bildirimde iletilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Label htmlFor="request-status-message" className="sr-only">
            Durum notu
          </Label>
          <Input
            id="request-status-message"
            value={statusMessage}
            onChange={(e) => setStatusMessage(e.target.value)}
            placeholder="Örn: Sözleşmeniz onaylandı, teslim saati için WhatsApp kontrol edin."
          />
        </CardContent>
      </Card>

      <Card className="glow-card">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-sm">Talep listesi</CardTitle>
          <CardDescription className="text-xs">
            {isPending ? "Yükleniyor..." : loadError ? loadError : `${rows.length} talep`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="rounded-md border border-border/70 bg-background p-3 transition-colors hover:bg-muted/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.customer.fullName}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{row.referenceNo}</p>
                    </div>
                    <div>{statusBadge(row.status)}</div>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>
                      Tarih: {row.startDate} → {row.endDate}
                    </p>
                    <p>Telefon: {row.customer.phone}</p>
                    <p>E-posta: {row.customer.email}</p>
                    <p>Yeşil sigorta: {row.greenInsuranceFee}</p>
                    {row.statusMessage && <p className="sm:col-span-2">Not: {row.statusMessage}</p>}
                    {row.contractPdfPath && (
                      <p className="sm:col-span-2 break-all font-mono text-[10px] opacity-80">
                        Sözleşme PDF: {row.contractPdfPath}
                      </p>
                    )}
                    {row.whatsappContractSentAt && (
                      <p className="sm:col-span-2 text-xs text-emerald-600 dark:text-emerald-400">
                        Yönetici WhatsApp (PDF bildirimi):{" "}
                        {new Date(row.whatsappContractSentAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}{" "}
                        — gönderim denemesi tamamlandı
                      </p>
                    )}
                    {row.whatsappContractError && (
                      <p className="sm:col-span-2 text-xs text-destructive">WhatsApp / PDF iletim: {row.whatsappContractError}</p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={updateMutation.isPending || row.status === "approved"}
                      onClick={() => void applyStatus(row, "approved")}
                    >
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      disabled={updateMutation.isPending || row.status === "rejected"}
                      onClick={() => void applyStatus(row, "rejected")}
                    >
                      Reddet
                    </Button>
                    <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => void copyEmptyFormLink(row)}
                      title="Ön doldurmasız form bağlantısını kopyala"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Bağlantı
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1 text-xs"
                      onClick={() => sendEmptyFormMail(row)}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Form e-posta
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1 text-xs"
                      onClick={() => sendEmptyFormWhatsApp(row)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Form WhatsApp
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
