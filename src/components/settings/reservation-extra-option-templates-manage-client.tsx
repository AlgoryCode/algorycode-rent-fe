"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createReservationExtraOptionTemplateOnRentApi,
  deleteReservationExtraOptionTemplateOnRentApi,
  fetchReservationExtraOptionTemplatesFromRentApi,
  getRentApiErrorMessage,
  updateReservationExtraOptionTemplateOnRentApi,
  type ReservationExtraOptionTemplateApiRow,
} from "@/lib/rent-api";

type FormState = {
  code: string;
  title: string;
  description: string;
  price: string;
  icon: string;
  lineOrder: string;
  active: boolean;
  requiresCoDriverDetails: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  title: "",
  description: "",
  price: "0",
  icon: "",
  lineOrder: "0",
  active: true,
  requiresCoDriverDetails: false,
});

export function ReservationExtraOptionTemplatesManageClient() {
  const [rows, setRows] = useState<ReservationExtraOptionTemplateApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchReservationExtraOptionTemplatesFromRentApi({ includeInactive: true });
      setRows(list);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditingId("new");
    setForm(emptyForm());
  };

  const startEdit = (row: ReservationExtraOptionTemplateApiRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      title: row.title,
      description: row.description ?? "",
      price: String(row.price),
      icon: row.icon ?? "",
      lineOrder: String(row.lineOrder ?? 0),
      active: row.active,
      requiresCoDriverDetails: row.requiresCoDriverDetails,
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const submitForm = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Başlık zorunludur.");
      return;
    }
    const price = Number.parseFloat(form.price.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Fiyat 0 veya üzeri olmalı.");
      return;
    }
    const lo = Number.parseInt(form.lineOrder, 10);
    if (!Number.isFinite(lo)) {
      toast.error("Sıra geçerli bir tam sayı olmalı.");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        const code = form.code.trim().toUpperCase();
        if (!/^[A-Z0-9_]{2,64}$/.test(code)) {
          toast.error("Kod 2–64 karakter; yalnızca A–Z, 0–9 ve alt çizgi.");
          setSaving(false);
          return;
        }
        await createReservationExtraOptionTemplateOnRentApi({
          code,
          title,
          description: form.description.trim() || undefined,
          price,
          icon: form.icon.trim() || undefined,
          lineOrder: lo,
          active: form.active,
          requiresCoDriverDetails: form.requiresCoDriverDetails,
        });
        toast.success("Kiralama opsiyonu oluşturuldu.");
      } else if (editingId) {
        await updateReservationExtraOptionTemplateOnRentApi(editingId, {
          code: form.code.trim().toUpperCase() || undefined,
          title,
          description: form.description.trim(),
          price,
          icon: form.icon.trim() || undefined,
          lineOrder: lo,
          active: form.active,
          requiresCoDriverDetails: form.requiresCoDriverDetails,
        });
        toast.success("Güncellendi.");
      }
      cancelForm();
      await load();
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row: ReservationExtraOptionTemplateApiRow) => {
    if (!window.confirm(`“${row.title}” pasifleştirilsin mi?`)) return;
    try {
      await deleteReservationExtraOptionTemplateOnRentApi(row.id);
      toast.success("Pasifleştirildi.");
      await load();
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Kiralama opsiyonları</h1>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Rezervasyon sihirbazında listelenen genel ek hizmetler. Araca özel ücretli seçenekler için{" "}
            <Link href="/settings/options/vehicle" className="text-primary underline-offset-2 hover:underline">
              araç opsiyon şablonları
            </Link>{" "}
            kullanılır.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Link href="/settings/options" className="text-muted-foreground underline-offset-2 hover:underline">
              Opsiyonlar özeti
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/settings" className="text-muted-foreground underline-offset-2 hover:underline">
              Ayarlara dön
            </Link>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={startCreate} disabled={Boolean(editingId)}>
          Yeni kayıt
        </Button>
      </div>

      {editingId ? (
        <Card className="glow-card">
          <CardHeader className="border-b border-border/60 py-3">
            <CardTitle className="text-sm">{editingId === "new" ? "Yeni kiralama opsiyonu" : "Düzenle"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Kod (benzersiz)</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="h-9 font-mono text-sm"
                disabled={editingId !== "new"}
                placeholder="ORNEK_KOD"
              />
              {editingId !== "new" ? (
                <p className="text-[10px] text-muted-foreground">Kodu değiştirmek mümkündür; çakışma sunucuda engellenir.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Başlık</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Açıklama</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Fiyat</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Liste sırası</Label>
                <Input
                  type="number"
                  value={form.lineOrder}
                  onChange={(e) => setForm((f) => ({ ...f, lineOrder: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">İkon (opsiyonel)</Label>
              <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="h-9 text-sm" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded border-input"
              />
              Aktif
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.requiresCoDriverDetails}
                onChange={(e) => setForm((f) => ({ ...f, requiresCoDriverDetails: e.target.checked }))}
                className="rounded border-input"
              />
              Ek şöför formu zorunlu
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={() => void submitForm()}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={saving} onClick={cancelForm}>
                İptal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="glow-card">
        <CardHeader className="border-b border-border/60 py-3">
          <CardTitle className="text-sm">Kayıtlar</CardTitle>
          <CardDescription className="text-xs">Pasif kayıtlar rezervasyon ekranında listelenmez.</CardDescription>
        </CardHeader>
        <CardContent className="py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{row.code}</span> · {row.price} · sıra {row.lineOrder}
                      {row.requiresCoDriverDetails ? " · ek şöför" : ""}
                      {!row.active ? " · pasif" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => startEdit(row)} disabled={Boolean(editingId)}>
                      Düzenle
                    </Button>
                    {row.active ? (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void deactivate(row)}>
                        Pasifleştir
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
