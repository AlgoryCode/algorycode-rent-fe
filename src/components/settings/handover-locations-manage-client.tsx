"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries } from "@/hooks/use-countries";
import {
  createHandoverLocationOnRentApi,
  deleteHandoverLocationOnRentApi,
  fetchCitiesFromRentApi,
  fetchHandoverLocationsFromRentApi,
  getRentApiErrorMessage,
  updateHandoverLocationOnRentApi,
  type CityRow,
  type HandoverLocationApiRow,
  type UpdateHandoverLocationPayload,
} from "@/lib/rent-api";

const COUNTRY_NONE = "__none__";

type FormState = {
  name: string;
  description: string;
  addressLine: string;
  lineOrder: string;
  active: boolean;
  vehicleCountry: string;
  cityId: string;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  addressLine: "",
  lineOrder: "0",
  active: true,
  vehicleCountry: COUNTRY_NONE,
  cityId: "",
});

export function HandoverLocationsManageClient({
  kind,
  heading,
  intro,
}: {
  kind: "PICKUP" | "RETURN";
  heading: string;
  intro: string;
}) {
  const { countries } = useCountries();
  const [rows, setRows] = useState<HandoverLocationApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const countriesSorted = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [countries],
  );

  const selectedCountryId = useMemo(() => {
    if (form.vehicleCountry === COUNTRY_NONE) return "";
    return countriesSorted.find((c) => c.code === form.vehicleCountry)?.id ?? "";
  }, [countriesSorted, form.vehicleCountry]);

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

  useEffect(() => {
    if (!selectedCountryId) {
      setCities([]);
      if (!editingId) setForm((f) => ({ ...f, cityId: "" }));
      return;
    }
    let cancelled = false;
    void fetchCitiesFromRentApi(selectedCountryId).then((list) => {
      if (cancelled) return;
      setCities(list);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId, editingId]);

  const startCreate = () => {
    setEditingId("new");
    setForm(emptyForm());
  };

  const startEdit = (row: HandoverLocationApiRow) => {
    setEditingId(row.id);
    const cc = row.countryCode?.trim().toUpperCase() ?? "";
    const country = countriesSorted.find((c) => c.code === cc);
    setForm({
      name: row.name,
      description: row.description ?? "",
      addressLine: row.addressLine ?? "",
      lineOrder: String(row.lineOrder ?? 0),
      active: row.active !== false,
      vehicleCountry: country?.code ?? COUNTRY_NONE,
      cityId: row.cityId ?? "",
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
    const cityId = form.cityId.trim() || undefined;
    setSaving(true);
    try {
      if (editingId === "new") {
        await createHandoverLocationOnRentApi({
          kind,
          name,
          description: form.description.trim() || undefined,
          addressLine: form.addressLine.trim() || undefined,
          cityId,
          lineOrder: lo,
          active: form.active,
        });
        toast.success("Kayıt oluşturuldu.");
      } else if (editingId) {
        const patch: UpdateHandoverLocationPayload = {
          name,
          description: form.description.trim(),
          addressLine: form.addressLine.trim(),
          lineOrder: lo,
          active: form.active,
        };
        if (cityId) patch.cityId = cityId;
        else patch.clearCity = true;
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">{intro}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Link href="/settings/locations/pickup" className="text-primary underline-offset-2 hover:underline">
              Alış noktaları
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/settings/locations/return" className="text-primary underline-offset-2 hover:underline">
              Teslim noktaları
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/settings/option-templates" className="text-primary underline-offset-2 hover:underline">
              Opsiyon şablonları
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/settings" className="text-muted-foreground underline-offset-2 hover:underline">
              Ayarlara dön
            </Link>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={startCreate} disabled={Boolean(editingId)}>
          Yeni ekle
        </Button>
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
              <Label className="text-xs">Açıklama</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adres satırı</Label>
              <Input value={form.addressLine} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Ülke (şehir için)</Label>
                <Select
                  value={form.vehicleCountry}
                  onValueChange={(v) => setForm((f) => ({ ...f, vehicleCountry: v, cityId: "" }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COUNTRY_NONE}>Şehir bağlama</SelectItem>
                    {countriesSorted.map((c) => (
                      <SelectItem key={c.id} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCountryId ? (
                <div className="space-y-1">
                  <Label className="text-xs">Şehir</Label>
                  <Select value={form.cityId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, cityId: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={cities.length ? "Seçin" : "Yükleniyor…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
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
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[row.cityName, row.countryCode].filter(Boolean).join(" · ") || "Şehir atanmadı"}
                      {" · "}
                      sıra {row.lineOrder ?? 0}
                      {row.active === false ? " · pasif" : ""}
                    </p>
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
