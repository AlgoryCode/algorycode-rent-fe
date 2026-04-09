"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, ImageIcon, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { fetchRentalByIdFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

type Props = { rentalId: string };

export function RentalDetailClient({ rentalId }: Props) {
  const { updateRental } = useFleetSessions();
  const { allVehicles } = useFleetVehicles();
  const [saving, setSaving] = useState(false);

  const { data: rental, isPending, error, refetch } = useQuery({
    queryKey: rentKeys.rental(rentalId),
    queryFn: () => fetchRentalByIdFromRentApi(rentalId),
  });

  const vehicle = useMemo(() => allVehicles.find((v) => v.id === rental?.vehicleId), [allVehicles, rental?.vehicleId]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "pending" | "completed" | "cancelled">("active");

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

  useEffect(() => {
    if (!rental) return;
    setStartDate(rental.startDate);
    setEndDate(rental.endDate);
    setFullName(rental.customer.fullName);
    setPhone(rental.customer.phone);
    setStatus((rental.status as "active" | "pending" | "completed" | "cancelled") ?? "active");
  }, [rental]);

  const save = async () => {
    if (!rental) return;
    setSaving(true);
    try {
      await updateRental(rental.id, {
        startDate,
        endDate,
        status,
        customer: { fullName, phone },
      });
      await refetch();
      toast.success("Kiralama güncellendi.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
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

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Başlangıç</Label>
                  <Input type="date" className="h-9 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bitiş</Label>
                  <Input type="date" className="h-9 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Müşteri adı</Label>
                  <Input className="h-9 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input className="h-9 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Durum</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "active" | "pending" | "completed" | "cancelled")}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="active">Aktif</option>
                    <option value="pending">Beklemede</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="cancelled">İptal</option>
                  </select>
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
    </div>
  );
}
