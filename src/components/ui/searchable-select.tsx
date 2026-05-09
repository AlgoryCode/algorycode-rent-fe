"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableSelectItem = { value: string; label: string };

type SearchableSelectProps = {
  items: SearchableSelectItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  noneValue?: string;
  noneLabel?: string;
  className?: string;
};

export function SearchableSelect({
  items,
  value,
  onValueChange,
  placeholder = "Seçin",
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç yok",
  disabled,
  noneValue,
  noneLabel = "Seçin",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    if (noneValue != null && value === noneValue) return noneLabel;
    const hit = items.find((i) => i.value === value);
    return hit?.label ?? placeholder;
  }, [items, value, noneValue, noneLabel, placeholder]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? items.filter((i) => i.label.toLowerCase().includes(t)) : items;
    if (noneValue != null) {
      const rest = base.filter((i) => i.value !== noneValue);
      return [{ value: noneValue, label: noneLabel }, ...rest];
    }
    return base;
  }, [items, q, noneValue, noneLabel]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-full justify-between gap-2 px-3 font-normal"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate text-left">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>
      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <Input
            className="rounded-none border-0 border-b border-border focus-visible:ring-0"
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((i) => (
                <button
                  key={`${i.value}-${i.label}`}
                  type="button"
                  role="option"
                  aria-selected={value === i.value}
                  className={cn(
                    "w-full rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted",
                    value === i.value && "bg-muted/80",
                  )}
                  onClick={() => {
                    onValueChange(i.value);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {i.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
