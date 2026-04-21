"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCountries } from "@/hooks/use-countries";
import { normalizeHexForColorPicker } from "@/lib/country-color";
import { rentKeys } from "@/lib/rent-query-keys";
import { createCountryOnRentApi, getRentApiErrorMessage, patchCountryColorOnRentApi } from "@/lib/rent-api";

export function CountriesClient() {
  const qc = useQueryClient();
  const { countries, loading, error, refetch } = useCountries();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [addHex, setAddHex] = useState("#808080");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [countries],
  );

  const onSave = useCallback(
    async (id: string, colorCode: string) => {
      const trimmed = colorCode.trim();
      if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) {
        setFormError("Geçerli bir hex renk girin (#RGB veya #RRGGBB).");
        return;
      }
      setFormError(null);
      setSavingId(id);
      try {
        await patchCountryColorOnRentApi(id, trimmed);
        await qc.invalidateQueries({ queryKey: rentKeys.countries() });
      } catch (e) {
        setFormError(getRentApiErrorMessage(e));
      } finally {
        setSavingId(null);
      }
    },
    [qc],
  );

  const resetAddForm = useCallback(() => {
    setAddCode("");
    setAddName("");
    setAddHex("#808080");
  }, []);

  const submitNewCountry = useCallback(async () => {
    const code = addCode.trim().toUpperCase();
    const name = addName.trim();
    const hex = addHex.trim();
    if (!code) {
      toast.error("Ülke kodu gerekli.");
      return;
    }
    if (code.length > 64) {
      toast.error("Ülke kodu en fazla 64 karakter olabilir.");
      return;
    }
    if (!name) {
      toast.error("Ülke adı gerekli.");
      return;
    }
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      toast.error("Geçerli bir hex renk girin (#RGB veya #RRGGBB).");
      return;
    }
    setAddSubmitting(true);
    setFormError(null);
    try {
      await createCountryOnRentApi({ code, name, colorCode: hex });
      await qc.invalidateQueries({ queryKey: rentKeys.countries() });
      toast.success("Ülke kaydedildi");
      setAddOpen(false);
      resetAddForm();
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setAddSubmitting(false);
    }
  }, [addCode, addName, addHex, resetAddForm, qc]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Globe2 className="h-5 w-5 text-primary" />
            Ülkeler
          </h1>
          <p className="text-xs text-muted-foreground">
            Her ülke için renk kodu; araç listesinde o ülkeye atanmış satırlar bu renkle vurgulanır.
          </p>
        </div>
        <Button type="button" size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => setAddOpen(true)} disabled={loading}>
          <Plus className="h-4 w-4" />
          Yeni ülke
        </Button>
      </div>

      {(error || formError) && (
        <p className="text-xs text-destructive" role="alert">
          {formError ?? error}
        </p>
      )}

      <Card className="glow-card">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Ülke listesi</CardTitle>
          <CardDescription>
            {loading
              ? "Yükleniyor…"
              : error
                ? `Liste yüklenemedi: ${error}`
                : sorted.length === 0
                  ? "Kayıtlı ülke yok. Yeni ülke ekleyebilirsiniz."
                  : `${sorted.length} ülke`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3 sm:px-4">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Yükleniyor…</p>
          ) : error ? (
            <p className="py-8 text-center text-xs text-destructive">Veri yüklenemedi. Aşağıdan listeyi yenileyin.</p>
          ) : sorted.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 text-xs">Kod</TableHead>
                    <TableHead className="h-9 text-xs">Ad</TableHead>
                    <TableHead className="h-9 w-[220px] text-xs">Renk</TableHead>
                    <TableHead className="h-9 w-[100px] text-xs" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((c) => (
                    <CountryColorRow
                      key={c.id}
                      country={c}
                      saving={savingId === c.id}
                      onSave={(hex) => void onSave(c.id, hex)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => void refetch()}>
          Listeyi yenile
        </Button>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            resetAddForm();
            setFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni ülke</DialogTitle>
            <DialogDescription className="text-xs">
              Kod benzersiz olmalıdır (en fazla 64 karakter). Aynı kod tekrar eklenemez.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="add-country-code">Kod</Label>
              <Input
                id="add-country-code"
                className="font-mono uppercase"
                maxLength={64}
                value={addCode}
                onChange={(e) => setAddCode(e.target.value.slice(0, 64).toUpperCase())}
                placeholder="TR"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-country-name">Ad</Label>
              <Input id="add-country-name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Türkiye" maxLength={128} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-country-color">Renk</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  id="add-country-color"
                  value={normalizeHexForColorPicker(addHex)}
                  onChange={(e) => setAddHex(e.target.value.toUpperCase())}
                  className="h-9 w-14 cursor-pointer rounded border border-input bg-background"
                  aria-label="Renk seçici"
                />
                <Input
                  className="font-mono flex-1 min-w-[7rem]"
                  value={addHex}
                  onChange={(e) => setAddHex(e.target.value)}
                  placeholder="#808080"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={addSubmitting}>
              İptal
            </Button>
            <Button type="button" size="sm" onClick={() => void submitNewCountry()} disabled={addSubmitting}>
              {addSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountryColorRow({
  country,
  saving,
  onSave,
}: {
  country: { id: string; code: string; name: string; colorCode: string };
  saving: boolean;
  onSave: (hex: string) => void;
}) {
  const [hex, setHex] = useState(country.colorCode);
  const pickerValue = normalizeHexForColorPicker(hex);

  useEffect(() => {
    setHex(country.colorCode);
  }, [country.colorCode]);

  return (
    <TableRow className="bg-background text-sm transition-colors hover:bg-muted/40">
      <TableCell className="py-2 font-mono text-xs font-medium">{country.code}</TableCell>
      <TableCell className="py-2">{country.name}</TableCell>
      <TableCell className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => setHex(e.target.value.toUpperCase())}
            className="h-9 w-14 cursor-pointer rounded border border-input bg-background"
            aria-label={`${country.name} renk seçici`}
          />
          <Input
            className="font-mono w-[120px]"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#RRGGBB"
            maxLength={7}
          />
        </div>
      </TableCell>
      <TableCell className="py-2">
        <Button type="button" size="sm" disabled={saving || hex.trim() === country.colorCode} onClick={() => onSave(hex)}>
          {saving ? "…" : "Kaydet"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
