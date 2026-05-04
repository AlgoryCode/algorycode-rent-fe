"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, Building2, Copy, FileImage, Mail, MessageCircle, Pencil, User } from "lucide-react";
import { toast } from "@/components/ui/sonner";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomerRecordStates } from "@/hooks/use-customer-record-states";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { buildRentalRequestMessage, buildRentalRequestUrl, normalizedPhoneForWhatsApp } from "@/lib/customer-contact";
import {
  deleteManualCustomer,
  findManualCustomer,
  updateManualCustomer,
} from "@/lib/manual-customers";
import {
  aggregateCustomersFromSessions,
  mergeCustomerDirectoryStates,
  resolveCustomerKind,
  sessionCreatedAt,
  vehiclePlate,
  type CustomerAggregateRow,
} from "@/lib/rental-metadata";
import {
  deleteCustomerRecordOnRentApi,
  getRentApiErrorMessage,
  patchCustomerRecordActiveOnRentApi,
} from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import type { CustomerKind, RentalSession } from "@/lib/mock-fleet";
import { cn } from "@/lib/utils";

const defaultEditForm = {
  fullName: "",
  phone: "",
  email: "",
  nationalId: "",
  passportNo: "",
  birthDate: "",
  driverLicenseNo: "",
  kind: "individual" as CustomerKind,
};

type Props = {
  customerKey: string;
};

function statusBadge(status?: string) {
  if (status === "completed") return <Badge variant="success">Tamamlandı</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">İptal</Badge>;
  if (status === "pending") return <Badge variant="warning">Beklemede</Badge>;
  return <Badge variant="secondary">Aktif</Badge>;
}

