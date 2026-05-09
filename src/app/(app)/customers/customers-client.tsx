"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Search, Trash2, Users } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Button } from "@/components/ui/button";
import { ListingPanel, ListingTableWell, ListingToolbar } from "@/components/ui/listing-panel";
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
import {
  createCustomerOnRentApi,
  deleteCustomerOnRentApi,
  fetchCustomersFromRentApi,
  getRentApiErrorMessage,
  type RentCustomerRow,
  updateCustomerOnRentApi,
} from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

const defaultForm = {
  fullName: "",
  phone: "",
  email: "",
  nationalId: "",
  passportNo: "",
  birthDate: "",
  driverLicenseNo: "",
};

export function CustomersClient() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [target, setTarget] = useState<RentCustomerRow | null>(null);
  const [nf, setNf] = useState(defaultForm);
  const [ef, setEf] = useState(defaultForm);

  const { data: rows = [], isPending } = useQuery({
    queryKey: rentKeys.customers(),
    queryFn: fetchCustomersFromRentApi,
  });

  const createMutation = useMutation({
    mutationFn: createCustomerOnRentApi,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rentKeys.customers() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateCustomerOnRentApi>[1] }) =>
      updateCustomerOnRentApi(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rentKeys.customers() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomerOnRentApi(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rentKeys.customers() });
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.nationalId ?? "").toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.passportNo ?? "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const submitCreate = async () => {
    if (!nf.fullName.trim() || !nf.phone.trim() || !nf.email.trim()) {
      toast.error("Ad soyad, telefon ve e-posta zorunludur.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        fullName: nf.fullName.trim(),
        phone: nf.phone.trim(),
        email: nf.email.trim(),
        nationalId: nf.nationalId.trim() || "",
        passportNo: nf.passportNo.trim() || "",
        birthDate: nf.birthDate.trim() || undefined,
        driverLicenseNo: nf.driverLicenseNo.trim() || undefined,
      });
      toast.success("Müşteri eklendi.");
      setNewOpen(false);
      setNf(defaultForm);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  const openEdit = (row: RentCustomerRow) => {
    setTarget(row);
    setEf({
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      nationalId: row.nationalId ?? "",
      passportNo: row.passportNo ?? "",
      birthDate: (row.birthDate ?? "").slice(0, 10),
      driverLicenseNo: row.driverLicenseNo ?? "",
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!target) return;
    if (!ef.fullName.trim() || !ef.phone.trim() || !ef.email.trim()) {
      toast.error("Ad soyad, telefon ve e-posta zorunludur.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: target.id,
        payload: {
          fullName: ef.fullName.trim(),
          phone: ef.phone.trim(),
          email: ef.email.trim(),
          nationalId: ef.nationalId.trim() || "",
          passportNo: ef.passportNo.trim() || "",
          birthDate: ef.birthDate.trim() || undefined,
          driverLicenseNo: ef.driverLicenseNo.trim() || undefined,
        },
      });
      toast.success("Müşteri güncellendi.");
      setEditOpen(false);
      setTarget(null);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  const openDelete = (row: RentCustomerRow) => {
    setTarget(row);
    setDeleteOpen(true);
  };

  const submitDelete = async () => {
    if (!target) return;
    try {
      await deleteMutation.mutateAsync(target.id);
      toast.success("Müşteri silindi.");
      setDeleteOpen(false);
      setTarget(null);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Users className="h-5 w-5 text-primary" />
          Müşteriler
        </h1>
        <AddEntityButton type="button" onClick={() => setNewOpen(true)}>
          Yeni müşteri
        </AddEntityButton>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Yeni müşteri</DialogTitle>
            <DialogDescription className="text-xs">Bu kayıt backend customer servisine yazılır.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Ad soyad *</Label>
              <Input className="h-9 text-sm" value={nf.fullName} onChange={(e) => setNf((s) => ({ ...s, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon *</Label>
              <Input className="h-9 text-sm" value={nf.phone} onChange={(e) => setNf((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-posta *</Label>
              <Input className="h-9 text-sm" type="email" value={nf.email} onChange={(e) => setNf((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TC / kimlik no</Label>
              <Input className="h-9 text-sm" value={nf.nationalId} onChange={(e) => setNf((s) => ({ ...s, nationalId: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pasaport no</Label>
              <Input className="h-9 text-sm" value={nf.passportNo} onChange={(e) => setNf((s) => ({ ...s, passportNo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Doğum tarihi</Label>
              <Input className="h-9 text-sm" type="date" value={nf.birthDate} onChange={(e) => setNf((s) => ({ ...s, birthDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ehliyet no</Label>
              <Input className="h-9 text-sm" value={nf.driverLicenseNo} onChange={(e) => setNf((s) => ({ ...s, driverLicenseNo: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setNewOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={submitCreate} disabled={createMutation.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Müşteriyi düzenle</DialogTitle>
            <DialogDescription className="text-xs">Değişiklikler backend customer servisine yazılır.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Ad soyad *</Label>
              <Input className="h-9 text-sm" value={ef.fullName} onChange={(e) => setEf((s) => ({ ...s, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon *</Label>
              <Input className="h-9 text-sm" value={ef.phone} onChange={(e) => setEf((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-posta *</Label>
              <Input className="h-9 text-sm" type="email" value={ef.email} onChange={(e) => setEf((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TC / kimlik no</Label>
              <Input className="h-9 text-sm" value={ef.nationalId} onChange={(e) => setEf((s) => ({ ...s, nationalId: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pasaport no</Label>
              <Input className="h-9 text-sm" value={ef.passportNo} onChange={(e) => setEf((s) => ({ ...s, passportNo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Doğum tarihi</Label>
              <Input className="h-9 text-sm" type="date" value={ef.birthDate} onChange={(e) => setEf((s) => ({ ...s, birthDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ehliyet no</Label>
              <Input className="h-9 text-sm" value={ef.driverLicenseNo} onChange={(e) => setEf((s) => ({ ...s, driverLicenseNo: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setEditOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={submitEdit} disabled={updateMutation.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Müşteriyi sil</DialogTitle>
            <DialogDescription className="text-xs">
              `{target?.fullName ?? ""}` kaydını silmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setDeleteOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" size="sm" className="h-9 text-xs" onClick={submitDelete} disabled={deleteMutation.isPending}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-3">
        <ListingPanel>
          <ListingToolbar>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="İsim, TC, telefon veya pasaport ara…"
                  className="h-9 border-border/80 bg-background pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Müşteri ara"
                />
              </div>
              <p className="text-xs text-muted-foreground">{filtered.length} kayıt · toplam {rows.length} satır</p>
            </div>
          </ListingToolbar>
          <ListingTableWell>
            {isPending ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Müşteriler yükleniyor…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Sonuç yok.</p>
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>İsim</TableHead>
                    <TableHead className="w-[130px]">TC</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead className="w-[130px] text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="py-2 text-sm font-medium">{row.fullName}</TableCell>
                      <TableCell className="py-2 font-mono text-xs">{row.nationalId || "—"}</TableCell>
                      <TableCell className="py-2 text-xs">{row.phone}</TableCell>
                      <TableCell className="py-2 text-xs">{row.email}</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="secondary" size="sm" className="h-7 w-7 p-0" title="Düzenle" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="destructive" size="sm" className="h-7 w-7 p-0" title="Sil" onClick={() => openDelete(row)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ListingTableWell>
        </ListingPanel>
      </div>
    </div>
  );
}
