"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, ImageIcon, MessageSquare, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { CustomerPickerDialog } from "@/components/customers/customer-picker-dialog";
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
import { useCustomerDirectoryRows } from "@/hooks/use-customer-directory-rows";
import { useCustomerRecordStates } from "@/hooks/use-customer-record-states";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { fetchRentalByIdFromRentApi, getRentApiErrorMessage, type UpdateRentalPayload } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { normalizeRentalStatus, type RentalStatus } from "@/lib/rental-status";
import { customerRecordKey, type CustomerAggregateRow } from "@/lib/rental-metadata";
import type { RentalSession } from "@/lib/mock-fleet";

type Props = { rentalId: string };

function statusChangeNeedsConfirmation(target: RentalStatus): boolean {
  return target === "cancelled" || target === "completed";
}

function customerSnapshotIncomplete(c: RentalSession["customer"]): boolean {
  return !c.fullName?.trim() || !c.phone?.trim();
}

export function RentalDetailClient({ rentalId }: Props) {
  const { updateRental, allSessions } = useFleetSessions();
  const { allVehicles } = useFleetVehicles();
  const { data: customerRecordStates } = useCustomerRecordStates();
  const directoryRows = useCustomerDirectoryRows(allSessions, customerRecordStates);
  const [saving, setSaving] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  /** Listeden atanan veya değiştirilen belge URL’leri kayıtta gönderilsin */
  const [customerDocsDirty, setCustomerDocsDirty] = useState(false);

  const { data: rental, isPending, error, refetch } = useQuery({
    queryKey: rentKeys.rental(rentalId),
    queryFn: () => fetchRentalByIdFromRentApi(rentalId),
  });

  const vehicle = useMemo(() => allVehicles.find((v) => v.id === rental?.vehicleId), [allVehicles, rental?.vehicleId]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [passportImageDataUrl, setPassportImageDataUrl] = useState("");
  const [driverLicenseImageDataUrl, setDriverLicenseImageDataUrl] = useState("");
  const [status, setStatus] = useState<RentalStatus>("active");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const pendingRiskyIntentRef = useRef<null | "status" | "fullSave">(null);

  const rentalAmount = useMemo(() => {
    if (!rental || vehicle?.rentalDailyPrice == null) return undefined;
    try {
      const days = Math.max(1, differenceInCalendarDays(parseISO(rental.endDate), parseISO(rental.startDate)) + 1);
      return days * vehicle.rentalDailyPrice;
    } catch {
      return undefined;
    }
  }, [rental, vehicle?.rentalDailyPrice]);

  const vehicleImages = useMemo(() => {
    if (!vehicle?.images) return [];
    return Object.values(vehicle.images).filter((v): v is string => typeof v === "string" && v.length > 0);
  }, [vehicle?.images]);

  const missingCustomer = rental ? customerSnapshotIncomplete(rental.customer) : false;

  const customerProfileHref = useMemo(() => {
    const key = customerRecordKey({
      fullName,
      nationalId,
      passportNo,
      phone,
      email: email || undefined,
      birthDate: birthDate || undefined,
      driverLicenseNo: driverLicenseNo || undefined,
      passportImageDataUrl: passportImageDataUrl || undefined,
      driverLicenseImageDataUrl: driverLicenseImageDataUrl || undefined,
    });
    return `/customers/${encodeURIComponent(key)}`;
  }, [fullName, nationalId, passportNo, phone, email, birthDate, driverLicenseNo, passportImageDataUrl, driverLicenseImageDataUrl]);

  useEffect(() => {
    if (!rental) return;
    setStartDate(rental.startDate);
    setEndDate(rental.endDate);
    setFullName(rental.customer.fullName);
    setPhone(rental.customer.phone);
    setNationalId(rental.customer.nationalId ?? "");
    setPassportNo(rental.customer.passportNo ?? "");
    setEmail(rental.customer.email ?? "");
    setBirthDate(String(rental.customer.birthDate ?? "").slice(0, 10));
    setDriverLicenseNo(rental.customer.driverLicenseNo ?? "");
    setPassportImageDataUrl(rental.customer.passportImageDataUrl ?? "");
    setDriverLicenseImageDataUrl(rental.customer.driverLicenseImageDataUrl ?? "");
    setStatus(normalizeRentalStatus(rental.status));
    setCustomerDocsDirty(false);
  }, [rental]);

  const applyCustomerFromDirectory = (row: CustomerAggregateRow) => {
    const c = row.customer;
    setFullName(c.fullName);
    setPhone(c.phone);
    setNationalId((c.nationalId ?? "").trim());
    setPassportNo((c.passportNo ?? "").trim());
    setEmail((c.email ?? "").trim());
    setBirthDate((c.birthDate ?? "").trim().slice(0, 10));
    setDriverLicenseNo((c.driverLicenseNo ?? "").trim());
    setPassportImageDataUrl((c.passportImageDataUrl ?? "").trim());
    setDriverLicenseImageDataUrl((c.driverLicenseImageDataUrl ?? "").trim());
    setCustomerDocsDirty(true);
    toast.success(`${c.fullName} bu kiralamaya atandı (kaydet ile onaylayın).`);
  };

  const serverStatus: RentalStatus | null = rental ? normalizeRentalStatus(rental.status) : null;
  const statusUnchanged = serverStatus !== null && status === serverStatus;

  const riskyDialogCopy =
    status === "cancelled"
      ? {
          title: "Kiralamayı iptal et?",
          body: "Bu kiralama iptal edilecek; takvimdeki ilgili günler müsait sayılır. Emin misiniz?",
        }
      : {
          title: "Tamamlandı olarak işaretle?",
          body: "Kiralama tamamlandı statüsüne alınacak. Emin misiniz?",
        };

  const performSave = async () => {
    if (!rental) return;
    setSaving(true);
    try {
      const customerPayload: NonNullable<UpdateRentalPayload["customer"]> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalId: nationalId.trim() || undefined,
        passportNo: passportNo.trim(),
        email: email.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        driverLicenseNo: driverLicenseNo.trim() || undefined,
      };
      if (customerDocsDirty) {
        if (passportImageDataUrl.trim()) {
          customerPayload.passportImageDataUrl = passportImageDataUrl.trim();
        }
        if (driverLicenseImageDataUrl.trim()) {
          customerPayload.driverLicenseImageDataUrl = driverLicenseImageDataUrl.trim();
        }
      }
      await updateRental(rental.id, {
        startDate,
        endDate,
        status,
        customer: customerPayload,
      });
      await refetch();
      toast.success("Kiralama güncellendi.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!rental) return;
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Müşteri adı ve telefon zorunludur.");
      return;
    }
    if (!passportNo.trim()) {
      toast.error("Pasaport no zorunludur.");
      return;
    }
    const srv = normalizeRentalStatus(rental.status);
    if (statusChangeNeedsConfirmation(status) && status !== srv) {
      pendingRiskyIntentRef.current = "fullSave";
      setStatusConfirmOpen(true);
      return;
    }
    await performSave();
  };

  const executeStatusUpdate = async () => {
    if (!rental) return;
    setStatusSaving(true);
    try {
      await updateRental(rental.id, { status });
      await refetch();
      toast.success("Statü güncellendi.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setStatusSaving(false);
    }
  };

  const requestStatusUpdate = () => {
    if (!rental) return;
    if (statusChangeNeedsConfirmation(status) && status !== serverStatus) {
      pendingRiskyIntentRef.current = "status";
      setStatusConfirmOpen(true);
      return;
    }
    void executeStatusUpdate();
  };

  const confirmRiskyStatus = () => {
    const intent = pendingRiskyIntentRef.current;
    pendingRiskyIntentRef.current = null;
    setStatusConfirmOpen(false);
    if (intent === "status") void executeStatusUpdate();
    else if (intent === "fullSave") void performSave();
  };

  const cancelRiskyStatusDialog = () => {
    pendingRiskyIntentRef.current = null;
    setStatusConfirmOpen(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="glow-card">
        <CardHeader>
          <CardTitle className="text-base">Kiralama detayı</CardTitle>
          <CardDescription className="text-xs">{vehicle ? `${vehicle.brand} ${vehicle.model}` : rentalId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending ? (
            <p className="text-xs text-muted-foreground">Yükleniyor…</p>
          ) : error ? (
            <p className="text-xs text-destructive">{getRentApiErrorMessage(error)}</p>
          ) : !rental ? (
            <p className="text-xs text-muted-foreground">Kiralama bulunamadı.</p>
          ) : (
            <>
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Araç plakası</p>
                  {vehicle ? (
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={`/vehicles/${vehicle.id}`}>{vehicle.plate}</Link>
                    </Button>
                  ) : (
                    <Badge variant="muted">Araç bilgisi yok</Badge>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Kiralama tutarı</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {rentalAmount != null ? rentalAmount.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Komisyon</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {rental.commissionAmount != null
                        ? `${rental.commissionAmount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} (${rental.commissionFlow === "pay" ? "gider" : "gelir"})`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {missingCustomer && (
                <div className="flex flex-col gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs">
                  <p className="font-medium text-amber-950 dark:text-amber-100">Müşteri bilgisi eksik</p>
                  <p className="text-muted-foreground">
                    Bu kiralamada ad veya telefon yok. Kayıtlı müşteri listesinden seçerek doldurun veya aşağıdan elle girin.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 w-full gap-1.5 text-xs sm:w-fit"
                    onClick={() => setCustomerPickerOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Müşteri ata
                  </Button>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Başlangıç</Label>
                  <Input type="date" className="h-9 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bitiş</Label>
                  <Input type="date" className="h-9 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <Label className="text-xs">Müşteri</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCustomerPickerOpen(true)}>
                        Kayıtlı müşteri seç
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link href={customerProfileHref}>Müşteri özeti</Link>
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ad soyad</Label>
                  <Input className="h-9 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input className="h-9 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">TC / kimlik no</Label>
                  <Input className="h-9 text-sm" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pasaport no</Label>
                  <Input className="h-9 text-sm" value={passportNo} onChange={(e) => setPassportNo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-posta</Label>
                  <Input type="email" className="h-9 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Doğum tarihi</Label>
                  <Input type="date" className="h-9 text-sm" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Ehliyet no</Label>
                  <Input className="h-9 text-sm" value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Durum</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as RentalStatus)}
                      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="active">Aktif</option>
                      <option value="pending">Beklemede</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal</option>
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 shrink-0 px-3 text-xs sm:w-auto"
                      disabled={statusUnchanged || statusSaving || !rental}
                      onClick={() => requestStatusUpdate()}
                    >
                      {statusSaving ? "Güncelleniyor…" : "Statü güncelle"}
                    </Button>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="fotograflar" className="w-full">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
                  <TabsTrigger value="fotograflar" className="gap-1 text-xs">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Fotoğraflar
                  </TabsTrigger>
                  <TabsTrigger value="yorum" className="gap-1 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Müşteri yorumu
                  </TabsTrigger>
                  <TabsTrigger value="kaza" className="gap-1 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Kaza fotoğrafları
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fotograflar" className="space-y-3">
                  {vehicleImages.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium">Araç fotoğrafları</p>
                      <div className="flex flex-wrap gap-2">
                        {vehicleImages.map((url, idx) => (
                          <figure key={`vehicle-img-${idx}`} className="w-24 shrink-0 sm:w-28">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Araç ${idx + 1}`} className="aspect-video w-full rounded-md border object-cover" />
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}
                  {rental.photos.length > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium">Kiralama fotoğrafları</p>
                      <div className="flex flex-wrap gap-2">
                        {rental.photos.map((p) => (
                          <figure key={p.id} className="w-24 shrink-0 sm:w-28">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.caption || "Kiralama"} className="aspect-video w-full rounded-md border object-cover" />
                            {p.caption && <figcaption className="mt-0.5 text-[10px] text-muted-foreground">{p.caption}</figcaption>}
                          </figure>
                        ))}
                      </div>
                    </div>
                  ) : vehicleImages.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">Bu kiralama için fotoğraf yok.</p>
                  ) : null}
                </TabsContent>

                <TabsContent value="yorum">
                  {!rental.feedback ? (
                    <p className="py-2 text-xs text-muted-foreground">Bu kiralama için müşteri yorumu yok.</p>
                  ) : (
                    <div className="rounded-md border bg-background px-2.5 py-2 text-xs">
                      <p className="mt-1">{rental.feedback.text}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="kaza">
                  {!rental.accidentReports || rental.accidentReports.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">Bu kiralama için kaza kaydı yok.</p>
                  ) : (
                    <div className="space-y-3">
                      {rental.accidentReports.map((a) => (
                        <div key={a.id} className="rounded-md border bg-background p-2.5 text-xs">
                          <p>{a.description}</p>
                          {a.photos && a.photos.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {a.photos.map((p) => (
                                <figure key={p.id} className="w-20 shrink-0 sm:w-24">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={p.url} alt={p.caption || "Kaza"} className="aspect-video w-full rounded border object-cover" />
                                  {p.caption && <figcaption className="mt-0.5 text-[9px] text-muted-foreground">{p.caption}</figcaption>}
                                </figure>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Button type="button" className="h-9 gap-2 text-xs" onClick={() => void save()} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Kaydediliyor..." : "Değişiklikleri kaydet"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        rows={directoryRows}
        onPick={applyCustomerFromDirectory}
        title="Kayıtlı müşteri seç"
        description="Listeden müşteriyi seçin; bilgiler forma yazılır. Ardından «Değişiklikleri kaydet» ile kiralamaya uygulayın."
      />

      <Dialog open={statusConfirmOpen} onOpenChange={(open) => !open && cancelRiskyStatusDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{riskyDialogCopy.title}</DialogTitle>
            <DialogDescription>{riskyDialogCopy.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancelRiskyStatusDialog}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant={status === "cancelled" ? "destructive" : "default"}
              onClick={() => void confirmRiskyStatus()}
            >
              Onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
