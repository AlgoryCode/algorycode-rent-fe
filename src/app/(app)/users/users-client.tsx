"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronRight, Search, UserCog, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { AddEntityButton } from "@/components/ui/add-entity-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useRentFeRoles } from "@/hooks/useRentFeRoles";
import { registerPanelUser } from "@/lib/auth-register";
import type { PanelUserRole } from "@/lib/mock-users";
import { ROLE_LABEL } from "@/lib/mock-users";
import { rentKeys } from "@/lib/rent-query-keys";
import { fetchPanelUsersFromRentApi, getRentApiErrorMessage } from "@/lib/rent-api";

function roleBadgeVariant(role: PanelUserRole): "default" | "secondary" | "outline" {
  switch (role) {
    case "admin":
      return "default";
    case "operator":
      return "secondary";
    case "viewer":
      return "outline";
    default:
      return "outline";
  }
}

export function UsersClient() {
  const { hasManagerAccess } = useRentFeRoles();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const {
    data: sourceList = [],
    isPending: loading,
    error,
  } = useQuery({
    queryKey: rentKeys.panelUsers(),
    queryFn: fetchPanelUsersFromRentApi,
  });
  const loadError = error ? getRentApiErrorMessage(error) : null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...sourceList].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    if (activeOnly) list = list.filter((u) => u.active);
    if (q) {
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          ROLE_LABEL[u.role].toLowerCase().includes(q),
      );
    }
    return list;
  }, [query, activeOnly, sourceList]);

  const resetAddForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setAddError(null);
  };

  const onAddUser = async () => {
    setAddError(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const ph = phone.trim();
    if (!fn || !ln) {
      setAddError("Ad ve soyad zorunludur.");
      return;
    }
    if (!em) {
      setAddError("E-posta zorunludur.");
      return;
    }
    if (!password || password.length < 6) {
      setAddError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    setAddSubmitting(true);
    try {
      await registerPanelUser({
        firstName: fn,
        lastName: ln,
        email: em,
        password,
        phoneNumber: ph || undefined,
      });
      toast.success("Kullanıcı oluşturuldu (AuthService, rol: RENT_USER).");
      resetAddForm();
      setAddOpen(false);
      await queryClient.invalidateQueries({ queryKey: rentKeys.panelUsers() });
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Kayıt başarısız.");
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <UserCog className="h-5 w-5 text-primary" />
            Kullanıcılar
          </h1>
          <p className="text-xs text-muted-foreground">
            Panel kullanıcıları rent API’den gelir. Yeni kayıtlar AuthService’de{" "}
            <span className="font-medium text-foreground">RENT_USER</span> rolü ile açılır. Silmek için satırdan detaya
            gidin; en altta <span className="font-medium text-foreground">Tehlikeli bölge</span> kullanılır.
          </p>
        </div>
        {hasManagerAccess ? (
          <AddEntityButton type="button" icon={UserPlus} onClick={() => setAddOpen(true)}>
            Kullanıcı ekle
          </AddEntityButton>
        ) : null}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni kullanıcı</DialogTitle>
            <DialogDescription>AuthService kaydı — rol sabit: RENT_USER.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="add-fn">Ad</Label>
              <Input id="add-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-ln">Soyad</Label>
              <Input id="add-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-em">E-posta</Label>
              <Input id="add-em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-ph">Telefon (opsiyonel)</Label>
              <Input id="add-ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-pw">Şifre</Label>
              <Input
                id="add-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              İptal
            </Button>
            <Button type="button" size="sm" disabled={addSubmitting} onClick={() => void onAddUser()}>
              {addSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative min-w-0 flex-1">
          <Label htmlFor="user-search" className="sr-only">
            Ara
          </Label>
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="user-search"
            placeholder="İsim, e-posta veya rol ara…"
            className="h-9 pl-9 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-input"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Yalnızca aktif
        </label>
      </div>

      <Card className="glow-card">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-sm">Panel kullanıcıları</CardTitle>
          <CardDescription className="text-xs">
            {loading ? "Yükleniyor…" : loadError ? loadError : `${rows.length} kayıt · toplam ${sourceList.length} kullanıcı`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Sonuç yok.</p>
          ) : (
            <div className="rounded-lg border">
              <div className="space-y-2 p-3 md:hidden">
                {rows.map((u) => (
                  <div key={`mobile-${u.id}`} className="rounded-xl border border-border/70 bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{u.fullName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant={roleBadgeVariant(u.role)} className="text-[10px]">
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{u.active ? "Aktif" : "Pasif"}</span>
                      <span>{format(parseISO(u.lastActiveAt), "d MMM yyyy HH:mm", { locale: tr })}</span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Link href={`/users/${encodeURIComponent(u.id)}`}>
                          Detay
                          <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
              <Table className="min-w-[560px] text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Ad soyad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son aktivite</TableHead>
                    <TableHead className="w-[100px] text-right">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.fullName}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(u.role)} className="text-[10px]">
                          {ROLE_LABEL[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.active ? (
                          <Badge variant="success" className="text-[10px]">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="muted" className="text-[10px]">
                            Pasif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {format(parseISO(u.lastActiveAt), "d MMM yyyy HH:mm", { locale: tr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
                          <Link href={`/users/${encodeURIComponent(u.id)}`}>
                            Detay
                            <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
