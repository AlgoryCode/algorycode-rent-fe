"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CarFront } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/errors";
import { authService } from "@/lib/auth-service";
import { clearRentApiGatewayAuthCache } from "@/lib/rent-api";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Kullanıcı adı ve şifre gerekli.");
      return;
    }
    setLoading(true);
    try {
      const data = await authService.login({ email: username.trim(), password });
      if (data.requiresTwoFactor) {
        toast.error("Bu hesapta 2FA açık", {
          description:
            "Kiralama paneli şimdilik yalnızca doğrudan giriş (basicauth) destekliyor. 2FA kapalı bir kullanıcı deneyin.",
        });
        return;
      }
      toast.success("Giriş yapıldı");
      clearRentApiGatewayAuthCache();
      router.push(from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Giriş yapılamadı";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <CarFront className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">
            Algory<span className="text-primary">Rent</span>
          </span>
        </div>

        <div className="glass glow-card rounded-xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold">Yönetim paneli</h1>
            <p className="text-xs text-muted-foreground">Hesabınızla giriş yapın.</p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="user">Kullanıcı adı (e-posta)</Label>
              <Input
                id="user"
                name="username"
                autoComplete="username"
                placeholder="ornek@sirket.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pass">Şifre</Label>
              <Input
                id="pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
              {loading ? "Giriş…" : "Giriş yap"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
