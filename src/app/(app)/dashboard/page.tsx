"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Car,
  ClipboardList,
  Globe2,
  MailCheck,
  MessagesSquare,
  Settings,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export default function DashboardPage() {
  const quickMenu = [
    { href: "/vehicles", label: "Araçlar", icon: Car, bg: "from-sky-500/25 to-blue-500/10" },
    { href: "/reports", label: "Raporlar", icon: BarChart3, bg: "from-violet-500/25 to-indigo-500/10" },
    { href: "/logs", label: "Kiralamalar", icon: ClipboardList, bg: "from-amber-500/25 to-orange-500/10" },
    { href: "/calendar", label: "Takvim", icon: CalendarRange, bg: "from-fuchsia-500/25 to-purple-500/10" },
    { href: "/payments", label: "Ödemeler", icon: Wallet, bg: "from-emerald-500/25 to-teal-500/10" },
    { href: "/requests", label: "Talepler", icon: MailCheck, bg: "from-rose-500/25 to-pink-500/10" },
    { href: "/customers", label: "Customers", icon: Users, bg: "from-cyan-500/25 to-sky-500/10" },
    { href: "/customers/channel", label: "Toplu mesaj", icon: MessagesSquare, bg: "from-lime-500/25 to-green-500/10" },
    { href: "/users", label: "Kullanıcılar", icon: UserCog, bg: "from-slate-500/25 to-zinc-500/10" },
    { href: "/countries", label: "Ülkeler", icon: Globe2, bg: "from-purple-500/25 to-blue-500/10" },
    { href: "/settings", label: "Ayarlar", icon: Settings, bg: "from-stone-500/25 to-neutral-500/10" },
  ] as const;

  return (
    <div className="-mx-3 -my-3 min-h-[calc(100vh-3rem)] sm:-mx-4 sm:-my-4">
      <div className="grid h-full grid-cols-2 gap-3 p-3 sm:hidden">
        {quickMenu.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative isolate flex min-h-[128px] flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${item.bg} p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}
            >
              <div className="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/85 backdrop-blur">
                <Icon className="h-5 w-5 text-primary transition-transform duration-200 group-hover:scale-110" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight">{item.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="hidden h-full items-center justify-center sm:flex">
        <p className="text-sm text-muted-foreground">Hizli menu kartlari sadece mobil gorunumde gosterilir.</p>
      </div>
    </div>
  );
}
