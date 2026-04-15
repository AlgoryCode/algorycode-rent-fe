"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
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
  MapPin,
  MapPinned,
  Menu,
  PackagePlus,
  Search,
  Settings,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { LanguageSelect } from "@/components/language-select";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { ApiError } from "@/lib/api/errors";
import { authService } from "@/lib/auth-service";
import {
  decodeJwtPayloadBrowser,
  formatSessionDisplayName,
  initialsFromSessionIdentity,
  parseSessionIdentityFromJwtPayload,
  type SessionIdentityFromJwt,
} from "@/lib/jwt-payload-browser";
import type { MessageKey } from "@/lib/i18n/messages";
import { hrefRequiresRentManager } from "@/lib/rbac/route-policy";
import { cn } from "@/lib/utils";
import { useRentFeRoles } from "@/hooks/useRentFeRoles";

type NavItemDef = { href: string; msgKey: MessageKey; icon: LucideIcon };

const ALL_NAV: NavItemDef[] = [
  { href: "/dashboard", msgKey: "nav.quickMenu", icon: LayoutDashboard },
  { href: "/vehicles", msgKey: "nav.vehicles", icon: Car },
  { href: "/logs", msgKey: "nav.logs", icon: CalendarDays },
  { href: "/calendar", msgKey: "nav.calendar", icon: Calendar },
  { href: "/customers", msgKey: "nav.customers", icon: Users },
  { href: "/requests", msgKey: "nav.requests", icon: MailCheck },
  { href: "/users", msgKey: "nav.users", icon: UserCog },
  { href: "/payments", msgKey: "nav.payments", icon: Wallet },
  { href: "/reports", msgKey: "nav.reports", icon: BarChart3 },
  { href: "/countries", msgKey: "nav.countries", icon: Globe2 },
  { href: "/customers/channel", msgKey: "nav.bulkMessage", icon: MessagesSquare },
  { href: "/settings/locations/pickup", msgKey: "nav.handoverPickup", icon: MapPin },
  { href: "/settings/locations/return", msgKey: "nav.handoverReturn", icon: MapPinned },
  { href: "/settings/option-templates", msgKey: "nav.optionTemplates", icon: PackagePlus },
  { href: "/settings", msgKey: "nav.settings", icon: Settings },
];

const DESKTOP_NAV_DEFS = ALL_NAV.filter((i) => i.href !== "/dashboard");

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
  if (href === "/settings/locations/pickup") return pathname === "/settings/locations/pickup";
  if (href === "/settings/locations/return") return pathname === "/settings/locations/return";
  if (href === "/settings/option-templates") return pathname === "/settings/option-templates";
  if (href === "/settings") return pathname === "/settings";
  return false;
}

