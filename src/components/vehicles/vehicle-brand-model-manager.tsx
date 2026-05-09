"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createVehicleBrandOnRentApi,
  createVehicleModelOnRentApi,
  fetchVehicleFormCatalogFromRentApi,
  getRentApiErrorMessage,
} from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

export function VehicleBrandModelManager() {
  const qc = useQueryClient();
  const { data: catalog, isPending, error, refetch } = useQuery({
    queryKey: rentKeys.vehicleFormCatalog(),
    queryFn: fetchVehicleFormCatalogFromRentApi,
  });

  const [brandName, setBrandName] = useState("");
  const [brandSort, setBrandSort] = useState("0");
  const [savingBrand, setSavingBrand] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);

  const [modelBrandId, setModelBrandId] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelSort, setModelSort] = useState("0");
  const [savingModel, setSavingModel] = useState(false);
  const [addingModel, setAddingModel] = useState(false);

  const brands = catalog?.brands ?? [];
  const brandItems = brands.map((b) => ({ value: b.id, label: b.name }));

  const modelRows = brands.flatMap((b) =>
    (b.models ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      sortOrder: m.sortOrder,
      brandId: b.id,
      brandName: b.name,
    })),
  );

  const saveBrand = async () => {
    const name = brandName.trim();
    if (!name) {
      toast.error("Marka adı girin.");
      return;
    }
    const so = Number.parseInt(brandSort.trim(), 10);
    const sortOrder = Number.isFinite(so) && so >= 0 ? so : 0;
    setSavingBrand(true);
    try {
      await createVehicleBrandOnRentApi({ name, sortOrder });
      setBrandName("");
      setBrandSort("0");
      setAddingBrand(false);
      await qc.invalidateQueries({ queryKey: rentKeys.vehicleFormCatalog() });
      toast.success("Marka kaydedildi.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSavingBrand(false);
    }
  };

  const saveModel = async () => {
    const bid = modelBrandId.trim();
    const mname = modelName.trim();
    if (!bid) {
      toast.error("Önce marka seçin.");
      return;
    }
    if (!mname) {
      toast.error("Model adı girin.");
      return;
    }
    const so = Number.parseInt(modelSort.trim(), 10);
    const sortOrder = Number.isFinite(so) && so >= 0 ? so : 0;
    setSavingModel(true);
    try {
      await createVehicleModelOnRentApi(bid, { name: mname, sortOrder });
      setModelName("");
      setModelSort("0");
      setModelBrandId("");
      setAddingModel(false);
      await qc.invalidateQueries({ queryKey: rentKeys.vehicleFormCatalog() });
      toast.success("Model kaydedildi.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSavingModel(false);
    }
  };

  const cancelBrandForm = () => {
    setAddingBrand(false);
    setBrandName("");
    setBrandSort("0");
  };

  const cancelModelForm = () => {
    setAddingModel(false);
    setModelName("");
    setModelSort("0");
    setModelBrandId("");
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
            <Factory className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Marka ve model</CardTitle>
            <CardDescription className="text-xs">
              Katalog listesi; eklemek için ilgili sekmedeki butonu kullanın.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isPending ? (
          <p className="text-xs text-muted-foreground">Katalog yükleniyor…</p>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-destructive">{getRentApiErrorMessage(error)}</span>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void refetch()}>
              Yenile
            </Button>
          </div>
        ) : (
          <Tabs
            defaultValue="brands"
            className="w-full"
            onValueChange={() => {
              cancelBrandForm();
              cancelModelForm();
            }}
          >
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="brands" className="text-xs">
                Markalar
              </TabsTrigger>
              <TabsTrigger value="models" className="text-xs">
                Modeller
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brands" className="mt-3 space-y-3">
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[240px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-2 py-2 font-medium">Marka</th>
                      <th className="px-2 py-2 font-medium tabular-nums">Sıra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-2 py-3 text-muted-foreground">
                          Henüz marka yok.
                        </td>
                      </tr>
                    ) : (
                      brands.map((b) => (
                        <tr key={b.id} className="border-b border-border/40 last:border-0">
                          <td className="px-2 py-2">{b.name}</td>
                          <td className="px-2 py-2 tabular-nums">{b.sortOrder}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {addingBrand ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="vmm-brand-name" className="text-xs">
                      Marka adı
                    </Label>
                    <Input
                      id="vmm-brand-name"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Örn. Toyota"
                      className="h-9 text-sm"
                      disabled={!!error}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vmm-brand-sort" className="text-xs">
                      Sıra
                    </Label>
                    <Input
                      id="vmm-brand-sort"
                      inputMode="numeric"
                      value={brandSort}
                      onChange={(e) => setBrandSort(e.target.value)}
                      className="h-9 text-sm"
                      disabled={!!error}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={cancelBrandForm}>
                      Vazgeç
                    </Button>
                    <Button type="button" size="sm" className="h-8 text-xs" disabled={savingBrand} onClick={() => void saveBrand()}>
                      {savingBrand ? "Kaydediliyor…" : "Kaydet"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!addingBrand ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    disabled={!!error}
                    onClick={() => setAddingBrand(true)}
                  >
                    Marka ekle
                  </Button>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="models" className="mt-3 space-y-3">
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-2 py-2 font-medium">Marka</th>
                      <th className="px-2 py-2 font-medium">Model</th>
                      <th className="px-2 py-2 font-medium tabular-nums">Sıra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-3 text-muted-foreground">
                          {brandItems.length === 0 ? "Önce marka ekleyin." : "Henüz model yok."}
                        </td>
                      </tr>
                    ) : (
                      modelRows.map((row) => (
                        <tr key={`${row.brandId}-${row.id}`} className="border-b border-border/40 last:border-0">
                          <td className="px-2 py-2">{row.brandName}</td>
                          <td className="px-2 py-2">{row.name}</td>
                          <td className="px-2 py-2 tabular-nums">{row.sortOrder}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {addingModel ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Marka</Label>
                    <SearchableSelect
                      items={brandItems}
                      value={modelBrandId}
                      onValueChange={setModelBrandId}
                      placeholder="Marka seçin"
                      searchPlaceholder="Marka ara…"
                      emptyText="Marka yok. Önce Markalar sekmesinden marka ekleyin."
                      disabled={!!error || brandItems.length === 0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vmm-model-name" className="text-xs">
                      Model adı
                    </Label>
                    <Input
                      id="vmm-model-name"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="Örn. Corolla"
                      className="h-9 text-sm"
                      disabled={!!error || !modelBrandId}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vmm-model-sort" className="text-xs">
                      Sıra
                    </Label>
                    <Input
                      id="vmm-model-sort"
                      inputMode="numeric"
                      value={modelSort}
                      onChange={(e) => setModelSort(e.target.value)}
                      className="h-9 text-sm"
                      disabled={!!error}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={cancelModelForm}>
                      Vazgeç
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={savingModel || !modelBrandId}
                      onClick={() => void saveModel()}
                    >
                      {savingModel ? "Kaydediliyor…" : "Kaydet"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!addingModel ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    disabled={!!error || brandItems.length === 0}
                    onClick={() => setAddingModel(true)}
                  >
                    Model ekle
                  </Button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
