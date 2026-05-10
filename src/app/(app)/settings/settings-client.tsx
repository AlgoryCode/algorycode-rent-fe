"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, KeyRound, Settings2, Shield } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/errors";
import { authService, type TwoFactorSetupPayload } from "@/lib/auth-service";
import { useRentFeRoles } from "@/hooks/useRentFeRoles";
import {
  decodeJwtPayloadBrowser,
  formatSessionDisplayName,
  parseSessionIdentityFromJwtPayload,
  type SessionIdentityFromJwt,
} from "@/lib/jwt-payload-browser";
import {
  DEFAULT_PANEL_NOTIFICATION_PREFS,
  loadPanelNotificationPreferences,
  savePanelNotificationPreferences,
  type PanelNotificationPreferences,
} from "@/lib/notification-preferences";
import { getPanelSameOriginAxios } from "@/lib/panel-same-origin-axios";

const MIN_PASSWORD_LEN = 8;

function jwtSubject(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const sub = payload.sub;
  return typeof sub === "string" && sub.trim() ? sub.trim() : null;
}

function jwtExpiresAt(payload: Record<string, unknown> | null): Date | null {
  if (!payload) return null;
  const exp = payload.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) return new Date(exp * 1000);
  return null;
}

export function SettingsClient() {
  const { t } = useLocale();
  const { roles } = useRentFeRoles();
  const [activeTab, setActiveTab] = useState("general");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentityFromJwt | null>(null);
  const [tokenPayload, setTokenPayload] = useState<Record<string, unknown> | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<PanelNotificationPreferences>(DEFAULT_PANEL_NOTIFICATION_PREFS);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupPayload | null>(null);
  const [twoFactorActivateCode, setTwoFactorActivateCode] = useState("");
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState<"setup" | "activate" | "disable" | null>(null);

  useEffect(() => {
    setNotificationPrefs(loadPanelNotificationPreferences());
  }, []);

  const patchNotificationPrefs = (partial: Partial<PanelNotificationPreferences>) => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, ...partial };
      savePanelNotificationPreferences(next);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: j, status } = await getPanelSameOriginAxios().get<{ accessToken?: string | null }>(
          "/api/auth/access-token",
          { validateStatus: (s) => s < 500 },
        );
        if (status !== 200 || cancelled) return;
        const raw = j?.accessToken?.trim();
        if (!raw || cancelled) {
          if (!cancelled) setTokenLoaded(true);
          return;
        }
        const decoded = decodeJwtPayloadBrowser(raw);
        if (!cancelled) {
          setTokenPayload(decoded);
          setSessionIdentity(decoded ? parseSessionIdentityFromJwtPayload(decoded) : null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setTokenLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = useMemo(() => formatSessionDisplayName(sessionIdentity), [sessionIdentity]);
  const subject = jwtSubject(tokenPayload);
  const expiresAt = jwtExpiresAt(tokenPayload);

  const sessionExpiryLabel = useMemo(() => {
    if (!expiresAt) return null;
    try {
      return expiresAt.toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return expiresAt.toISOString();
    }
  }, [expiresAt]);

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

  const fetchTwoFactorSetupInfo = async () => {
    setTwoFactorBusy("setup");
    try {
      const payload = await authService.fetchTwoFactorSetup();
      setTwoFactorSetup(payload);
      toast.success(t("settings.twoFactorToastSetup"));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || /already enabled/i.test(err.message))) {
        toast.error(t("settings.twoFactorConflict"));
      } else {
        const message = err instanceof ApiError ? err.message : "2FA kurulumu alınamadı";
        toast.error(message);
      }
    } finally {
      setTwoFactorBusy(null);
    }
  };

  const submitTwoFactorActivate = async () => {
    const code = twoFactorActivateCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error(t("login.errorCredentials"));
      return;
    }
    setTwoFactorBusy("activate");
    try {
      await authService.activateTwoFactor(code);
      setTwoFactorActivateCode("");
      setTwoFactorSetup(null);
      toast.success(t("settings.twoFactorToastOn"));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("login.errorGeneric");
      toast.error(message);
    } finally {
      setTwoFactorBusy(null);
    }
  };

  const submitTwoFactorDisable = async () => {
    const code = twoFactorDisableCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error(t("login.errorCredentials"));
      return;
    }
    setTwoFactorBusy("disable");
    try {
      await authService.disableTwoFactor(code);
      setTwoFactorDisableCode("");
      toast.success(t("settings.twoFactorToastOff"));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("login.errorGeneric");
      toast.error(message);
    } finally {
      setTwoFactorBusy(null);
    }
  };

  const copyTwoFactorSecret = async () => {
    if (!twoFactorSetup) return;
    try {
      await navigator.clipboard.writeText(twoFactorSetup.secret);
      toast.success(t("settings.twoFactorCopied"));
    } catch {
      toast.error(t("login.errorGeneric"));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Settings2 className="h-5 w-5 text-primary" />
          Hesabım
        </h1>
        <p className="text-xs text-muted-foreground">Hesap bilgileri ve ayar tercihleri.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto min-h-9 w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="general" className="text-xs">
            Hesap Bilgileri
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs">
            Ayarlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card className="glow-card">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Hesap</CardTitle>
              <CardDescription className="text-xs">
                Aşağıdaki bilgiler oturum jetonundan okunur; profil güncellemeleri merkezi kimlik sunucusu üzerinden
                yapılır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4 text-xs">
              {!tokenLoaded ? (
                <p className="text-muted-foreground">Yükleniyor…</p>
              ) : !tokenPayload ? (
                <p className="text-muted-foreground">
                  Oturum bilgisi alınamadı. Oturumu kapatıp yeniden giriş yapmayı deneyin.
                </p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:gap-x-4 sm:gap-y-2">
                  <dt className="text-muted-foreground">Görünen ad</dt>
                  <dd className="font-medium text-foreground">{displayName}</dd>
                  {sessionIdentity?.email ? (
                    <>
                      <dt className="text-muted-foreground">E-posta</dt>
                      <dd className="break-all font-mono text-[11px] text-foreground">{sessionIdentity.email}</dd>
                    </>
                  ) : null}
                  {sessionIdentity?.firstName ? (
                    <>
                      <dt className="text-muted-foreground">Ad</dt>
                      <dd className="text-foreground">{sessionIdentity.firstName}</dd>
                    </>
                  ) : null}
                  {sessionIdentity?.lastName ? (
                    <>
                      <dt className="text-muted-foreground">Soyad</dt>
                      <dd className="text-foreground">{sessionIdentity.lastName}</dd>
                    </>
                  ) : null}
                  {subject ? (
                    <>
                      <dt className="text-muted-foreground">Konu (sub)</dt>
                      <dd className="break-all font-mono text-[11px] text-foreground">{subject}</dd>
                    </>
                  ) : null}
                  {sessionExpiryLabel ? (
                    <>
                      <dt className="text-muted-foreground">Jeton sonu</dt>
                      <dd className="tabular-nums text-foreground">{sessionExpiryLabel}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Panel rolleri</dt>
                  <dd>
                    {roles.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {roles.map((r) => (
                          <li
                            key={r}
                            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground"
                          >
                            {r}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">Tanımlı rol yok veya çerezde yok.</span>
                    )}
                  </dd>
                </dl>
              )}
              <p className="text-muted-foreground">
                Oturumu kapatmak için üst menüdeki hesap avatarına tıklayıp{" "}
                <span className="font-medium text-foreground">Çıkış</span> öğesini seçin.
              </p>
              <div>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setActiveTab("security")}>
                  Şifre ayarlarına git
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card className="glow-card">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-primary" aria-hidden />
                Bildirim tercihleri
              </CardTitle>
              <CardDescription className="text-xs">
                Seçimler bu tarayıcıda saklanır. Gerçek e-posta veya anlık bildirim gönderimi sunucu tarafındaki
                yapılandırmaya bağlıdır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-xs transition-colors hover:bg-muted/30">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Operasyonel e-postalar</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Rezervasyon ve teslimat ile ilgili özet bildirimleri.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  checked={notificationPrefs.emailOperational}
                  onChange={(e) => patchNotificationPrefs({ emailOperational: e.target.checked })}
                />
              </label>
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-xs transition-colors hover:bg-muted/30">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Ürün ve ipuçları</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Panel güncellemeleri ve kullanım önerileri (e-posta).
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  checked={notificationPrefs.emailMarketing}
                  onChange={(e) => patchNotificationPrefs({ emailMarketing: e.target.checked })}
                />
              </label>
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-xs transition-colors hover:bg-muted/30">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Önemli uyarılar (panel içi)</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Kritik işlemler için panelde bildirim göster (gelecekteki özelliklere öncülük eder).
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  checked={notificationPrefs.inAppImportant}
                  onChange={(e) => patchNotificationPrefs({ inAppImportant: e.target.checked })}
                />
              </label>
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-xs transition-colors hover:bg-muted/30">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">Tarayıcı bildirimleri</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    İzin verildiğinde masaüstü bildirimleri (tarayıcı ayarlarından yönetilir).
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  checked={notificationPrefs.browserNotifications}
                  onChange={(e) => patchNotificationPrefs({ browserNotifications: e.target.checked })}
                />
              </label>
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

          <Card className="glow-card">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" aria-hidden />
                {t("settings.twoFactorTitle")}
              </CardTitle>
              <CardDescription className="text-xs">{t("settings.twoFactorDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                disabled={twoFactorBusy !== null}
                onClick={() => void fetchTwoFactorSetupInfo()}
              >
                {twoFactorBusy === "setup" ? "…" : t("settings.twoFactorSetupBtn")}
              </Button>

              {twoFactorSetup ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-[11px] text-muted-foreground">{t("settings.twoFactorQrHint")}</p>
                  <img
                    src={`data:image/png;base64,${twoFactorSetup.qrImageBase64}`}
                    alt=""
                    className="mx-auto max-h-44 w-auto rounded-md border border-border bg-background p-1"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={() => void copyTwoFactorSecret()}>
                      {t("settings.twoFactorCopySecret")}
                    </Button>
                  </div>
                  <p className="break-all font-mono text-[11px] text-foreground">{twoFactorSetup.secret}</p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="twofactor-activate" className="text-xs">
                  {t("settings.twoFactorActivateLabel")}
                </Label>
                <Input
                  id="twofactor-activate"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-9 font-mono text-sm tracking-widest"
                  placeholder="000000"
                  value={twoFactorActivateCode}
                  onChange={(e) => setTwoFactorActivateCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={twoFactorBusy !== null || twoFactorActivateCode.length !== 6}
                  onClick={() => void submitTwoFactorActivate()}
                >
                  {twoFactorBusy === "activate" ? "…" : t("settings.twoFactorActivateBtn")}
                </Button>
              </div>

              <div className="space-y-1.5 border-t border-border/60 pt-4">
                <Label htmlFor="twofactor-disable" className="text-xs">
                  {t("settings.twoFactorDisableLabel")}
                </Label>
                <Input
                  id="twofactor-disable"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-9 font-mono text-sm tracking-widest"
                  placeholder="000000"
                  value={twoFactorDisableCode}
                  onChange={(e) => setTwoFactorDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-9"
                  disabled={twoFactorBusy !== null || twoFactorDisableCode.length !== 6}
                  onClick={() => void submitTwoFactorDisable()}
                >
                  {twoFactorBusy === "disable" ? "…" : t("settings.twoFactorDisableBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
