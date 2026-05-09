"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

export default function LocationsSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();

  const tabs = [
    { href: "/settings/locations/pickup", label: t("nav.handoverPickup") },
    { href: "/settings/locations/return", label: t("nav.handoverReturn") },
    { href: "/settings/locations/countries", label: t("nav.countries") },
  ];

  const isActive = (href: string) => {
    if (href === "/settings/locations/countries") {
      return pathname.startsWith("/settings/locations/countries");
    }
    return pathname === href;
  };

  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap gap-2 rounded-xl border border-border/80 bg-muted/25 p-1.5 dark:bg-muted/15"
        aria-label={t("nav.locationsGroup")}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:justify-start sm:px-5",
              isActive(tab.href)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
