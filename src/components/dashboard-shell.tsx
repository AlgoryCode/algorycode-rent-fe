"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Car, CarFront, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
  { href: "/vehicles", label: "Araçlar", icon: Car },
  { href: "/logs", label: "Kiralamalar", icon: CalendarDays },
  { href: "/customers", label: "Customers", icon: Users },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/vehicles") return pathname === "/vehicles" || pathname.startsWith("/vehicles/");
  if (href === "/customers") return pathname === "/customers" || pathname.startsWith("/customers/");
  if (href === "/logs") return pathname === "/logs" || pathname.startsWith("/logs/");
  return false;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      toast.success("Çıkış yapıldı");
      setMobileNavOpen(false);
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Çıkış sırasında hata");
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
          {nav.map(({ href, label, icon: Icon }) => {
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
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <CarFront className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">AlgoryRent</span>
          </Link>
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
        </header>

        <header className="sticky top-0 z-30 hidden h-11 items-center justify-end border-b border-border bg-background/95 px-4 backdrop-blur sm:flex">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void logout()}>
            <LogOut className="h-3.5 w-3.5" />
            Çıkış
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
