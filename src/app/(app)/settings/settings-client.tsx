"use client";

import { useState } from "react";
import { KeyRound, Settings2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/errors";
import { authService } from "@/lib/auth-service";

const MIN_PASSWORD_LEN = 8;

export function SettingsClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitPasswordChange = async () => {
    if (!currentPassword.trim()) {
      toast.error("Mevcut şifreyi girin.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LEN) {
      toast.error(`Yeni şifre en az ${MIN_PASSWORD_LEN} karakter olmalı.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifre ile tekrarı eşleşmiyor.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("Yeni şifre mevcut şifre ile aynı olamaz.");
      return;
    }
    setSubmitting(true);
    try {
      await authService.changePassword({
        currentPassword,
        newPassword,
      });
      toast.success("Şifreniz güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Şifre değiştirilemedi";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Settings2 className="h-5 w-5 text-primary" />
          Ayarlar
        </h1>
        <p className="text-xs text-muted-foreground">Hesap ve güvenlik tercihleri.</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="h-9 w-full justify-start sm:w-auto">
          <TabsTrigger value="general" className="text-xs">
            Genel
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs">
            Güvenlik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card className="glow-card">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Hesap</CardTitle>
              <CardDescription className="text-xs">
                Profil adı, e-posta ve rol bilgileri merkezi Auth servisi üzerinden yönetilir. Burada yalnızca panel
                tercihleri ve güvenlik ayarları bulunur.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4 text-xs text-muted-foreground">
              Oturumu kapatmak için üst menüdeki hesap avatarına tıklayıp{" "}
              <span className="font-medium text-foreground">Çıkış</span> öğesini seçin.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-4">
          <Card className="glow-card">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-primary" />
                Şifre değişikliği
              </CardTitle>
              <CardDescription className="text-xs">
                Mevcut şifrenizi doğrulayarak yeni bir şifre belirleyin. İşlem Auth servisine iletilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-xs">
                  Mevcut şifre
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="h-9 text-sm"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs">
                  Yeni şifre
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-9 text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">En az {MIN_PASSWORD_LEN} karakter.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs">
                  Yeni şifre (tekrar)
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="h-9 text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9"
                disabled={submitting}
                onClick={() => void submitPasswordChange()}
              >
                {submitting ? "Kaydediliyor…" : "Şifreyi güncelle"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
