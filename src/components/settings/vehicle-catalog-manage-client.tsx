"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createVehicleCatalogEntryOnRentApi,
  createVehicleStatusOnRentApi,
  deleteVehicleCatalogEntryOnRentApi,
  deleteVehicleStatusOnRentApi,
  fetchVehicleCatalogFromRentApi,
  fetchVehicleStatusesFromRentApi,
  getRentApiErrorMessage,
  updateVehicleCatalogEntryOnRentApi,
  updateVehicleStatusOnRentApi,
  type VehicleCatalogKind,
  type VehicleCatalogRow,
} from "@/lib/rent-api";

const FEATURE_NAME_LABEL = "Özellik adı";
const SORT_LABEL = "Sıra no";
const SORT_HINT = "Açılır listede üstten alta sıra; küçük sayı daha önde gösterilir.";

type CatalogTab = VehicleCatalogKind | "vehicleStatus";

const TAB_META: { value: CatalogTab; label: string }[] = [
  { value: "bodyStyle", label: "Araç türü" },
  { value: "fuelType", label: "Yakıt" },
  { value: "transmissionType", label: "Vites" },
  { value: "vehicleStatus", label: "Filo statüsü" },
];

type FormState = { labelTr: string; sortOrder: string; codeOptional: string };

const emptyForm = (): FormState => ({ labelTr: "", sortOrder: "0", codeOptional: "" });

export function VehicleCatalogManageClient() {
  const [tab, setTab] = useState<CatalogTab>("bodyStyle");
  const [rows, setRows] = useState<VehicleCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (kind: CatalogTab) => {
    setRows([]);
    setLoading(true);
    try {
      const list =
        kind === "vehicleStatus" ? await fetchVehicleStatusesFromRentApi() : await fetchVehicleCatalogFromRentApi(kind);
      setRows(list);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const startCreate = () => {
    setEditingCode("new");
    setForm(emptyForm());
  };

  const startEdit = (row: VehicleCatalogRow) => {
    setEditingCode(row.code);
    setForm({
      labelTr: row.labelTr,
      sortOrder: String(row.sortOrder ?? 0),
      codeOptional: "",
    });
  };

  const cancelForm = () => {
    setEditingCode(null);
    setForm(emptyForm());
  };

  const submitForm = async () => {
    const labelTr = form.labelTr.trim();
    if (!labelTr) {
      toast.error(`${FEATURE_NAME_LABEL} zorunludur.`);
      return;
    }
    const sortOrder = Number.parseInt(form.sortOrder, 10);
    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      toast.error("Sıra 0 veya üzeri bir tam sayı olmalıdır.");
      return;
    }
    setSaving(true);
    try {
      if (editingCode === "new") {
        if (tab === "vehicleStatus") {
          const optCode = form.codeOptional.trim();
          await createVehicleStatusOnRentApi({
            labelTr,
            sortOrder,
            ...(optCode ? { code: optCode } : {}),
          });
        } else {
          await createVehicleCatalogEntryOnRentApi(tab, { labelTr, sortOrder });
        }
        toast.success("Kayıt oluşturuldu.");
      } else if (editingCode) {
        if (tab === "vehicleStatus") {
          await updateVehicleStatusOnRentApi(editingCode, { labelTr, sortOrder });
        } else {
          await updateVehicleCatalogEntryOnRentApi(tab, editingCode, { labelTr, sortOrder });
        }
        toast.success("Güncellendi.");
      }
      cancelForm();
      await load(tab);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: VehicleCatalogRow) => {
    if (!row.id) {
      toast.error("Kayıt kimliği eksik; listeyi yenileyip tekrar deneyin.");
      return;
    }
    const name = row.labelTr.trim() || row.code;
    if (!window.confirm(`“${name}” silinsin mi? Araçlarda kullanılıyorsa sunucu reddeder.`)) {
      return;
    }
    try {
      if (tab === "vehicleStatus") {
        await deleteVehicleStatusOnRentApi(row.id);
      } else {
        await deleteVehicleCatalogEntryOnRentApi(tab, row.id);
      }
      toast.success("Silindi.");
      await load(tab);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Araç özellikleri kataloğu</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as CatalogTab);
          cancelForm();
        }}
        className="w-full"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {TAB_META.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_META.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-3 space-y-4">
            {tab === t.value ? (
              <>
                {editingCode ? (
                  <Card className="glow-card border-primary/25">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{editingCode === "new" ? "Yeni kayıt" : "Düzenle"}</CardTitle>
                      <CardDescription className="text-xs">
                        {editingCode === "new"
                          ? tab === "vehicleStatus"
                            ? "Kod isteğe bağlıdır; boş bırakılırsa sunucu üretir."
                            : "Kod özellik adından otomatik üretilir; çakışırsa sunucu sonek ekler."
                          : `Kod değişmez: ${editingCode}. ${FEATURE_NAME_LABEL} ve ${SORT_LABEL} güncellenir.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                      {tab === "vehicleStatus" && editingCode === "new" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Kod (isteğe bağlı)</Label>
                          <Input
                            className="h-9 font-mono text-xs"
                            placeholder="Örn: fleet_hold"
                            value={form.codeOptional}
                            onChange={(e) => setForm((f) => ({ ...f, codeOptional: e.target.value }))}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1">
                        <Label className="text-xs">{FEATURE_NAME_LABEL}</Label>
                        <Input
                          className="h-9 text-xs"
                          value={form.labelTr}
                          onChange={(e) => setForm((f) => ({ ...f, labelTr: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{SORT_LABEL}</Label>
                        <p className="text-[10px] leading-snug text-muted-foreground">{SORT_HINT}</p>
                        <Input
                          className="h-9 text-xs"
                          inputMode="numeric"
                          value={form.sortOrder}
                          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={() => void submitForm()}>
                          {saving ? "Kaydediliyor…" : "Kaydet"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={saving} onClick={cancelForm}>
                          Vazgeç
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex justify-end">
                    <AddEntityButton type="button" onClick={startCreate}>
                      Yeni ekle
                    </AddEntityButton>
                  </div>
                )}

                <Card className="glow-card">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Kayıtlar</CardTitle>
                    <CardDescription className="text-xs">
                      {loading ? "Yükleniyor…" : `${rows.length} kayıt`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {!loading && rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Liste boş.</p>
                    ) : null}
                    {!loading && rows.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border border-border/60">
                        <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-border/60 bg-muted/40">
                              <th className="px-2 py-2 font-medium">{tab === "vehicleStatus" ? "Kod" : "Kod (otomatik)"}</th>
                              <th className="px-2 py-2 font-medium">{FEATURE_NAME_LABEL}</th>
                              <th className="px-2 py-2 font-medium">{SORT_LABEL}</th>
                              <th className="px-2 py-2 font-medium text-right">İşlem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id || r.code} className="border-b border-border/40 last:border-0">
                                <td className="px-2 py-2 font-mono text-[11px]">{r.code}</td>
                                <td className="px-2 py-2">{r.labelTr}</td>
                                <td className="px-2 py-2 tabular-nums">{r.sortOrder}</td>
                                <td className="px-2 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-[11px]"
                                      disabled={editingCode != null}
                                      onClick={() => startEdit(r)}
                                    >
                                      Düzenle
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                                      disabled={editingCode != null}
                                      onClick={() => void removeRow(r)}
                                    >
                                      Sil
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