function UserAvatarLogoutMenu({
  session,
  onLogout,
  menuPlacement,
  afterNavigate,
}: {
  session: SessionIdentityFromJwt | null;
  onLogout: () => void;
  menuPlacement: "below" | "above";
  afterNavigate?: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = useMemo(() => initialsFromSessionIdentity(session), [session]);
  const displayName = useMemo(() => formatSessionDisplayName(session), [session]);
  const emailLine = session?.email?.trim() ?? "";

  const closeFromLink = () => {
    setOpen(false);
    afterNavigate?.();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const menuRowClass =
    "flex items-center gap-2 px-2 py-1.5 text-xs text-foreground no-underline outline-none transition-colors hover:bg-muted focus-visible:bg-muted";

  return (
    <div ref={rootRef} className={cn("relative", menuPlacement === "above" && "flex justify-center")}>
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-semibold text-foreground ring-offset-background transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          menuPlacement === "below" ? "h-8 w-8 text-[11px]" : "h-11 w-11 text-xs",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("shell.accountMenu")}
        onClick={() => setOpen((v) => !v)}
      >
        {initials}
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-50 w-[min(13.5rem,calc(100vw-1.25rem))] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-border/50",
            menuPlacement === "below"
              ? "right-0 top-[calc(100%+0.25rem)]"
              : "bottom-[calc(100%+0.25rem)] left-1/2 -translate-x-1/2",
          )}
          role="menu"
        >
          <div className="flex gap-2 px-2 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-[10px] font-semibold text-primary"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={emailLine || undefined}>
                {emailLine || "—"}
              </p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="py-0.5">
            <Link href="/settings" role="menuitem" className={menuRowClass} onClick={closeFromLink}>
              <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {t("nav.settings")}
            </Link>
          </div>

          <div className="border-t border-border" />

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md bg-red-600 px-2 py-1.5 text-left text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:bg-red-600 dark:hover:bg-red-500"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {t("shell.logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RentRbacToastInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    if (searchParams.get("yetkisiz") !== "1") return;
    toast.info(t("shell.rbacToast"));
    const next = new URLSearchParams(searchParams.toString());
    next.delete("yetkisiz");
    const q = next.toString();
    router.replace(q ? `/dashboard?${q}` : "/dashboard", { scroll: false });
  }, [searchParams, router, t]);

  return null;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { hasManagerAccess } = useRentFeRoles();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");
  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentityFromJwt | null>(null);
  const showTemplateActions = pathname !== "/dashboard";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/auth/access-token", { credentials: "same-origin", cache: "no-store" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { accessToken?: string | null };
        const t = j.accessToken?.trim();
        if (!t || cancelled) return;
        const identity = parseSessionIdentityFromJwtPayload(decodeJwtPayloadBrowser(t));
        if (!cancelled) setSessionIdentity(identity);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchLocaleTag = locale === "tr" ? "tr-TR" : locale === "sq" ? "sq-AL" : "en-US";

  const filteredDesktopNav = useMemo(
    () =>
      DESKTOP_NAV_DEFS.filter((item) => !hrefRequiresRentManager(item.href) || hasManagerAccess).map((item) => ({
        href: item.href,
        icon: item.icon,
        label: t(item.msgKey),
      })),
    [hasManagerAccess, t],
  );

  const filteredNav = useMemo(
    () =>
      ALL_NAV.filter((item) => !hrefRequiresRentManager(item.href) || hasManagerAccess).map((item) => ({
        href: item.href,
        icon: item.icon,
        label: t(item.msgKey),
      })),
    [hasManagerAccess, t],
  );

  const searchableRoutes = useMemo(
    () => [...filteredNav, { href: "/login", label: t("nav.login") }],
    [filteredNav, t],
  );

  const routeSearchResults = useMemo(() => {
    const query = routeSearch.trim().toLocaleLowerCase(searchLocaleTag);
    if (!query) return [];
    return searchableRoutes
      .filter((item) => {
        const label = item.label.toLocaleLowerCase(searchLocaleTag);
        const href = item.href.toLocaleLowerCase(searchLocaleTag);
        return label.includes(query) || href.includes(query);
      })
      .slice(0, 8);
  }, [routeSearch, searchableRoutes, searchLocaleTag]);

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
        placeholder={t("shell.searchPlaceholder")}
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
        aria-label={t("shell.searchAria")}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={t("shell.searchRun")}
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
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("shell.searchNoResults")}</p>
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
      toast.success(t("toast.logoutOk"));
      setMobileNavOpen(false);
      router.push("/login");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("toast.logoutFail");
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Suspense fallback={null}>
        <RentRbacToastInner />
      </Suspense>
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-card/50 sm:flex">
        <Link href="/dashboard" className="flex h-12 items-center gap-2 border-b border-border px-4 hover:bg-muted/50">
          <CarFront className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">AlgoryRent</p>
            <p className="truncate text-[10px] text-muted-foreground">{t("shell.subtitle")}</p>
          </div>
        </Link>
        <nav className="flex flex-col gap-0.5 p-2">
          {filteredDesktopNav.map(({ href, label, icon: Icon }) => {
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
                    <p className="truncate text-[10px] text-muted-foreground">{t("shell.subtitle")}</p>
                  </div>
                </Link>
                <SheetClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("shell.menuClose")}>
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>

              <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
                {filteredNav.map(({ href, label, icon: Icon }) => {
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

              <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <LanguageSelect variant="compact" />
                <UserAvatarLogoutMenu
                  session={sessionIdentity}
                  menuPlacement="above"
                  onLogout={() => void logout()}
                  afterNavigate={() => setMobileNavOpen(false)}
                />
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
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSelect variant="compact" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label={t("shell.menuOpen")}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <header className="sticky top-0 z-30 hidden h-11 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:flex">
          {renderRouteSearch("max-w-sm")}
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSelect variant="header" />
            <UserAvatarLogoutMenu session={sessionIdentity} menuPlacement="below" onLogout={() => void logout()} />
          </div>
        </header>

        <div className="sticky top-12 z-20 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:top-11 sm:px-4">
          <Suspense fallback={<div className="h-4 max-w-xs animate-pulse rounded bg-muted" aria-hidden />}>
            <AppBreadcrumbs />
          </Suspense>
          {showTemplateActions ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={goBack}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("shell.back")}
              </Button>
            </div>
          ) : null}
        </div>

        <main className="flex-1 overflow-auto p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
