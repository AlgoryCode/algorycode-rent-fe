"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { RentalStatus } from "@/lib/rental-status";
import { cn } from "@/lib/utils";

const STATUS_CHIPS = [
  { key: "all" as const, label: "All Bookings" },
  { key: "active" as const, label: "Active" },
  { key: "pending" as const, label: "Pending" },
  { key: "completed" as const, label: "Completed" },
];

export function RentalLogsListToolbarMobile({
  customerQuery,
  activeStatus,
  onCustomerQueryChange,
  onStatusChange,
}: {
  customerQuery: string;
  activeStatus: RentalStatus | "all";
  onCustomerQueryChange: (value: string) => void;
  onStatusChange: (status: RentalStatus | "all") => void;
}) {
  return (
    <div className="space-y-4 lg:hidden">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={customerQuery}
          onChange={(e) => onCustomerQueryChange(e.target.value)}
          placeholder="Search vehicle or customer..."
          className="h-12 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_CHIPS.map((chip) => {
          const active = activeStatus === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              className={cn(
                "whitespace-nowrap rounded-full border px-4 py-1.5 text-[11px] font-semibold",
                active ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600",
              )}
              onClick={() => onStatusChange(chip.key)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
