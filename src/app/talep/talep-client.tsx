"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CarFront, Search, Send } from "lucide-react";
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
import { ImageSourceInput } from "@/components/ui/image-source-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildEmptyTalepFormUrl,
  buildGenericTalepFormInviteMessage,
  normalizedPhoneForWhatsApp,
} from "@/lib/customer-contact";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  createRentalRequestOnRentApi,
  fetchVehiclesFromRentApi,
  getRentApiErrorMessage,
  queryRentalRequestByReferenceOnRentApi,
  type RentalRequestDto,
} from "@/lib/rent-api";

type Mode = "create" | "query";

type DriverForm = {
  fullName: string;
  birthDate: string;
  driverLicenseNo: string;
  passportNo: string;
  driverLicenseImageDataUrl: string;
  passportImageDataUrl: string;
};

const VEHICLE_NONE = "__none__";

/** 1×1 PNG — test için sahte ehliyet/pasaport görseli */
const DUMMY_IMAGE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function blankDriver(): DriverForm {
  return {
    fullName: "",
    birthDate: "",
    driverLicenseNo: "",
    passportNo: "",
    driverLicenseImageDataUrl: "",
    passportImageDataUrl: "",
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

function statusBadge(status: RentalRequestDto["status"]) {
  if (status === "approved") return <Badge variant="success">Onaylandı</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Reddedildi</Badge>;
  return <Badge variant="warning">Beklemede</Badge>;
}

const TALEP_KIOSK_COOKIE = "talep_kiosk_lock=1; path=/; SameSite=Lax";

function isLockedTalepPathname(pathname: string) {
  return pathname === "/talep/p" || pathname.startsWith("/talep/p/");
}

type TalepClientProps = {
  /** Boş form; URL ön doldurma yok. Oturum çerezi ve tıklama koruması ile yalnızca bu sayfada kalır. */
  locked?: boolean;
};

export function TalepClient({ locked = false }: TalepClientProps = {}) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("create");

  const [vehicleId, setVehicleId] = useState(VEHICLE_NONE);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [passportImageDataUrl, setPassportImageDataUrl] = useState("");
  const [driverLicenseImageDataUrl, setDriverLicenseImageDataUrl] = useState("");
  const [outsideCountryTravel, setOutsideCountryTravel] = useState(false);
  const [note, setNote] = useState("");
  const [additionalDrivers, setAdditionalDrivers] = useState<DriverForm[]>([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<RentalRequestDto | null>(null);

  const [referenceInput, setReferenceInput] = useState("");
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<RentalRequestDto | null>(null);
  const [prefilledFromQuery, setPrefilledFromQuery] = useState(false);

  const [sendFormOpen, setSendFormOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState<"wa" | "mail">("wa");
  const [sendPhone, setSendPhone] = useState("");
  const [sendEmailAddr, setSendEmailAddr] = useState("");

  const { data: vehicles = [] } = useQuery({
    queryKey: rentKeys.vehicles(),
    queryFn: fetchVehiclesFromRentApi,
  });

  const selectedVehicle = useMemo(() => {
    const targetId = queryResult?.vehicleId ?? (vehicleId !== VEHICLE_NONE ? vehicleId : undefined);
    return targetId ? vehicles.find((v) => v.id === targetId) : undefined;
  }, [vehicles, vehicleId, queryResult?.vehicleId]);

  useEffect(() => {
    if (locked) return;
    if (prefilledFromQuery) return;

    const qVehicleId = searchParams.get("vehicleId");
    if (qVehicleId) setVehicleId(qVehicleId);
    const qFullName = searchParams.get("fullName");
    if (qFullName) setFullName(qFullName);
    const qPhone = searchParams.get("phone");
    if (qPhone) setPhone(qPhone);
    const qEmail = searchParams.get("email");
    if (qEmail) setEmail(qEmail);
    const qBirthDate = searchParams.get("birthDate");
    if (qBirthDate) setBirthDate(qBirthDate);
    const qNationalId = searchParams.get("nationalId");
    if (qNationalId) setNationalId(qNationalId);
    const qPassportNo = searchParams.get("passportNo");
    if (qPassportNo) setPassportNo(qPassportNo);
    const qDriverLicenseNo = searchParams.get("driverLicenseNo");
    if (qDriverLicenseNo) setDriverLicenseNo(qDriverLicenseNo);

    setPrefilledFromQuery(true);
  }, [locked, prefilledFromQuery, searchParams]);

  useEffect(() => {
    if (!locked) return;
    document.cookie = TALEP_KIOSK_COOKIE;
    const onClickCapture = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      const a = el?.closest("a");
      if (!a?.href) return;
      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (isLockedTalepPathname(url.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.cookie = "talep_kiosk_lock=; path=/; max-age=0";
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [locked]);

  const updateDriver = <K extends keyof DriverForm>(idx: number, key: K, value: DriverForm[K]) => {
    setAdditionalDrivers((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  };

  const resetCreateForm = () => {
    setVehicleId(VEHICLE_NONE);
    setStartDate("");
    setEndDate("");
    setFullName("");
    setPhone("");
    setEmail("");
    setBirthDate("");
    setNationalId("");
    setPassportNo("");
    setDriverLicenseNo("");
    setPassportImageDataUrl("");
    setDriverLicenseImageDataUrl("");
    setOutsideCountryTravel(false);
    setNote("");
    setAdditionalDrivers([]);
    setFormError(null);
  };

  const submitCreate = async () => {
    setFormError(null);
    if (
      !startDate ||
      !endDate ||
      !fullName.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !birthDate ||
      !passportNo.trim() ||
      !driverLicenseNo.trim() ||
      !passportImageDataUrl ||
      !driverLicenseImageDataUrl
    ) {
      setFormError("Lütfen zorunlu alanları doldurun ve pasaport/ehliyet fotoğraflarını yükleyin.");
      return;
    }
    for (const d of additionalDrivers) {
      if (
        !d.fullName.trim() ||
        !d.birthDate ||
        !d.driverLicenseNo.trim() ||
        !d.passportNo.trim() ||
        !d.driverLicenseImageDataUrl ||
        !d.passportImageDataUrl
      ) {
        setFormError("Ek sürücü alanlarının tamamını doldurun ve fotoğrafları yükleyin.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await createRentalRequestOnRentApi({
        vehicleId: vehicleId !== VEHICLE_NONE ? vehicleId : undefined,
        startDate,
        endDate,
        outsideCountryTravel,
        note: note.trim() || undefined,
        customer: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          birthDate,
          nationalId: nationalId.trim() || undefined,
          passportNo: passportNo.trim(),
          driverLicenseNo: driverLicenseNo.trim(),
          passportImageDataUrl,
          driverLicenseImageDataUrl,
        },
        additionalDrivers:
          additionalDrivers.length > 0
            ? additionalDrivers.map((d) => ({
                fullName: d.fullName.trim(),
                birthDate: d.birthDate,
                driverLicenseNo: d.driverLicenseNo.trim(),
                passportNo: d.passportNo.trim(),
                driverLicenseImageDataUrl: d.driverLicenseImageDataUrl,
                passportImageDataUrl: d.passportImageDataUrl,
              }))
            : undefined,
      });
      setCreatedRequest(created);
      setReferenceInput(created.referenceNo);
      setQueryResult(created);
      setMode("query");
      resetCreateForm();
    } catch (e) {
      setFormError(getRentApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const fillWithDummy = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() + 1);
    const end = new Date(today);
    end.setDate(end.getDate() + 8);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const firstVehicle = vehicles[0];
    setVehicleId(firstVehicle?.id ?? VEHICLE_NONE);
    setStartDate(iso(start));
    setEndDate(iso(end));
    setFullName("Test Müşteri");
    setPhone("+90 531 000 0000");
    setEmail("test.ornek@example.com");
    setBirthDate("1990-01-15");
    setNationalId("12345678901");
    setPassportNo("U12345678");
    setDriverLicenseNo("E123456");
    setPassportImageDataUrl(DUMMY_IMAGE_PNG);
    setDriverLicenseImageDataUrl(DUMMY_IMAGE_PNG);
    setOutsideCountryTravel(false);
    setNote("Dummy test verisi");
    setAdditionalDrivers([]);
    setFormError(null);
    toast.message("Form sahte veri ve küçük PNG görselleriyle dolduruldu; göndererek akışı test edebilirsiniz.");
  };

  const submitShareTalepForm = () => {
    if (typeof window === "undefined") return;
    const url = buildEmptyTalepFormUrl(window.location.origin);
    const text = buildGenericTalepFormInviteMessage(url);
    if (sendChannel === "wa") {
      const p = normalizedPhoneForWhatsApp(sendPhone);
      if (!p) {
        toast.error("Geçerli bir telefon girin.");
        return;
      }
      window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      toast.success("WhatsApp açıldı.");
    } else {
      const em = sendEmailAddr.trim();
      if (!em.includes("@")) {
        toast.error("Geçerli bir e-posta girin.");
        return;
      }
      const subject = encodeURIComponent("Kiralama talep formu");
      const body = encodeURIComponent(text);
      window.location.href = `mailto:${encodeURIComponent(em)}?subject=${subject}&body=${body}`;
    }
    setSendFormOpen(false);
  };

  const submitQuery = async () => {
    const ref = referenceInput.trim();
    if (!ref) {
      setQueryError("Referans numarası girin.");
      return;
    }
    setQueryError(null);
    setQuerying(true);
    try {
      const result = await queryRentalRequestByReferenceOnRentApi(ref);
      setQueryResult(result);
    } catch (e) {
      setQueryResult(null);
      setQueryError(getRentApiErrorMessage(e));
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <Dialog open={sendFormOpen} onOpenChange={setSendFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Talep formu gönder</DialogTitle>
            <DialogDescription className="text-xs">
              Boş kilitli form bağlantısını (<span className="font-mono">/talep/p</span>) WhatsApp veya e-posta ile paylaşın.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sendChannel === "wa" ? "default" : "outline"}
                className="h-9 text-xs"
                onClick={() => setSendChannel("wa")}
              >
                WhatsApp
              </Button>
              <Button
                type="button"
                variant={sendChannel === "mail" ? "default" : "outline"}
                className="h-9 text-xs"
                onClick={() => setSendChannel("mail")}
              >
                E-posta
              </Button>
            </div>
            {sendChannel === "wa" ? (
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="+90 5xx …"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">E-posta</Label>
                <Input
                  className="h-9 text-sm"
                  type="email"
                  placeholder="ornek@mail.com"
                  value={sendEmailAddr}
                  onChange={(e) => setSendEmailAddr(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setSendFormOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={submitShareTalepForm}>
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="glow-card">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <CarFront className="h-4 w-4" />
                Kiralama Talep Formu
              </CardTitle>
              <CardDescription className="text-xs">
                {locked
                  ? "Bu bağlantı yalnızca talep formu içindir; tarayıcıda oturum süresince sitede başka sayfaya geçiş engellenir."
                  : "Bu sayfa sadece talep oluşturma ve referans numarası ile talep sorgulama içindir."}
              </CardDescription>
            </div>
            {!locked && (
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => setSendFormOpen(true)}>
                Talep formu gönder
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === "create" ? "default" : "outline"} className="h-9 text-xs" onClick={() => setMode("create")}>
              Talep oluşturma
            </Button>
            <Button variant={mode === "query" ? "default" : "outline"} className="h-9 text-xs" onClick={() => setMode("query")}>
              Talep sorgulama
            </Button>
          </div>

          {mode === "create" ? (
            <div className="space-y-3">
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Araç (isteğe bağlı)</Label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value={VEHICLE_NONE}>Araç daha sonra belirlensin</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} — {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Başlangıç</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Bitiş</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Ad soyad</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Telefon</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 ..." />
                </div>
                <div className="space-y-1">
                  <Label>E-posta</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Doğum tarihi</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Kimlik no (opsiyonel)</Label>
                  <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Pasaport no</Label>
                  <Input value={passportNo} onChange={(e) => setPassportNo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Ehliyet no</Label>
                  <Input value={driverLicenseNo} onChange={(e) => setDriverLicenseNo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Pasaport foto</Label>
                  <ImageSourceInput
                    onPick={async (f) => {
                      try {
                        setPassportImageDataUrl(await fileToDataUrl(f));
                      } catch {
                        setFormError("Pasaport görseli okunamadı.");
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ehliyet foto</Label>
                  <ImageSourceInput
                    onPick={async (f) => {
                      try {
                        setDriverLicenseImageDataUrl(await fileToDataUrl(f));
                      } catch {
                        setFormError("Ehliyet görseli okunamadı.");
                      }
                    }}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={outsideCountryTravel}
                      onChange={(e) => setOutsideCountryTravel(e.target.checked)}
                      className="rounded border-input"
                    />
                    Yurt dışı çıkışı olacak mı? (Evetse yeşil sigorta ücreti eklenir)
                  </label>
                  {outsideCountryTravel && (
                    <p className="text-[11px] text-muted-foreground">Ücret sunucu tarafında otomatik hesaplanır.</p>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Not (opsiyonel)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Ek sürücüler</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={additionalDrivers.length >= 1}
                    onClick={() => setAdditionalDrivers((prev) => [...prev, blankDriver()])}
                  >
                    {additionalDrivers.length >= 1 ? "En fazla 1 ek sürücü" : "Ek sürücü ekle"}
                  </Button>
                </div>
                {additionalDrivers.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Ek sürücü yok.</p>
                ) : (
                  <div className="space-y-3">
                    {additionalDrivers.map((d, idx) => (
                      <div key={`form-driver-${idx}`} className="rounded-md border border-border/60 p-2">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium">Ek sürücü #{idx + 1}</p>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setAdditionalDrivers((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Kaldır
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Ad soyad</Label>
                            <Input value={d.fullName} onChange={(e) => updateDriver(idx, "fullName", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Doğum tarihi</Label>
                            <Input type="date" value={d.birthDate} onChange={(e) => updateDriver(idx, "birthDate", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Ehliyet no</Label>
                            <Input
                              value={d.driverLicenseNo}
                              onChange={(e) => updateDriver(idx, "driverLicenseNo", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Pasaport no</Label>
                            <Input value={d.passportNo} onChange={(e) => updateDriver(idx, "passportNo", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Pasaport foto</Label>
                            <ImageSourceInput
                              onPick={async (f) => {
                                updateDriver(idx, "passportImageDataUrl", await fileToDataUrl(f));
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Ehliyet foto</Label>
                            <ImageSourceInput
                              onPick={async (f) => {
                                updateDriver(idx, "driverLicenseImageDataUrl", await fileToDataUrl(f));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button className="h-9 w-full gap-2 text-xs" onClick={() => void submitCreate()} disabled={submitting}>
                <Send className="h-4 w-4" />
                {submitting ? "Gönderiliyor..." : "Talebi gönder"}
              </Button>
              <Button type="button" variant="ghost" className="h-8 w-full text-[11px] text-muted-foreground" onClick={fillWithDummy}>
                Dummy veri ile doldur (test)
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  placeholder="Referans no (örn: RG-20260408-ABC123)"
                />
                <Button className="h-9 gap-1.5 text-xs" onClick={() => void submitQuery()} disabled={querying}>
                  <Search className="h-4 w-4" />
                  {querying ? "Sorgulanıyor..." : "Sorgula"}
                </Button>
              </div>
              {queryError && <p className="text-xs text-destructive">{queryError}</p>}
              {queryResult && (
                <Card className="border-border/70">
                  <CardHeader className="space-y-1 py-3">
                    <CardTitle className="text-sm">Talep sonucu</CardTitle>
                    <CardDescription className="text-xs">Referans: {queryResult.referenceNo}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">{statusBadge(queryResult.status)}</div>
                    <p>
                      Tarih: {queryResult.startDate} → {queryResult.endDate}
                    </p>
                    <p>Müşteri: {queryResult.customer.fullName}</p>
                    <p>Yurt dışı çıkış: {queryResult.outsideCountryTravel ? "Evet" : "Hayır"}</p>
                    <p>Yeşil sigorta ücreti: {queryResult.greenInsuranceFee}</p>
                    {queryResult.statusMessage && <p>Durum notu: {queryResult.statusMessage}</p>}
                    {selectedVehicle && (
                      <p>
                        Araç: {selectedVehicle.plate} — {selectedVehicle.brand} {selectedVehicle.model}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
              {createdRequest && (
                <p className="text-[11px] text-muted-foreground">
                  Son oluşturulan talep referansı: <span className="font-mono">{createdRequest.referenceNo}</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
