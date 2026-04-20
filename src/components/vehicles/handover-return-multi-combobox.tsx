"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HandoverLocationApiRow } from "@/lib/rent-api";
import { cn } from "@/lib/utils";

function parseSurchargeEur(loc: HandoverLocationApiRow): number | undefined {
  const sur = loc.surchargeEur;
  const n = typeof sur === "number" ? sur : sur != null ? Number(sur) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Liste satırında gösterilir; tetikleyicide kullanılmaz. */
function surchargePriceInParens(loc: HandoverLocationApiRow): string {
  const n = parseSurchargeEur(loc);
  if (n == null) return "";
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return ` (+${txt} €)`;
}

export type HandoverReturnMultiComboboxProps = {
  locations: HandoverLocationApiRow[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Tetikleyicide seçim yokken */
  placeholder?: string;
  inputPlaceholder?: string;
  /** Liste boşken tetik metni */
  emptyMessage?: string;
  disabled?: boolean;
};

/**
 * Teslim noktaları: aranabilir + çoklu checkbox.
 * Panel diyalog ağacında kalır (portal yok) — Radix Dialog odak tuzağı ile çakışmaz.
 */
export function HandoverReturnMultiCombobox({
  locations,
  value,
  onChange,
  placeholder = "Teslim noktası seçin…",
  inputPlaceholder = "İsim ara…",
  emptyMessage = "RETURN noktası yok",
  disabled,
}: HandoverReturnMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return locations;
    return locations.filter((l) => {
      const name = l.name.toLocaleLowerCase("tr");
      const desc = (l.description ?? "").toLocaleLowerCase("tr");
      return name.includes(q) || desc.includes(q);
    });
  }, [locations, query]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  const summary = useMemo(() => {
    if (value.length === 0) return placeholder;
    const names = value
      .map((id) => locations.find((l) => l.id === id)?.name)
      .filter((n): n is string => Boolean(n?.length));
    if (names.length === 0) return `${value.length} nokta`;
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }, [value, locations, placeholder]);

  const listEmpty = locations.length === 0;

  return (
    <div ref={rootRef} className="relative z-10 w-full">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className={cn(
          "h-9 w-full justify-between gap-2 border-input bg-background px-3 py-2 font-normal shadow-sm ring-offset-background hover:bg-muted/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          !value.length && !listEmpty && "text-muted-foreground",
        )}
        onClick={() => !listEmpty && !disabled && setOpen((o) => !o)}
        disabled={disabled || listEmpty}
      >
        <span className="line-clamp-1 text-left text-sm">{listEmpty ? emptyMessage : summary}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")} />
      </Button>
      {open && !listEmpty && (
        <div
          className="absolute left-0 right-0 top-full z-[120] mt-1 flex max-h-[min(280px,50vh)] flex-col overflow-hidden rounded-lg border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Input
            className="mb-2 h-8 shrink-0 text-xs"
            placeholder={inputPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-center text-[11px] text-muted-foreground">Eşleşme yok</p>
            ) : (
              filtered.map((loc) => {
                const priceSuffix = surchargePriceInParens(loc);
                return (
                  <label
                    key={loc.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={value.includes(loc.id)}
                      onChange={() => toggle(loc.id)}
                      className="rounded border-input"
                    />
                    <span className="min-w-0 flex-1 leading-snug">
                      {loc.name}
                      {priceSuffix ? (
                        <span className="whitespace-nowrap text-muted-foreground">{priceSuffix}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
