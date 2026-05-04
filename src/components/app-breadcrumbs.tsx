"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useMemo } from "react";

import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

function normalizePath(path: string): string {
  const p = path.replace(/\/+$/, "") || "/";
  return p;
}

function buildBreadcrumbs(
  pathname: string,
  search: URLSearchParams,
  vehicleLabelById: Map<string, string>,
): BreadcrumbItem[] {
  const path = normalizePath(pathname);

  if (path === "/dashboard") {
    return [{ label: "Hızlı menü" }];
  }

  if (path === "/vehicles/new") {
    return [{ label: "Araçlar", href: "/vehicles" }, { label: "Yeni araç" }];
  }

  const vehicleOptions = path.match(/^\/vehicles\/([^/]+)\/options$/);
  if (vehicleOptions) {
    const id = vehicleOptions[1];
    const shortTitle = vehicleLabelById.get(id) ?? "Araç";
    return [{ label: "Araçlar", href: "/vehicles" }, { label: shortTitle, href: `/vehicles/${id}` }, { label: "Opsiyon ekle" }];
  }

  const vehicleNewRent = path.match(/^\/vehicles\/([^/]+)\/new-rent$/);
  if (vehicleNewRent) {
    const id = vehicleNewRent[1];
    const shortTitle = vehicleLabelById.get(id) ?? "Araç detayı";
    return [
      { label: "Kiralamalar", href: "/logs" },
      { label: shortTitle, href: `/vehicles/${id}` },
      { label: "Yeni kiralama" },
    ];
  }

  const vehicleDetail = path.match(/^\/vehicles\/([^/]+)$/);
  if (vehicleDetail) {
    const id = vehicleDetail[1];
    const shortTitle = vehicleLabelById.get(id) ?? "Araç detayı";
    const rentalPage = search.get("sayfa") === "kiralama" || search.get("yeniKiralama") === "1";
    if (rentalPage) {
      return [
        { label: "Kiralamalar", href: "/logs" },
        { label: "Araç detayı", href: `/vehicles/${id}` },
        { label: "Yeni kiralama" },
      ];
    }
    return [{ label: "Araçlar", href: "/vehicles" }, { label: shortTitle }];
  }

  if (path === "/vehicles") {
    return [{ label: "Araçlar" }];
  }

  const rentalDetail = path.match(/^\/rentals\/([^/]+)$/);
  if (rentalDetail) {
    return [{ label: "Kiralamalar", href: "/logs" }, { label: "Kiralama detayı" }];
  }

  if (path === "/logs") {
    const sekme = search.get("sekme");
    if (sekme === "istekler") {
      return [{ label: "Kiralamalar", href: "/logs" }, { label: "Kiralama istekleri" }];
    }
    if (sekme === "baslat") {
      return [{ label: "Kiralamalar", href: "/logs" }, { label: "Kiralama başlat" }];
    }
    return [{ label: "Kiralamalar" }];
  }

  if (path === "/calendar") {
    return [{ label: "Takvim" }];
  }

  if (path === "/customers/channel" || path.startsWith("/customers/channel/")) {
    return [{ label: "Müşteriler", href: "/customers" }, { label: "Toplu mesaj" }];
  }

  const customerDetail = path.match(/^\/customers\/([^/]+)$/);
  if (customerDetail) {
    return [{ label: "Müşteriler", href: "/customers" }, { label: "Müşteri detayı" }];
  }

  if (path === "/customers") {
    return [{ label: "Müşteriler" }];
  }

  const userDetail = path.match(/^\/users\/([^/]+)$/);
  if (userDetail) {
    return [{ label: "Kullanıcılar", href: "/users" }, { label: "Kullanıcı detayı" }];
  }

  if (path === "/countries" || path.startsWith("/countries/")) {
    return [{ label: "Lokasyonlar", href: "/settings/locations/pickup" }, { label: "Ülkeler" }];
  }

  const staticLabels: Record<string, string> = {
    "/payments": "Ödemeler",
    "/reports": "Raporlar",
    "/users": "Kullanıcılar",
    "/settings": "Ayarlar",
    "/settings/locations/pickup": "Alış noktaları",
    "/settings/locations/return": "Teslim noktaları",
    "/settings/options": "Opsiyonlar",
    "/settings/options/vehicle": "Araç opsiyonları",
    "/settings/options/rental": "Kiralama Opsiyonları",
    "/settings/vehicle-catalog": "Araç özellikleri",
  };

  const label = staticLabels[path];
  if (label) {
    return [{ label }];
  }

  return [{ label: "Sayfa", href: "/dashboard" }];
}

export function AppBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { allVehicles } = useFleetVehicles();

  const vehicleLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of allVehicles) {
      m.set(v.id, `${v.plate} · ${v.brand} ${v.model}`);
    }
    return m;
  }, [allVehicles]);

  const items = useMemo(() => {
    return buildBreadcrumbs(pathname, new URLSearchParams(searchKey), vehicleLabelById);
  }, [pathname, searchKey, vehicleLabelById]);

  return (
    <nav aria-label="Sayfa konumu" className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={`${item.href ?? "here"}-${item.label}-${i}`}>
            {i > 0 ? <span className="shrink-0 text-muted-foreground/60">/</span> : null}
            {!isLast && item.href ? (
              <Link
                href={item.href}
                className="max-w-[min(100%,14rem)] truncate font-medium text-foreground underline-offset-2 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "max-w-[min(100%,18rem)] truncate font-medium",
                  isLast ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
