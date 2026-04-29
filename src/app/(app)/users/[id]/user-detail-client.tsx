"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, UserCog } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PanelUserRole } from "@/lib/mock-users";
import { ROLE_LABEL } from "@/lib/mock-users";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  deletePanelUserOnRentApi,
  fetchPanelUsersFromRentApi,
  getRentApiErrorMessage,
} from "@/lib/rent-api";

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

type Props = { userId: string };

export function UserDetailClient({ userId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [userDeleteStep, setUserDeleteStep] = useState<"idle" | "confirm">("idle");

  const {
    data: list = [],
    isPending,
    error,
  } = useQuery({
    queryKey: rentKeys.panelUsers(),
    queryFn: fetchPanelUsersFromRentApi,
  });
  const loadError = error ? getRentApiErrorMessage(error) : null;

  const decodedId = useMemo(() => {
    try {
      return decodeURIComponent(userId);
    } catch {
      return userId;
    }
  }, [userId]);

  const user = useMemo(() => list.find((u) => u.id === decodedId), [list, decodedId]);

  const deleteMutation = useMutation({
    mutationFn: () => deletePanelUserOnRentApi(decodedId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rentKeys.panelUsers() });
      toast.success("Kullanıcı silindi.");
      setUserDeleteStep("idle");
      router.push("/users");
    },
    onError: (e) => toast.error(getRentApiErrorMessage(e)),
  });

  const runDelete = () => void deleteMutation.mutateAsync();

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs text-destructive">{loadError}</p>
        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
          <Link href="/users">Kullanıcı listesine dön</Link>
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="glow-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Kullanıcı bulunamadı.
            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                <Link href="/users">Listeye dön</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
          <Link href="/users">
            <ArrowLeft className="h-3.5 w-3.5" />
            Kullanıcılar
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <UserCog className="h-5 w-5 text-primary" />
          {user.fullName}
        </h1>
        <p className="text-xs text-muted-foreground">
          Panel kullanıcı detayı — silmek için aşağıdaki{" "}
          <a href="#tehlikeli-bolge" className="font-medium text-destructive underline-offset-4 hover:underline">
            Tehlikeli bölge
          </a>
          .
        </p>
      </div>

      <Card className="glow-card">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-sm">Bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p>
            <span className="text-muted-foreground">E-posta:</span>{" "}
            <span className="font-mono text-[11px]">{user.email}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Rol:</span>
            <Badge variant={roleBadgeVariant(user.role)} className="text-[10px]">
              {ROLE_LABEL[user.role]}
            </Badge>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Durum:</span>
            {user.active ? (
              <Badge variant="success" className="text-[10px]">
                Aktif
              </Badge>
            ) : (
              <Badge variant="muted" className="text-[10px]">
                Pasif
              </Badge>
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Son aktivite:</span>{" "}
            {format(parseISO(user.lastActiveAt), "d MMM yyyy HH:mm", { locale: tr })}
          </p>
        </CardContent>
      </Card>

      <Card
        id="tehlikeli-bolge"
        className="scroll-mt-24 border-destructive/35 bg-gradient-to-b from-destructive/[0.06] to-destructive/[0.02] shadow-sm"
      >
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Tehlikeli bölge
          </CardTitle>
          <CardDescription className="text-xs text-destructive/85">
            Bu kullanıcıyı silmek kalıcıdır; <span className="font-mono">{user.email}</span> ile ilişkili panel kaydı
            kaldırılır. Giriş hesabı AuthService tarafında ayrı yönetiliyorsa orayı da güncellemeniz gerekebilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          {userDeleteStep === "idle" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9 w-full text-xs sm:w-auto"
              disabled={deleteMutation.isPending}
              onClick={() => setUserDeleteStep("confirm")}
            >
              Kullanıcıyı sil
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-background/60 p-3 dark:bg-background/20">
              <p className="text-xs font-medium leading-relaxed text-destructive">
                <span className="font-semibold">{user.fullName}</span> (
                <span className="font-mono">{user.email}</span>) kalıcı olarak silinsin mi? Bu işlem geri alınamaz.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-9 text-xs"
                  disabled={deleteMutation.isPending}
                  onClick={() => void runDelete()}
                >
                  {deleteMutation.isPending ? "Siliniyor…" : "Evet, sil"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  disabled={deleteMutation.isPending}
                  onClick={() => setUserDeleteStep("idle")}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
