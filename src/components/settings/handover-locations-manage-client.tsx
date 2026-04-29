"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createHandoverLocationOnRentApi,
  deleteHandoverLocationOnRentApi,
  fetchHandoverLocationsFromRentApi,
  getRentApiErrorMessage,
  updateHandoverLocationOnRentApi,
  type HandoverLocationApiRow,
  type UpdateHandoverLocationPayload,
} from "@/lib/rent-api";

type FormState = {
  name: string;
  lineOrder: string;
  /** Bu nokta seçildiğinde rezervasyona eklenecek sabit tutar (EUR), virgül veya nokta. */
  surchargeEur: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  lineOrder: "0",
  surchargeEur: "0",
  active: true,
});

function parseSurchargeEurInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function HandoverLocationsManageClient({
  kind,
  heading,
  intro,
}: {
  kind: "PICKUP" | "RETURN";
  heading: string;
  intro: string;
}) {
  const [rows, setRows] = useState<HandoverLocationApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchHandoverLocationsFromRentApi(kind, { includeInactive: true });
      setRows(list);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setEditingId("new");
    setForm(emptyForm());
  };

  const startEdit = (row: HandoverLocationApiRow) => {
    setEditingId(row.id);
    const sur = row.surchargeEur ?? 0;
    setForm({
      name: row.name,
      lineOrder: String(row.lineOrder ?? 0),
      surchargeEur: String(sur),
      active: row.active !== false,
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const submitForm = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Ad zorunludur.");
      return;
    }
    const lo = Number.parseInt(form.lineOrder, 10);
    if (!Number.isFinite(lo)) {
      toast.error("Sıra numarası geçerli bir tam sayı olmalı.");
      return;
    }
    const surchargeParsed = parseSurchargeEurInput(form.surchargeEur);
    if (surchargeParsed === null) {
      toast.error("Ek ücret (EUR) geçerli bir sayı olmalı.");
      return;
    }
    if (surchargeParsed < 0) {
      toast.error("Ek ücret (EUR) negatif olamaz.");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        await createHandoverLocationOnRentApi({
          kind,
          name,
          lineOrder: lo,
          active: form.active,
          surchargeEur: surchargeParsed,
        });
        toast.success("Kayıt oluşturuldu.");
      } else if (editingId) {
        const patch: UpdateHandoverLocationPayload = {
          name,
          lineOrder: lo,
          active: form.active,
          surchargeEur: surchargeParsed,
        };
        await updateHandoverLocationOnRentApi(editingId, patch);
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

  const deactivate = async (row: HandoverLocationApiRow) => {
    if (!window.confirm(`“${row.name}” pasifleştirilsin mi?`)) return;
    try {
      await deleteHandoverLocationOnRentApi(row.id);
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
          <h1 className="text-lg font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">{intro}</p>
        </div>
        <AddEntityButton type="button" onClick={startCreate} disabled={Boolean(editingId)}>
          Yeni ekle
        </AddEntityButton>
      </div>

      {editingId ? (
        <Card className="glow-card">
          <CardHeader className="border-b border-border/60 py-3">
            <CardTitle className="text-sm">{editingId === "new" ? "Yeni nokta" : "Düzenle"}</CardTitle>
            <CardDescription className="text-xs">Tür: {kind}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Ad</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ek ücret (EUR)</Label>
              <Input
                inputMode="decimal"
                value={form.surchargeEur}
                onChange={(e) => setForm((f) => ({ ...f, surchargeEur: e.target.value }))}
                className="h-9 text-sm"
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                Müşteri bu teslim/alış noktasını seçtiğinde fiyata eklenecek sabit tutar. Boş veya 0 = ek ücret yok.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Liste sırası</Label>
                <Input
                  type="number"
                  value={form.lineOrder}
                  onChange={(e) => setForm((f) => ({ ...f, lineOrder: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-6 text-xs">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-input"
                />
                Aktif
              </label>
            </div>
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
          <CardDescription className="text-xs">Pasif kayıtlar listede görünür; yeni kiralamada seçilemez.</CardDescription>
        </CardHeader>
        <CardContent className="py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((row) => {
                const cc = row.countryCode?.trim();
                const metaParts = [
                  ...(cc ? [cc] : []),
                  `sıra ${row.lineOrder ?? 0}`,
                  ...((row.surchargeEur ?? 0) > 0
                    ? [
                        `ek ücret ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR" }).format(row.surchargeEur ?? 0)}`,
                      ]
                    : []),
                  ...(row.active === false ? ["pasif"] : []),
                ];
                return (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground">{metaParts.join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => startEdit(row)} disabled={Boolean(editingId)}>
                      Düzenle
                    </Button>
                    {row.active !== false ? (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void deactivate(row)}>
                        Pasifleştir
                      </Button>
                    ) : null}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
