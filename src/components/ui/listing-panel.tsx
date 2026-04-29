"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ListingPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-muted/50 shadow-sm ring-1 ring-black/[0.04] dark:bg-muted/25 dark:ring-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListingToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("border-b border-border/80 bg-muted/60 px-4 py-3 sm:px-5 dark:bg-muted/35", className)}>
      {children}
    </div>
  );
}

export function ListingTableWell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "border-t border-border/80 bg-white text-foreground shadow-[inset_0_1px_0_0_hsl(var(--border)/0.35)] dark:border-border/60 dark:bg-zinc-950 dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
