"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { createReservationExtraOptionTemplateOnRentApi, getRentApiErrorMessage } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
};

function autoCode(): string {
  const n = String(Date.now());
  const c = `R${n}`.toUpperCase();
  return c.length <= 64 ? c : c.slice(0, 64);
}

export function QuickAddReservationExtraDialog({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState(() => autoCode());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [lineOrder, setLineOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCode(autoCode());
    setTitle("");
    setDescription("");
    setPrice("0");
    setLineOrder("0");
  };

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,64}$/.test(c)) {
      toast.error("Kod 2–64 karakter; yalnızca A–Z, 0–9 ve alt çizgi.");
      return;
    }
    const t = title.trim();
    if (!t) {
      toast.error("Başlık zorunludur.");
      return;
    }
    const p = Number.parseFloat(price.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) {
      toast.error("Fiyat 0 veya üzeri olmalı.");
      return;
    }
    const lo = Number.parseInt(lineOrder, 10);
    if (!Number.isFinite(lo)) {
      toast.error("Sıra geçerli bir tam sayı olmalı.");
      return;
    }
    setSaving(true);
    try {
      const row = await createReservationExtraOptionTemplateOnRentApi({
        code: c,
        title: t,
        description: description.trim() || undefined,
        price: p,
        lineOrder: lo,
        active: true,
        requiresCoDriverDetails: false,
      });
      void qc.invalidateQueries({ queryKey: rentKeys.reservationExtraOptionTemplates(false) });
      void qc.invalidateQueries({ queryKey: rentKeys.reservationExtraOptionTemplates(true) });
      toast.success("Kiralama opsiyonu eklendi.");
      onCreated?.(row.id);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Kiralama opsiyonu ekle</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="space-y-1">
            <Label htmlFor="qre-code">Kod</Label>
            <Input id="qre-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qre-title">Başlık</Label>
            <Input id="qre-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Yeşil sigorta" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qre-desc">Açıklama</Label>
            <Input id="qre-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="qre-price">Fiyat</Label>
              <Input id="qre-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qre-lo">Sıra</Label>
              <Input id="qre-lo" value={lineOrder} onChange={(e) => setLineOrder(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
