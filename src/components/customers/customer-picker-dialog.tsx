"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CustomerAggregateRow } from "@/lib/rental-metadata";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CustomerAggregateRow[];
  onPick: (row: CustomerAggregateRow) => void;
  title?: string;
  description?: string;
};

export function CustomerPickerDialog({
  open,
  onOpenChange,
  rows,
  onPick,
  title = "Kayıtlı müşteri seç",
  description = "İsim, telefon, TC veya pasaport ile arayın; satıra tıklayınca seçilir.",
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      ({ customer: c }) =>
        c.fullName.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s) ||
        (c.nationalId ?? "").toLowerCase().includes(s) ||
        c.passportNo.toLowerCase().includes(s) ||
        (c.email ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setQ("");
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Müşteri ara"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/70">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((row) => (
                <li key={row.key}>
                  <button
                    type="button"
                    disabled={!row.recordActive}
                    title={!row.recordActive ? "Pasif müşteri seçilemez" : undefined}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted/60",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !row.recordActive && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                    onClick={() => {
                      if (!row.recordActive) return;
                      onPick(row);
                      onOpenChange(false);
                      setQ("");
                    }}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">{row.customer.fullName}</span>
                      {!row.recordActive && (
                        <Badge variant="muted" className="h-5 px-1.5 text-[9px] font-normal">
                          Pasif
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{row.customer.phone}</span>
                    {(row.customer.nationalId || row.customer.passportNo) && (
                      <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                        {[row.customer.nationalId, row.customer.passportNo].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
          Kapat
        </Button>
      </DialogContent>
    </Dialog>
  );
}
