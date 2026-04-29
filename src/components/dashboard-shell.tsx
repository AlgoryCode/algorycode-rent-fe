"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  Car,
  CarFront,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Layers,
  MapPin,
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

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { getPanelSameOriginAxios } from "@/lib/panel-same-origin-axios";
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

type NavLinkDef = { type: "link"; href: string; msgKey: MessageKey; icon: LucideIcon };
type NavGroupDef = {
  type: "group";
  id: string;
  msgKey: MessageKey;
  icon: LucideIcon;
  children: { href: string; msgKey: MessageKey }[];
};

const ALL_NAV: (NavLinkDef | NavGroupDef)[] = [
  { type: "link", href: "/dashboard", msgKey: "nav.quickMenu", icon: LayoutDashboard },
  {
    type: "group",
    id: "vehicles",
    msgKey: "nav.vehiclesGroup",
    icon: Car,
    children: [
      { href: "/vehicles", msgKey: "nav.vehiclesBrowse" },
      { href: "/settings/options/vehicle", msgKey: "nav.vehicleAddOns" },
      { href: "/settings/vehicle-catalog", msgKey: "nav.vehicleFeatures" },
    ],
  },
  { type: "link", href: "/logs", msgKey: "nav.logs", icon: CalendarDays },
  { type: "link", href: "/calendar", msgKey: "nav.calendar", icon: Calendar },
  { type: "link", href: "/customers", msgKey: "nav.customers", icon: Users },
  { type: "link", href: "/users", msgKey: "nav.users", icon: UserCog },
  { type: "link", href: "/payments", msgKey: "nav.payments", icon: Wallet },
  { type: "link", href: "/reports", msgKey: "nav.reports", icon: BarChart3 },
  { type: "link", href: "/customers/channel", msgKey: "nav.bulkMessage", icon: MessagesSquare },
  { type: "link", href: "/settings/options/rental", msgKey: "nav.rentalOptions", icon: Layers },
  {
    type: "group",
    id: "locations",
    msgKey: "nav.locationsGroup",
    icon: MapPin,
    children: [
      { href: "/settings/locations/pickup", msgKey: "nav.handoverPickup" },
      { href: "/settings/locations/return", msgKey: "nav.handoverReturn" },
      { href: "/countries", msgKey: "nav.countries" },
    ],
  },
  { type: "link", href: "/settings", msgKey: "nav.settings", icon: Settings },
];

const DESKTOP_NAV_DEFS = ALL_NAV.filter((i) => i.type !== "link" || i.href !== "/dashboard");

function navLinkAllows(item: NavLinkDef, hasManagerAccess: boolean): boolean {
  return !hrefRequiresRentManager(item.href) || hasManagerAccess;
}

function navGroupAllows(item: NavGroupDef, hasManagerAccess: boolean): boolean {
  return item.children.some((c) => !hrefRequiresRentManager(c.href) || hasManagerAccess);
}

function isVehiclesGroupActive(pathname: string) {
  if (pathname === "/vehicles" || pathname.startsWith("/vehicles/")) return true;
  if (pathname === "/settings/options/vehicle" || pathname.startsWith("/settings/options/vehicle/")) return true;
  if (pathname === "/settings/vehicle-catalog" || pathname.startsWith("/settings/vehicle-catalog/")) return true;
  return false;
}

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
  if (href === "/users") return pathname === "/users" || pathname.startsWith("/users/");
  if (href === "/settings/locations/pickup") return pathname === "/settings/locations/pickup";
  if (href === "/settings/locations/return") return pathname === "/settings/locations/return";
  if (href === "/settings/options/vehicle") return pathname === "/settings/options/vehicle";
  if (href === "/settings/vehicle-catalog") {
    return pathname === "/settings/vehicle-catalog" || pathname.startsWith("/settings/vehicle-catalog/");
  }
  if (href === "/settings/options/rental") {
    return pathname === "/settings/options/rental" || pathname.startsWith("/settings/options/rental/");
  }
  if (href === "/settings") {
    return (
      pathname === "/settings" &&
      !pathname.startsWith("/settings/options") &&
      !pathname.startsWith("/settings/locations/")
    );
  }
  return false;
}

function isLocationsGroupActive(pathname: string) {
  return (
    pathname.startsWith("/settings/locations/pickup") ||
    pathname.startsWith("/settings/locations/return") ||
    pathname === "/countries" ||
    pathname.startsWith("/countries/")
  );
}

