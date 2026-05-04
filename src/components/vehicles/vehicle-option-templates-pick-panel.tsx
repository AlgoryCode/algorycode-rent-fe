"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import {
  fetchVehicleOptionTemplatesFromRentApi,
  getRentApiErrorMessage,
  type VehicleOptionDefinitionPayload,
  type VehicleOptionTemplateApiRow,
} from "@/lib/rent-api";
import type { Vehicle, VehicleOptionDefRow } from "@/lib/mock-fleet";

function defMatchesTemplate(def: VehicleOptionDefRow, t: VehicleOptionTemplateApiRow): boolean {
  const dt = def.title.trim().toLowerCase();
  const tt = t.title.trim().toLowerCase();
  if (dt !== tt) return false;
  return Math.abs(Number(def.price) - Number(t.price)) < 0.02;
}

function initialTemplateIdsFromVehicle(vehicle: Vehicle, templates: VehicleOptionTemplateApiRow[]): string[] {
  const defs = vehicle.optionDefinitions ?? [];
  const out: string[] = [];
  for (const t of templates) {
    if (!t.active) continue;
    if (defs.some((d) => defMatchesTemplate(d, t))) out.push(t.id);
  }
  return out;
}

function manualDefinitionsNotFromTemplates(
  vehicle: Vehicle,
  templates: VehicleOptionTemplateApiRow[],
): VehicleOptionDefinitionPayload[] {
  const defs = vehicle.optionDefinitions ?? [];
  const manual: VehicleOptionDefinitionPayload[] = [];
  let i = 0;
  for (const d of defs) {
    if (templates.some((t) => defMatchesTemplate(d, t))) continue;
    manual.push({
      title: d.title,
      description: d.description,
      price: d.price,
      icon: d.icon,
      lineOrder: 100 + i++,
      active: d.active !== false,
    });
  }
  return manual;
}

export type VehicleOptionTemplatesPickPanelProps = {
  vehicle: Vehicle;
  onApplied?: () => void;
  saveButtonLabel?: string;
};

export function VehicleOptionTemplatesPickPanel({
  vehicle,
  onApplied,
  saveButtonLabel = "Araca uygula",
}: VehicleOptionTemplatesPickPanelProps) {
  const { updateVehicle } = useFleetVehicles();
  const [templates, setTemplates] = useState<VehicleOptionTemplateApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchVehicleOptionTemplatesFromRentApi({ includeInactive: false });
      setTemplates(list);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || templates.length === 0) return;
    setSelectedIds(initialTemplateIdsFromVehicle(vehicle, templates));
  }, [loading, templates, vehicle]);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.lineOrder - b.lineOrder || a.title.localeCompare(b.title, "tr")),
    [templates],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const manual = manualDefinitionsNotFromTemplates(vehicle, templates);
      await updateVehicle(vehicle.id, {
        optionTemplateIds: selectedIds,
        ...(manual.length > 0 ? { optionDefinitions: manual } : {}),
      });
      toast.success("Araç opsiyonları güncellendi.");
      onApplied?.();
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glow-card border-border/60">
      <CardHeader className="border-b border-border/60 py-3">
        <CardTitle className="text-sm">Şablonlardan seç</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 py-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : sortedTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aktif şablon yok.{" "}
            <Link href="/settings/options/vehicle" className="text-primary underline-offset-2 hover:underline">
              Önce şablon ekleyin
            </Link>
            .
          </p>
        ) : (
          <ul className="max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto pr-1">
            {sortedTemplates.map((t) => {
              const checked = selectedIds.includes(t.id);
              return (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(t.id)}
                      className="mt-0.5 rounded border-input"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      {t.description ? <p className="mt-0.5 text-[11px] text-muted-foreground">{t.description}</p> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        +{t.price} · sıra {t.lineOrder}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <Button type="button" size="sm" className="h-8 text-xs" disabled={saving || loading} onClick={() => void save()}>
            {saving ? "Kaydediliyor…" : saveButtonLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
