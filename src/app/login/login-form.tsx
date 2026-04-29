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
import { clearRentApiGatewayAuthCache } from "@/lib/rent-api";

export function LoginForm() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error(t("login.errorCredentials"));
      return;
    }
    setLoading(true);
    try {
      const data = await authService.login({ email: username.trim(), password });
      if (data.requiresTwoFactor) {
        toast.error(t("login.twoFactorTitle"), {
          description: t("login.twoFactorDesc"),
        });
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
            <h1 className="text-lg font-semibold">{t("login.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("login.subtitle")}</p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="user">{t("login.emailLabel")}</Label>
              <Input
                id="user"
                name="username"
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
        </div>
      </div>
    </div>
  );
}
