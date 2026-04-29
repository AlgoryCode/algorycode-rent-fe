"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Building2, Pencil, Search, User, Users } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import {
  addManualCustomer,
  findManualCustomer,
  loadManualCustomerRows,
  mergeSessionAndManualCustomers,
  updateManualCustomer,
} from "@/lib/manual-customers";
import type { CustomerKind } from "@/lib/mock-fleet";
import {
  aggregateCustomersFromSessions,
  mergeCustomerDirectoryStates,
  resolveCustomerKind,
} from "@/lib/rental-metadata";
import { fetchCustomerRecordStatesFromRentApi } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";
import { cn } from "@/lib/utils";

type KindTab = "all" | CustomerKind;

const defaultNewForm = {
  fullName: "",
  phone: "",
  email: "",
  nationalId: "",
  passportNo: "",
  birthDate: "",
  driverLicenseNo: "",
  kind: "individual" as CustomerKind,
};

export function CustomersClient() {
  const router = useRouter();
  const { allSessions } = useFleetSessions();
  const { data: customerRecordStates } = useQuery({
    queryKey: rentKeys.customerRecords(),
    queryFn: fetchCustomerRecordStatesFromRentApi,
    staleTime: 20_000,
  });
  const [query, setQuery] = useState("");
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [manualTick, setManualTick] = useState(0);
  const [nf, setNf] = useState(defaultNewForm);
  const [ef, setEf] = useState(defaultNewForm);

  const rows = useMemo(() => {
    void manualTick;
    const sessionRows = aggregateCustomersFromSessions(allSessions);
    const manualRows = loadManualCustomerRows();
    const merged = mergeSessionAndManualCustomers(sessionRows, manualRows);
    return mergeCustomerDirectoryStates(merged, customerRecordStates);
  }, [allSessions, manualTick, customerRecordStates]);

  const rowsByKind = useMemo(() => {
    if (kindTab === "all") return rows;
    return rows.filter((r) => resolveCustomerKind(r.customer) === kindTab);
  }, [rows, kindTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rowsByKind;
    return rowsByKind.filter(
      ({ customer: c }) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.nationalId ?? "").toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.passportNo.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [rowsByKind, query]);

  const submitNewCustomer = () => {
    if (!nf.fullName.trim() || !nf.phone.trim()) {
      toast.error("Ad soyad ve telefon zorunludur.");
      return;
    }
    addManualCustomer({
      fullName: nf.fullName.trim(),
      phone: nf.phone.trim(),
      email: nf.email.trim() || undefined,
      nationalId: nf.nationalId.trim() || "",
      passportNo: nf.passportNo.trim() || "",
      birthDate: nf.birthDate.trim() || undefined,
      driverLicenseNo: nf.driverLicenseNo.trim() || undefined,
      kind: nf.kind,
    });
    toast.success("Müşteri eklendi.");
    setNewOpen(false);
    setNf({ ...defaultNewForm });
    setManualTick((t) => t + 1);
  };

  const openEditDialog = (key: string) => {
    const m = findManualCustomer(key);
    if (!m) {
      toast.error("Manuel müşteri bulunamadı.");
      return;
    }
    const c = m.customer;
    setEditKey(key);
    setEf({
      fullName: c.fullName,
      phone: c.phone,
      email: c.email ?? "",
      nationalId: c.nationalId ?? "",
      passportNo: c.passportNo ?? "",
      birthDate: (c.birthDate ?? "").slice(0, 10),
      driverLicenseNo: c.driverLicenseNo ?? "",
      kind: c.kind === "corporate" ? "corporate" : "individual",
    });
    setEditOpen(true);
  };

  const submitEditCustomer = () => {
    if (!editKey) return;
    if (!ef.fullName.trim() || !ef.phone.trim()) {
      toast.error("Ad soyad ve telefon zorunludur.");
      return;
    }
    const ok = updateManualCustomer(editKey, {
      fullName: ef.fullName.trim(),
      phone: ef.phone.trim(),
      email: ef.email.trim() || undefined,
      nationalId: ef.nationalId.trim() || "",
      passportNo: ef.passportNo.trim() || "",
      birthDate: ef.birthDate.trim() || undefined,
      driverLicenseNo: ef.driverLicenseNo.trim() || undefined,
      kind: ef.kind,
    });
    if (!ok) {
      toast.error("Güncelleme başarısız.");
      return;
    }
    toast.success("Müşteri güncellendi.");
    setEditOpen(false);
    setEditKey(null);
    setManualTick((t) => t + 1);
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
            <DialogDescription className="text-xs">
              Manuel kayıt tarayıcıda saklanır; tür seçerek bireysel veya kurumsal olarak ekleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Müşteri türü</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNf((s) => ({ ...s, kind: "individual" }))}
                  className={cn(
                    "flex min-h-[3.25rem] items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    nf.kind === "individual"
                      ? "border-emerald-500/50 bg-emerald-500/10 dark:border-emerald-400/40"
                      : "border-border/80 bg-muted/15 hover:bg-muted/30",
                  )}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Bireysel
                </button>
                <button
                  type="button"
                  onClick={() => setNf((s) => ({ ...s, kind: "corporate" }))}
                  className={cn(
                    "flex min-h-[3.25rem] items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    nf.kind === "corporate"
                      ? "border-emerald-500/50 bg-emerald-500/10 dark:border-emerald-400/40"
                      : "border-border/80 bg-muted/15 hover:bg-muted/30",
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Kurumsal
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{nf.kind === "corporate" ? "Firma / unvan *" : "Ad soyad *"}</Label>
                <Input
                  className="h-9 text-sm"
                  value={nf.fullName}
                  onChange={(e) => setNf((s) => ({ ...s, fullName: e.target.value }))}
                  placeholder={nf.kind === "corporate" ? "Örn: ABC Lojistik A.Ş." : "Ad Soyad"}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon *</Label>
                <Input className="h-9 text-sm" value={nf.phone} onChange={(e) => setNf((s) => ({ ...s, phone: e.target.value }))} placeholder="+90 …" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-posta</Label>
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
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setNewOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={submitNewCustomer}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Müşteriyi düzenle</DialogTitle>
            <DialogDescription className="text-xs">
              Yalnızca tarayıcıda saklanan manuel kayıtlar düzenlenebilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Müşteri türü</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEf((s) => ({ ...s, kind: "individual" }))}
                  className={cn(
                    "flex min-h-[3.25rem] items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ef.kind === "individual"
                      ? "border-emerald-500/50 bg-emerald-500/10 dark:border-emerald-400/40"
                      : "border-border/80 bg-muted/15 hover:bg-muted/30",
                  )}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Bireysel
                </button>
                <button
                  type="button"
                  onClick={() => setEf((s) => ({ ...s, kind: "corporate" }))}
                  className={cn(
                    "flex min-h-[3.25rem] items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ef.kind === "corporate"
                      ? "border-emerald-500/50 bg-emerald-500/10 dark:border-emerald-400/40"
                      : "border-border/80 bg-muted/15 hover:bg-muted/30",
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Kurumsal
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{ef.kind === "corporate" ? "Firma / unvan *" : "Ad soyad *"}</Label>
                <Input
                  className="h-9 text-sm"
                  value={ef.fullName}
                  onChange={(e) => setEf((s) => ({ ...s, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon *</Label>
                <Input className="h-9 text-sm" value={ef.phone} onChange={(e) => setEf((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-posta</Label>
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
                <Input
                  className="h-9 text-sm"
                  value={ef.driverLicenseNo}
                  onChange={(e) => setEf((s) => ({ ...s, driverLicenseNo: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setEditOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={submitEditCustomer}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={kindTab} onValueChange={(v) => setKindTab(v as KindTab)} className="w-full">
        <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="all" className="text-xs">
            Tümü
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-1 text-xs">
            <User className="h-3.5 w-3.5" />
            Bireysel
          </TabsTrigger>
          <TabsTrigger value="corporate" className="gap-1 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            Kurumsal
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
              <p className="text-xs text-muted-foreground">
                {filtered.length} kayıt · toplam {rowsByKind.length} satır (sekme:{" "}
                {kindTab === "all" ? "tümü" : kindTab === "individual" ? "bireysel" : "kurumsal"})
              </p>
            </div>
          </ListingToolbar>
          <ListingTableWell>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Sonuç yok.</p>
            ) : (
              <>
              <div className="space-y-2 p-3 md:hidden">
                {filtered.map((row) => {
                  const k = resolveCustomerKind(row.customer);
                  const isManual = row.key.startsWith("manual:");
                  return (
                    <button
                      key={`mobile-${row.key}`}
                      type="button"
                      className="w-full rounded-xl border border-border/70 bg-card p-3 text-left"
                      onClick={() => router.push(`/customers/${encodeURIComponent(row.key)}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{row.customer.fullName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.customer.phone}</p>
                        </div>
                        <Badge variant={k === "corporate" ? "secondary" : "outline"} className="text-[10px]">
                          {k === "corporate" ? "Kurumsal" : "Bireysel"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Kiralama: {row.totalRentals}</span>
                        <span className="text-muted-foreground">
                          {format(parseISO(row.lastActivity), "d MMM yyyy", { locale: tr })}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end gap-1">
                        {isManual && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Düzenle"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(row.key);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/customers/${encodeURIComponent(row.key)}`);
                          }}
                        >
                          Detay
                        </Button>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="hidden md:block">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[76px]">Tür</TableHead>
                    <TableHead>İsim</TableHead>
                    <TableHead className="hidden w-[120px] sm:table-cell">TC</TableHead>
                    <TableHead className="hidden md:table-cell">Telefon</TableHead>
                    <TableHead className="w-[52px] text-center">Kira</TableHead>
                    <TableHead className="hidden w-[130px] lg:table-cell">Son işlem</TableHead>
                    <TableHead className="w-[120px] text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const k = resolveCustomerKind(row.customer);
                    const isManual = row.key.startsWith("manual:");
                    return (
                      <TableRow
                        key={row.key}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => router.push(`/customers/${encodeURIComponent(row.key)}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/customers/${encodeURIComponent(row.key)}`);
                          }
                        }}
                      >
                          <TableCell className="py-2">
                            <Badge variant={k === "corporate" ? "secondary" : "outline"} className="text-[10px]">
                              {k === "corporate" ? "Kurumsal" : "Bireysel"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-sm font-medium">
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {row.customer.fullName}
                              {!row.recordActive && (
                                <Badge variant="muted" className="text-[9px] font-normal">
                                  Pasif
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="hidden py-2 font-mono text-xs sm:table-cell">{row.customer.nationalId || "—"}</TableCell>
                          <TableCell className="hidden py-2 text-xs md:table-cell">{row.customer.phone}</TableCell>
                          <TableCell className="py-2 text-center">
                            <Badge variant="secondary" className="tabular-nums">
                              {row.totalRentals}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden py-2 text-xs text-muted-foreground lg:table-cell">
                            {format(parseISO(row.lastActivity), "d MMM yyyy HH:mm", { locale: tr })}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              {isManual && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Düzenle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(row.key);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/customers/${encodeURIComponent(row.key)}`);
                                }}
                              >
                                Detay
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </ListingTableWell>
        </ListingPanel>
      </div>
    </div>
  );
}