function isNavGroupActive(groupId: string, pathname: string) {
  if (groupId === "vehicles") return isVehiclesGroupActive(pathname);
  if (groupId === "locations") return isLocationsGroupActive(pathname);
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
  const [openByGroupId, setOpenByGroupId] = useState<Record<string, boolean>>(() => ({
    vehicles: isVehiclesGroupActive(pathname),
    locations: isLocationsGroupActive(pathname),
  }));
  const [routeSearch, setRouteSearch] = useState("");
  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentityFromJwt | null>(null);
  const showTemplateActions = pathname !== "/dashboard";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: j, status } = await getPanelSameOriginAxios().get<{ accessToken?: string | null }>(
          "/api/auth/access-token",
          { validateStatus: (s) => s < 500 },
        );
        if (status !== 200 || cancelled) return;
        const t = j?.accessToken?.trim();
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
    () => DESKTOP_NAV_DEFS.filter((item) => (item.type === "link" ? navLinkAllows(item, hasManagerAccess) : navGroupAllows(item, hasManagerAccess))),
    [hasManagerAccess],
  );

  const filteredNav = useMemo(
    () => ALL_NAV.filter((item) => (item.type === "link" ? navLinkAllows(item, hasManagerAccess) : navGroupAllows(item, hasManagerAccess))),
    [hasManagerAccess],
  );

  const searchableRoutes = useMemo(() => {
    const routes: { href: string; label: string }[] = [];
    for (const item of filteredNav) {
      if (item.type === "link") {
        routes.push({ href: item.href, label: t(item.msgKey) });
      } else {
        for (const c of item.children) {
          routes.push({ href: c.href, label: `${t(item.msgKey)} › ${t(c.msgKey)}` });
        }
      }
    }
    routes.push({ href: "/settings/options", label: t("nav.settingsOptionsHub") });
    routes.push({ href: "/login", label: t("nav.login") });
    return routes;
  }, [filteredNav, t]);

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
        className="h-10 rounded-xl border-transparent bg-slate-100 pr-10 text-sm focus-visible:border-sky-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-sky-500"
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
        className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-slate-500 hover:text-sky-600"
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
      <aside className="hidden h-screen w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm sm:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-6 pb-3 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white">
            <CarFront className="h-5 w-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold leading-tight text-slate-900">FleetControl</p>
            <p className="truncate text-xs text-slate-500">Admin Portal</p>
          </div>
        </Link>
        <div className="px-3 pb-2">
          <Button className="h-10 w-full justify-center gap-2 rounded-xl bg-sky-500 text-sm font-semibold text-white hover:bg-sky-600">
            <span className="text-base leading-none">+</span>
            New Booking
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
          {filteredDesktopNav.map((item) => {
            if (item.type === "link") {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-r-4 border-sky-500 bg-sky-50 text-sky-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(item.msgKey)}
                </Link>
              );
            }
            const GroupIcon = item.icon;
            const groupOpen = openByGroupId[item.id] ?? false;
            const groupActive = isNavGroupActive(item.id, pathname);
            return (
              <Collapsible
                key={item.id}
                open={groupOpen}
                onOpenChange={(open) => setOpenByGroupId((prev) => ({ ...prev, [item.id]: open }))}
                className="w-full"
              >
                <CollapsibleTrigger
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    groupActive
                      ? "border-r-4 border-sky-500 bg-sky-50 text-sky-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{t(item.msgKey)}</span>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform", groupOpen && "rotate-180")}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-3 mt-1 space-y-0.5 border-l border-border/60 pl-2">
                  {item.children.map((c) => {
                    const active = isNavActive(pathname, c.href);
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={cn(
                          "flex items-center rounded-md py-1.5 pl-2 pr-2 text-xs font-medium transition-colors",
                          active ? "bg-sky-500 text-white" : "text-muted-foreground hover:bg-slate-50 hover:text-foreground",
                        )}
                      >
                        {t(c.msgKey)}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
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
                {filteredNav.map((item) => {
                  if (item.type === "link") {
                    const active = isNavActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <SheetClose key={item.href} asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors active:bg-muted/80",
                            active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {t(item.msgKey)}
                        </Link>
                      </SheetClose>
                    );
                  }
                  const GroupIcon = item.icon;
                  const groupOpen = openByGroupId[item.id] ?? false;
                  const groupActive = isNavGroupActive(item.id, pathname);
                  return (
                    <Collapsible
                      key={item.id}
                      open={groupOpen}
                      onOpenChange={(open) => setOpenByGroupId((prev) => ({ ...prev, [item.id]: open }))}
                      className="w-full"
                    >
                      <CollapsibleTrigger
                        type="button"
                        className={cn(
                          "flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80",
                          groupActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <GroupIcon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-left">{t(item.msgKey)}</span>
                        <ChevronDown
                          className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", groupOpen && "rotate-180")}
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="ml-3 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                        {item.children.map((c) => {
                          const active = isNavActive(pathname, c.href);
                          return (
                            <SheetClose key={c.href} asChild>
                              <Link
                                href={c.href}
                                className={cn(
                                  "flex min-h-[40px] items-center rounded-md py-2 pl-2 pr-3 text-[13px] font-medium transition-colors active:bg-muted/80",
                                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                {t(c.msgKey)}
                              </Link>
                            </SheetClose>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </nav>

              <div className="flex shrink-0 flex-col border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 w-full gap-2 text-sm font-semibold shadow-sm"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {t("shell.logout")}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/dashboard"
              className="flex min-w-0 max-w-[min(100%,12rem)] items-center gap-2 rounded-md px-1 py-1 -mx-1 outline-none ring-offset-background transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CarFront className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-sm font-semibold">AlgoryRent</span>
            </Link>
          </div>
          <div className="min-w-0 flex-1 px-1">{renderRouteSearch()}</div>
          <div className="flex shrink-0 items-center gap-2">
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

        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md sm:flex">
          {renderRouteSearch("max-w-md")}
          <div className="flex shrink-0 items-center gap-4">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-500 hover:text-sky-500">
              <Bell className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-500 hover:text-sky-500">
              <CircleHelp className="h-4 w-4" />
            </Button>
            <div className="h-8 w-px bg-slate-200" />
            <UserAvatarLogoutMenu session={sessionIdentity} menuPlacement="below" onLogout={() => void logout()} />
          </div>
        </header>

        <div className="sticky top-12 z-20 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:top-16 sm:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {showTemplateActions ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={goBack}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("shell.back")}
              </Button>
            ) : null}
            <Suspense fallback={<div className="h-4 min-w-0 max-w-xs flex-1 animate-pulse rounded bg-muted" aria-hidden />}>
              <AppBreadcrumbs className={showTemplateActions ? "min-w-0 flex-1" : undefined} />
            </Suspense>
          </div>
        </div>

        <main className="flex-1 overflow-auto bg-[#f7f9fb] p-3 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
