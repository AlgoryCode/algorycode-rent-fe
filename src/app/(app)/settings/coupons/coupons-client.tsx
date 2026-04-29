"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createCouponOnRentApi,
  deleteCouponOnRentApi,
  fetchCouponsOnRentApi,
  getRentApiErrorMessage,
  updateCouponOnRentApi,
  type CreateCouponPayload,
  type DiscountCouponRow,
} from "@/lib/rent-api";

type FormState = {
  code: string;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: string;
  description: string;
  active: boolean;
  usageLimit: string;
  expiresAt: string;
};

const emptyForm = (): FormState => ({
  code: "",
  discountType: "AMOUNT",
  discountValue: "",
  description: "",
  active: true,
  usageLimit: "",
  expiresAt: "",
});

function formFromRow(row: DiscountCouponRow): FormState {
  return {
    code: row.code,
    discountType: row.discountType,
    discountValue: String(row.discountValue),
    description: row.description ?? "",
    active: row.active,
    usageLimit: row.usageLimit != null ? String(row.usageLimit) : "",
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : "",
  };
}

export function CouponsClient() {
  const [rows, setRows] = useState<DiscountCouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRows(await fetchCouponsOnRentApi());
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: DiscountCouponRow) => {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const val = parseFloat(form.discountValue);
    if (!form.code.trim()) {
      toast.error("Kupon kodu zorunludur.");
      return;
    }
    if (!Number.isFinite(val) || val < 0) {
      toast.error("Geçerli bir indirim değeri girin.");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateCouponPayload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: val,
        description: form.description.trim() || undefined,
        active: form.active,
        usageLimit: form.usageLimit.trim() ? parseInt(form.usageLimit, 10) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      };
      if (editingId) {
        await updateCouponOnRentApi(editingId, payload);
      } else {
        await createCouponOnRentApi(payload);
      }
      setDialogOpen(false);
      await load();
      toast.success(editingId ? "Kupon güncellendi." : "Kupon oluşturuldu.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await deleteCouponOnRentApi(deleteConfirmId);
      setDeleteConfirmId(null);
      await load();
      toast.success("Kupon silindi.");
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>İndirim Kuponları</CardTitle>
          <CardDescription>Müşterilere sunulacak indirim kuponlarını yönetin.</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          + Yeni Kupon
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz kupon yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Değer</TableHead>
                <TableHead>Kullanım</TableHead>
                <TableHead>Son geçerlilik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono font-semibold">{row.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.discountType === "PERCENT" ? "%" : "₺"}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.discountType === "PERCENT"
                      ? `%${row.discountValue}`
                      : `${row.discountValue.toLocaleString("tr-TR")} ₺`}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.usageCount}
                    {row.usageLimit != null && ` / ${row.usageLimit}`}
                  </TableCell>
                  <TableCell>
                    {row.expiresAt ? format(new Date(row.expiresAt), "dd.MM.yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.active ? "default" : "secondary"}>
                      {row.active ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Kuponu Düzenle" : "Yeni Kupon"}</DialogTitle>
            <DialogDescription>Kupon bilgilerini doldurun.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Kupon kodu</Label>
              <Input
                placeholder="örn. YENI10"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>İndirim türü</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.discountType === "AMOUNT" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setForm((f) => ({ ...f, discountType: "AMOUNT" }))}
                >
                  Sabit tutar (₺)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.discountType === "PERCENT" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setForm((f) => ({ ...f, discountType: "PERCENT" }))}
                >
                  Yüzdelik (%)
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{form.discountType === "PERCENT" ? "İndirim oranı (%)" : "İndirim tutarı (₺)"}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={form.discountType === "PERCENT" ? "örn. 10" : "örn. 500"}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama (isteğe bağlı)</Label>
              <Input
                placeholder="Kupon açıklaması"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kullanım limiti</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Sınırsız"
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Son geçerlilik</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId != null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kuponu Sil</DialogTitle>
            <DialogDescription>Bu kuponu silmek istediğinize emin misiniz?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