function DocumentPreview({ label, url, className }: { label: string; url?: string; className?: string }) {
  if (!url || !url.trim()) {
    return (
      <div
        className={cn(
          "flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        <FileImage className="mb-2 h-8 w-8 opacity-40" aria-hidden />
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="mt-1">Yüklenmemiş</span>
      </div>
    );
  }
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-border/80 bg-muted/30"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="max-h-72 w-full object-contain" />
      </a>
      <p className="text-[10px] text-muted-foreground">Büyük görmek için tıklayın</p>
    </div>
  );
}

function rentalHasDriverDocs(r: RentalSession) {
  return Boolean(r.customer.passportImageDataUrl?.trim() || r.customer.driverLicenseImageDataUrl?.trim());
}

export function CustomerDetailClient({ customerKey }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { allSessions } = useFleetSessions();
  const { allVehicles } = useFleetVehicles();
  const { data: customerRecordStates } = useCustomerRecordStates();
  const [storeRev, setStoreRev] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [ef, setEf] = useState(defaultEditForm);

  const decodedKey = useMemo(() => {
    try {
      return decodeURIComponent(customerKey);
    } catch {
      return customerKey;
    }
  }, [customerKey]);

  const baseRow = useMemo((): CustomerAggregateRow | null => {
    void storeRev;
    if (decodedKey.startsWith("manual:")) {
      const m = findManualCustomer(decodedKey);
      if (!m) return null;
      return {
        key: m.key,
        customer: m.customer,
        rentals: [],
        totalRentals: 0,
        lastActivity: m.createdAt,
        recordActive: true,
      };
    }
    const rows = aggregateCustomersFromSessions(allSessions);
    return rows.find((r) => r.key === decodedKey) ?? null;
  }, [allSessions, decodedKey, storeRev]);

  const row = useMemo(() => {
    if (!baseRow) return null;
    return mergeCustomerDirectoryStates([baseRow], customerRecordStates)[0] ?? null;
  }, [baseRow, customerRecordStates]);

  const vehiclesById = useMemo(() => new Map(allVehicles.map((v) => [v.id, v])), [allVehicles]);

  const rentalRequestUrl = useMemo(() => {
    if (!row) return "";
    if (typeof window === "undefined") return "/rental-request-form";
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

  const isManual = Boolean(row?.key?.startsWith("manual:"));

  const openEdit = () => {
    if (!row || !isManual) return;
    const c = row.customer;
    setEf({
      fullName: c.fullName,
      phone: c.phone,
      email: c.email ?? "",
      nationalId: c.nationalId ?? "",
      passportNo: c.passportNo ?? "",
      birthDate: (c.birthDate ?? "").slice(0, 10),
      driverLicenseNo: c.driverLicenseNo ?? "",
      kind: c.kind === "corporate" ? "corporate" : "individual",
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!row || !isManual) return;
    if (!ef.fullName.trim() || !ef.phone.trim()) {
      toast.error("Ad soyad ve telefon zorunludur.");
      return;
    }
    const ok = updateManualCustomer(row.key, {
      fullName: ef.fullName.trim(),
      phone: ef.phone.trim(),
      email: ef.email.trim() || undefined,
      nationalId: ef.nationalId.trim() || "",
      passportNo: ef.passportNo.trim() || "",
      birthDate: ef.birthDate.trim() || undefined,
      driverLicenseNo: ef.driverLicenseNo.trim() || undefined,
      kind: ef.kind,
    });
    if (!ok) {
      toast.error("Güncellenemedi.");
      return;
    }
    toast.success("Kayıt güncellendi.");
    setEditOpen(false);
    setStoreRev((n) => n + 1);
  };

  const setServerActive = async (next: boolean) => {
    if (!row) return;
    setTogglingActive(true);
    try {
      await patchCustomerRecordActiveOnRentApi(row.key, next);
      toast.success(next ? "Müşteri aktifleştirildi." : "Müşteri pasife alındı.");
      await qc.invalidateQueries({ queryKey: rentKeys.customerRecords() });
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setTogglingActive(false);
    }
  };

  const confirmDeleteCustomer = async () => {
    if (!row) return;
    setDeletingCustomer(true);
    try {
      const result = await deleteCustomerRecordOnRentApi(row.key);
      if (isManual) {
        deleteManualCustomer(row.key);
      }
      toast.success(
        `Müşteri silindi (${result.deletedRentals} kiralama, ${result.deletedRentalRequests} talep sunucudan kaldırıldı).`,
      );
      await qc.invalidateQueries({ queryKey: rentKeys.rentals() });
      await qc.invalidateQueries({ queryKey: rentKeys.rentalRequests() });
      await qc.invalidateQueries({ queryKey: rentKeys.customerRecords() });
      setDeleteStep("idle");
      router.push("/customers");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setDeletingCustomer(false);
    }
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

  const passport = row.customer.passportImageDataUrl?.trim();
  const license = row.customer.driverLicenseImageDataUrl?.trim();
  const hasAnyMergedDoc = Boolean(passport || license);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {!row.recordActive && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Bu müşteri <span className="font-semibold">pasif</span>. Yeni kiralama veya kiralama talebi oluşturulamaz; müşteri seçicilerde seçilemez.
        </div>
      )}

      <Card className="glow-card border-border/80">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-sm">Müşteri durumu</CardTitle>
          <CardDescription className="text-xs">
            Pasif müşteriler için sunucu yeni kiralama ve talep oluşturmayı engeller. İstediğiniz zaman tekrar aktifleştirebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pb-4 pt-0">
          <Badge variant={row.recordActive ? "success" : "muted"} className="text-[10px]">
            {row.recordActive ? "Aktif" : "Pasif"}
          </Badge>
          {row.recordActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={togglingActive}
              onClick={() => void setServerActive(false)}
            >
              Pasife al
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={togglingActive}
              onClick={() => void setServerActive(true)}
            >
              Aktifleştir
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Müşteriyi düzenle</DialogTitle>
            <DialogDescription className="text-xs">Manuel kayıt — tarayıcıda saklanır.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEf((s) => ({ ...s, kind: "individual" }))}
                className={cn(
                  "flex min-h-[3rem] items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold",
                  ef.kind === "individual" ? "border-primary/50 bg-primary/10" : "border-border/80 bg-muted/15",
                )}
              >
                <User className="h-3.5 w-3.5" />
                Bireysel
              </button>
              <button
                type="button"
                onClick={() => setEf((s) => ({ ...s, kind: "corporate" }))}
                className={cn(
                  "flex min-h-[3rem] items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold",
                  ef.kind === "corporate" ? "border-primary/50 bg-primary/10" : "border-border/80 bg-muted/15",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Kurumsal
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ef.kind === "corporate" ? "Firma *" : "Ad soyad *"}</Label>
              <Input className="h-9 text-sm" value={ef.fullName} onChange={(e) => setEf((s) => ({ ...s, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon *</Label>
              <Input className="h-9 text-sm" value={ef.phone} onChange={(e) => setEf((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-posta</Label>
              <Input className="h-9 text-sm" type="email" value={ef.email} onChange={(e) => setEf((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TC</Label>
              <Input className="h-9 text-sm" value={ef.nationalId} onChange={(e) => setEf((s) => ({ ...s, nationalId: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pasaport</Label>
              <Input className="h-9 text-sm" value={ef.passportNo} onChange={(e) => setEf((s) => ({ ...s, passportNo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Doğum tarihi</Label>
              <Input className="h-9 text-sm" type="date" value={ef.birthDate} onChange={(e) => setEf((s) => ({ ...s, birthDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ehliyet no</Label>
              <Input
                className="h-9 text-sm"
                value={ef.driverLicenseNo}
                onChange={(e) => setEf((s) => ({ ...s, driverLicenseNo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setEditOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={saveEdit}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="glow-card">
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{row.customer.fullName}</CardTitle>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {resolveCustomerKind(row.customer) === "corporate" ? "Kurumsal" : "Bireysel"}
              </Badge>
              {!row.recordActive && (
                <Badge variant="muted" className="text-[10px] font-normal">
                  Pasif
                </Badge>
              )}
            </div>
            {isManual && (
              <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 text-xs" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Düzenle
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            {row.totalRentals === 0 && row.key.startsWith("manual:")
              ? "Manuel eklenen müşteri — kiralama geçmişi yok."
              : "Bilgiler, belgeler ve kiralama geçmişi"}
            {isManual && (
              <>
                {" "}
                <a href="#tehlikeli-bolge" className="font-medium text-destructive underline-offset-4 hover:underline">
                  Tehlikeli bölgeye git
                </a>
                .
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto">
              <TabsTrigger value="info" className="text-xs">
                Bilgiler
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                Belgeler
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                Kiralama geçmişi
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 text-xs outline-none">
              {!isManual && (
                <div className="mb-3 rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                  Bu özet kiralama kayıtlarından türetilir. Ad, iletişim ve belgeleri değiştirmek için ilgili{" "}
                  <span className="font-medium text-foreground">Kiralama detayı</span> sayfasında kaydı güncelleyin.
                  {row.rentals.length > 0 && (
                    <div className="mt-2 overflow-x-auto rounded-md border border-border/70">
                      <Table className="min-w-[420px] text-[11px]">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Araç</TableHead>
                            <TableHead>Dönem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {row.rentals.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>
                                <Link href={`/rentals/${r.id}`} className="text-primary underline-offset-4 hover:underline">
                                  {vehiclePlate(vehiclesById, r.vehicleId)}
                                </Link>
                              </TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {r.startDate} → {r.endDate}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
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
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 outline-none">
              <div>
                <h3 className="mb-2 text-sm font-medium">Sürücü belgeleri (özet)</h3>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  {row.rentals.length > 0
                    ? "Aşağıdaki görseller, kiralama kayıtlarından birleştirilmiş en güncel pasaport ve ehliyet yüklemeleridir."
                    : "Manuel müşteri — yalnızca kayıtta saklanan belge görselleri."}
                </p>
                {!hasAnyMergedDoc && (
                  <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Bu müşteri için henüz pasaport veya ehliyet fotoğrafı yok. Kiralama oluştururken yüklenen belgeler burada
                    görünür.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <DocumentPreview label="Pasaport" url={passport} />
                  <DocumentPreview label="Ehliyet" url={license} />
                </div>
              </div>

              {row.rentals.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Kiralama kayıtlarına göre</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table className="min-w-[640px] text-xs">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Araç</TableHead>
                          <TableHead>Dönem</TableHead>
                          <TableHead>Statü</TableHead>
                          <TableHead>Kayıt</TableHead>
                          <TableHead className="min-w-[200px]">Belgeler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {row.rentals.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{vehiclePlate(vehiclesById, r.vehicleId)}</TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {r.startDate} → {r.endDate}
                            </TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {format(parseISO(sessionCreatedAt(r)), "d MMM yyyy HH:mm", { locale: tr })}
                            </TableCell>
                            <TableCell>
                              {!rentalHasDriverDocs(r) ? (
                                <p className="text-[11px] text-muted-foreground">Bu kiralamada belge görseli yok.</p>
                              ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <DocumentPreview
                                    label="Pasaport (bu kiralama)"
                                    url={r.customer.passportImageDataUrl?.trim()}
                                  />
                                  <DocumentPreview
                                    label="Ehliyet (bu kiralama)"
                                    url={r.customer.driverLicenseImageDataUrl?.trim()}
                                  />
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="outline-none">
              <p className="mb-3 text-[11px] text-muted-foreground">{row.rentals.length} kayıt</p>
              {row.rentals.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Henüz kiralama kaydı yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[560px] text-xs">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Plaka</TableHead>
                        <TableHead>Dönem</TableHead>
                        <TableHead>Statü</TableHead>
                        <TableHead>Kayıt</TableHead>
                        <TableHead>Komisyon</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.rentals.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            <Link href={`/rentals/${r.id}`} className="text-primary underline-offset-4 hover:underline">
                              {vehiclePlate(vehiclesById, r.vehicleId)}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {r.startDate} → {r.endDate}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {format(parseISO(sessionCreatedAt(r)), "d MMM yyyy HH:mm", { locale: tr })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.commissionAmount != null ? `${r.commissionAmount} (${r.commissionFlow ?? "-"})` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card
        id="tehlikeli-bolge"
        className="scroll-mt-24 border-destructive/35 bg-gradient-to-b from-destructive/[0.06] to-destructive/[0.02] shadow-sm"
      >
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Tehlikeli bölge
          </CardTitle>
          <CardDescription className="text-xs text-destructive/85">
            {isManual ? (
              <>
                Manuel müşteri <span className="font-mono">{row.customer.fullName}</span> tarayıcıda da saklanır; sunucu
                silme işlemi yalnızca varsa ek durum satırını kaldırır — tarayıcı kaydı da temizlenir.
              </>
            ) : (
              <>
                Bu müşteri anahtarına bağlı tüm <span className="font-medium">kiralama</span> ve{" "}
                <span className="font-medium">kiralama talebi</span> kayıtları sunucudan kalıcı silinir. Veri
                güncellemek için silmeden önce{" "}
                <Link href="/logs" className="font-medium text-primary underline-offset-2 hover:underline">
                  Kiralama günlüğü
                </Link>{" "}
                veya ilgili kiralama sayfalarını kullanabilirsiniz.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          {deleteStep === "idle" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9 w-full text-xs sm:w-auto"
              disabled={deletingCustomer}
              onClick={() => setDeleteStep("confirm")}
            >
              {isManual ? "Manuel müşteriyi sil" : "Müşteriyi ve bağlı kayıtları sil"}
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-background/60 p-3 dark:bg-background/20">
              <p className="text-xs font-medium leading-relaxed text-destructive">
                <span className="font-semibold">{row.customer.fullName}</span> ve bu müşteri anahtarına bağlı tüm
                kiralama/talep kayıtları kalıcı olarak silinsin mi? Bu işlem geri alınamaz.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-9 text-xs"
                  disabled={deletingCustomer}
                  onClick={() => void confirmDeleteCustomer()}
                >
                  {deletingCustomer ? "Siliniyor…" : "Evet, sil"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  disabled={deletingCustomer}
                  onClick={() => setDeleteStep("idle")}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
