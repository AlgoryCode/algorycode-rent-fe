"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Search, UserCog } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PanelUser, PanelUserRole } from "@/lib/mock-users";
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
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <UserCog className="h-5 w-5 text-primary" />
          Kullanıcılar
        </h1>
        <p className="text-xs text-muted-foreground">
          Panel kullanıcıları rent API’den gelir. Giriş / oturum hâlâ AuthService üzerindedir.
        </p>
      </div>

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
            <>
              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Ad soyad</th>
                      <th className="px-3 py-2.5">E-posta</th>
                      <th className="px-3 py-2.5">Rol</th>
                      <th className="px-3 py-2.5">Durum</th>
                      <th className="px-3 py-2.5">Son aktivite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-border/60 bg-background transition-colors hover:bg-muted/40 last:border-0"
                      >
                        <td className="px-3 py-2.5 font-medium">{u.fullName}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={roleBadgeVariant(u.role)} className="text-[10px]">
                            {ROLE_LABEL[u.role]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          {u.active ? (
                            <Badge variant="success" className="text-[10px]">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="muted" className="text-[10px]">
                              Pasif
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                          {format(parseISO(u.lastActiveAt), "d MMM yyyy HH:mm", { locale: tr })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {rows.map((u) => (
                  <li key={u.id} className="rounded-lg border bg-background p-3 text-xs transition-colors hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{u.fullName}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                      {u.active ? (
                        <Badge variant="success" className="shrink-0 text-[10px]">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="shrink-0 text-[10px]">
                          Pasif
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={roleBadgeVariant(u.role)} className="text-[10px]">
                        {ROLE_LABEL[u.role]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(u.lastActiveAt), "d MMM yyyy HH:mm", { locale: tr })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
