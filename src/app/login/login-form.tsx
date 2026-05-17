"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CarFront } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { LanguageSelect } from "@/components/language-select";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";
import { authService } from "@/lib/auth-service";
import { isSupabaseAuthEnabled } from "@/lib/data-source";
import { clearRentApiGatewayAuthCache } from "@/lib/rent-api";

export function LoginForm() {
  const { t } = useLocale();
  const supabaseAuth = isSupabaseAuthEnabled();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaiting2FA, setAwaiting2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [twoFactorHintEmail, setTwoFactorHintEmail] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const cancelTwoFactor = async () => {
    await authService.logout().catch(() => undefined);
    setAwaiting2FA(false);
    setTotpCode("");
    setTwoFactorHintEmail(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error(t("login.errorCredentials"));
      return;
    }
    setLoading(true);
    try {
      const data = (await authService.login({ email: username.trim(), password })) as {
        requiresTwoFactor?: boolean;
        email?: string;
      };
      if (!supabaseAuth && data.requiresTwoFactor) {
        setTwoFactorHintEmail(data.email ?? username.trim());
        setAwaiting2FA(true);
        setTotpCode("");
        return;
      }
      toast.success(t("login.success"));
      clearRentApiGatewayAuthCache();
      router.push(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("login.errorGeneric");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = totpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error(t("login.errorCredentials"));
      return;
    }
    setLoading(true);
    try {
      await authService.completeTwoFactorLogin(code);
      setAwaiting2FA(false);
      setTotpCode("");
      setTwoFactorHintEmail(null);
      toast.success(t("login.success"));
      clearRentApiGatewayAuthCache();
      router.push(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("login.errorGeneric");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const show2FA = !supabaseAuth && awaiting2FA;

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center px-4">
      <div className="fixed z-50 flex flex-col items-end gap-0.5 sm:gap-1 right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] sm:right-[max(1.5rem,env(safe-area-inset-right))] sm:top-[max(1.5rem,env(safe-area-inset-top))]">
        <span className="text-[10px] font-medium text-muted-foreground">{t("lang.section")}</span>
        <LanguageSelect variant="header" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <CarFront className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">
            Algory<span className="text-primary">Rent</span>
          </span>
        </div>

        <div className="glass glow-card rounded-xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold">
              {show2FA ? t("login.twoFactorStepTitle") : t("login.title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {show2FA
                ? twoFactorHintEmail
                  ? `${t("login.twoFactorEmailIntro")} ${twoFactorHintEmail}`
                  : t("login.twoFactorStepSubtitle")
                : t("login.subtitle")}
            </p>
          </div>

          {show2FA ? (
            <form onSubmit={(e) => void onSubmitTwoFactor(e)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="totp">{t("login.twoFactorCodeLabel")}</Label>
                <Input
                  id="totp"
                  name="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="tracking-widest font-mono text-center text-base"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <Button
                type="submit"
                variant="hero"
                className="w-full"
                size="lg"
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? t("login.twoFactorVerifying") : t("login.twoFactorVerify")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => void cancelTwoFactor()}
              >
                {t("login.twoFactorCancel")}
              </Button>
            </form>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="user">{t("login.emailLabel")}</Label>
                <Input
                  id="user"
                  name="username"
                  type="email"
                  autoComplete="username"
                  placeholder={t("login.emailPlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pass">{t("login.passwordLabel")}</Label>
                <Input
                  id="pass"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
                {loading ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}