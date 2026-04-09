"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarDays,
  Car,
  CarFront,
  Globe2,
  LayoutDashboard,
  MailCheck,
  MessagesSquare,
  LogOut,
  Menu,
  Search,
  Settings,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api/errors";
import { authService } from "@/lib/auth-service";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Hızlı menü", icon: LayoutDashboard },
  { href: "/vehicles", label: "Araçlar", icon: Car },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/countries", label: "Ülkeler", icon: Globe2 },
  { href: "/logs", label: "Kiralamalar", icon: CalendarDays },
  { href: "/calendar", label: "Takvim", icon: Calendar },
  { href: "/payments", label: "Ödemeler", icon: Wallet },
  { href: "/requests", label: "Talepler", icon: MailCheck },
  { href: "/users", label: "Kullanıcılar", icon: UserCog },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/customers/channel", label: "Toplu mesaj", icon: MessagesSquare },
  { href: "/settings", label: "Ayarlar", icon: Settings },
] as const;

const desktopNav = nav.filter((i) => i.href !== "/dashboard");
const extraSearchRoutes = [
  { href: "/talep", label: "Talep formu" },
  { href: "/talep/p", label: "Talep kiosku" },
  { href: "/login", label: "Giriş" },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/vehicles") return pathname === "/vehicles" || pathname.startsWith("/vehicles/");
  if (href === "/reports") return pathname === "/reports" || pathname.startsWith("/reports/");
  if (href === "/countries") return pathname === "/countries" || pathname.startsWith("/countries/");
  if (href === "/customers") {
    return (
      pathname === "/customers" ||
      (pathname.startsWith("/customers/") && !pathname.startsWith("/customers/channel"))
    );
  }
  if (href === "/customers/channel") {
    return pathname === "/customers/channel" || pathname.startsWith("/customers/channel/");
  }
  if (href === "/logs") {
    return pathname === "/logs" || pathname.startsWith("/logs/") || pathname.startsWith("/rentals/");
  }
  if (href === "/calendar") return pathname === "/calendar" || pathname.startsWith("/calendar/");
  if (href === "/payments") return pathname === "/payments" || pathname.startsWith("/payments/");
  if (href === "/requests") return pathname === "/requests" || pathname.startsWith("/requests/");
  if (href === "/users") return pathname === "/users" || pathname.startsWith("/users/");
  if (href === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/");
  return false;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");
  const showTemplateActions = pathname !== "/dashboard";

  const searchableRoutes = useMemo(
    () => [...nav, ...extraSearchRoutes].map(({ href, label }) => ({ href, label })),
    [],
  );

  const routeSearchResults = useMemo(() => {
    const query = routeSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return [];
    return searchableRoutes
      .filter((item) => {
        const label = item.label.toLocaleLowerCase("tr-TR");
        const href = item.href.toLocaleLowerCase("tr-TR");
        return label.includes(query) || href.includes(query);
      })
      .slice(0, 8);
  }, [routeSearch, searchableRoutes]);

  const navigateToSearchResult = (href: string) => {
    setRouteSearch("");
    setMobileNavOpen(false);
    router.push(href);
  };

  const renderRouteSearch = (className?: string) => (
    <div className={cn("relative w-full", className)}>
      <Input
        value={routeSearch}
        onChange={(e) => setRouteSearch(e.target.value)}
        placeholder="Sayfa ara..."
        className="h-8 pr-9 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && routeSearchResults.length > 0) {
            e.preventDefault();
            navigateToSearchResult(routeSearchResults[0].href);
          }
          if (e.key === "Escape") {
            setRouteSearch("");
          }
        }}
        aria-label="Sayfa arama"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Aramayı çalıştır"
        onClick={() => {
          if (routeSearchResults.length > 0) {
            navigateToSearchResult(routeSearchResults[0].href);
          }
        }}
      >
        <Search className="h-3.5 w-3.5" />
      </Button>

      {routeSearch.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-md border border-border bg-popover p-1 shadow-md">
          {routeSearchResults.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Sonuç bulunamadı.</p>
          ) : (
            routeSearchResults.map((result) => (
              <button
                key={result.href}
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() => navigateToSearchResult(result.href)}
              >
                <span className="truncate">{result.label}</span>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">{result.href}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await authService.logout();
      toast.success("Çıkış yapıldı");
      setMobileNavOpen(false);
      router.push("/login");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Çıkış sırasında hata";
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-card/50 sm:flex">
        <Link href="/dashboard" className="flex h-12 items-center gap-2 border-b border-border px-4 hover:bg-muted/50">
          <CarFront className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">AlgoryRent</p>
            <p className="truncate text-[10px] text-muted-foreground">Yönetim paneli</p>
          </div>
        </Link>
        <nav className="flex flex-col gap-0.5 p-2">
          {desktopNav.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(100vw,20rem)] max-w-[min(100vw,20rem)] p-0 sm:max-w-sm">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3">
                <Link
                  href="/dashboard"
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <CarFront className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold leading-tight">AlgoryRent</p>
                    <p className="truncate text-[10px] text-muted-foreground">Yönetim paneli</p>
                  </div>
                </Link>
                <SheetClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Menüyü kapat">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>

              <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
                {nav.map(({ href, label, icon: Icon }) => {
                  const active = isNavActive(pathname, href);
                  return (
                    <SheetClose key={href} asChild>
                      <Link
                        href={href}
                        className={cn(
                          "flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors active:bg-muted/80",
                          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>

              <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 text-sm"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <CarFront className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-sm font-semibold">AlgoryRent</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 px-1">{renderRouteSearch()}</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Menüyü aç"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <header className="sticky top-0 z-30 hidden h-11 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:flex">
          {renderRouteSearch("max-w-sm")}
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void logout()}>
            <LogOut className="h-3.5 w-3.5" />
            Çıkış
          </Button>
        </header>

        {showTemplateActions && (
          <div className="sticky top-12 z-20 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:top-11 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={goBack}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Geri
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs sm:hidden" asChild>
                <Link href="/dashboard">Hızlı menüye dön</Link>
              </Button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
