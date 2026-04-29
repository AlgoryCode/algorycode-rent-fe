"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createVehicleOptionTemplateOnRentApi,
  deleteVehicleOptionTemplateOnRentApi,
  fetchVehicleOptionTemplatesFromRentApi,
  getRentApiErrorMessage,
  updateVehicleOptionTemplateOnRentApi,
  type VehicleOptionTemplateApiRow,
} from "@/lib/rent-api";

type FormState = {
  title: string;
  description: string;
  price: string;
  icon: string;
  lineOrder: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  price: "0",
  icon: "",
  lineOrder: "0",
  active: true,
});

export function VehicleOptionTemplatesManageClient() {
  const [rows, setRows] = useState<VehicleOptionTemplateApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchVehicleOptionTemplatesFromRentApi({ includeInactive: true });
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

  const startEdit = (row: VehicleOptionTemplateApiRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description ?? "",
      price: String(row.price),
      icon: row.icon ?? "",
      lineOrder: String(row.lineOrder ?? 0),
      active: row.active,
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
        await createVehicleOptionTemplateOnRentApi({
          title,
          description: form.description.trim() || undefined,
          price,
          icon: form.icon.trim() || undefined,
          lineOrder: lo,
          active: form.active,
        });
        toast.success("Şablon oluşturuldu.");
      } else if (editingId) {
        await updateVehicleOptionTemplateOnRentApi(editingId, {
          title,
          description: form.description.trim(),
          price,
          icon: form.icon.trim() || undefined,
          lineOrder: lo,
          active: form.active,
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

  const deactivate = async (row: VehicleOptionTemplateApiRow) => {
    if (!window.confirm(`“${row.title}” pasifleştirilsin mi?`)) return;
    try {
      await deleteVehicleOptionTemplateOnRentApi(row.id);
      toast.success("Pasifleştirildi.");
      await load();
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Araç opsiyon şablonları</h1>
        </div>
        <AddEntityButton type="button" onClick={startCreate} disabled={Boolean(editingId)}>
          Yeni şablon
        </AddEntityButton>
      </div>

      {editingId ? (
        <Card className="glow-card">
          <CardHeader className="border-b border-border/60 py-3">
            <CardTitle className="text-sm">{editingId === "new" ? "Yeni şablon" : "Düzenle"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-4">
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
          <CardTitle className="text-sm">Şablonlar</CardTitle>
          <CardDescription className="text-xs">Pasif şablonlar yeni araç formunda listelenmez.</CardDescription>
        </CardHeader>
        <CardContent className="py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Henüz şablon yok.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.price} · sıra {row.lineOrder}
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
