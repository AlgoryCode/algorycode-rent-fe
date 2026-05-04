"use client";

import * as React from "react";
import { isSameDay, startOfDay } from "date-fns";
import { DayPicker, type DateRange, type Matcher } from "react-day-picker";
import type { Locale } from "date-fns";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";
import "./rent-calendar.css";

export type HeldBackdropModifierSets = {
  modifiers: Record<string, (date: Date) => boolean>;
  modifiersClassNames: Record<string, string>;
};

export function heldRangeBackdropModifiersFromRange(held: DateRange | undefined): HeldBackdropModifierSets {
  if (!held?.from || !held.to) return { modifiers: {}, modifiersClassNames: {} };
  const a = held.from;
  const b = held.to;
  if (isSameDay(a, b)) {
    return {
      modifiers: {
        rent_cal_prev_hold_single: (d: Date) => isSameDay(d, a),
      },
      modifiersClassNames: {
        rent_cal_prev_hold_single: "rent-cal-prev-hold-single",
      },
    };
  }
  const sf = startOfDay(a).getTime();
  const st = startOfDay(b).getTime();
  const lo = sf <= st ? a : b;
  const hi = sf <= st ? b : a;
  return {
    modifiers: {
      rent_cal_prev_hold_start: (d: Date) => isSameDay(d, lo),
      rent_cal_prev_hold_end: (d: Date) => isSameDay(d, hi),
      rent_cal_prev_hold_mid: (d: Date) => {
        const t = startOfDay(d).getTime();
        return t > startOfDay(lo).getTime() && t < startOfDay(hi).getTime();
      },
    },
    modifiersClassNames: {
      rent_cal_prev_hold_start: "rent-cal-prev-hold-start",
      rent_cal_prev_hold_end: "rent-cal-prev-hold-end",
      rent_cal_prev_hold_mid: "rent-cal-prev-hold-mid",
    },
  };
}

export type RentAvailabilityCalendarProps = {
  booked: Date[];
  locale?: Locale;
  className?: string;
  disabled?: Matcher;
  defaultMonth?: Date;
  numberOfMonths?: number;
  compact?: boolean;
  /** Varsayılan `single`: araç detayı gibi güne tıklama. `range`: tarih aralığı seçimi (talep formu vb.). */
  mode?: "single" | "range";
  /** `mode="range"` iken seçili aralık */
  selected?: DateRange;
  /** `mode="range"` iken aralık değişimi */
  onSelect?: (range: DateRange | undefined) => void;
  /** `mode="range"`: seçili iki uçtan sonra ilk tıklama yeni çıkış seçimi olarak sıfırlar (yeniden tarih seç). */
  resetRangeOnDayClick?: boolean;
  /** Çıkış seçildiği, dönüş henüz yoksa bu günü takvimde “boş yüzük” olarak vurgula. */
  pendingPickupAnchor?: Date;
  /** Tam aralıktan sonra yeni taslak seçilirken görünür kılınacak önceki seçim görünümü. */
  heldRangeBackdrop?: DateRange;
  /** `mode="single"` veya belirtilmemiş iken */
  onDayClick?: (date: Date, modifiers: Record<string, boolean>) => void;
};

function matcherHits(m: Matcher | undefined, date: Date): boolean {
  if (m == null) return false;
  if (typeof m === "function") return Boolean(m(date));
  if (m instanceof Date) return isSameDay(m, date);
  if (Array.isArray(m)) return m.some((x) => matcherHits(x, date));
  if (typeof m === "boolean") return m;
  if (typeof m === "string") return false;
  if (typeof m === "number") return false;
  if (m && typeof m === "object" && "from" in m && "to" in m) {
    const r = m as { from?: Date; to?: Date };
    if (r.from && r.to) {
      const t = date.getTime();
      return t >= r.from.getTime() && t <= r.to.getTime();
    }
  }
  return false;
}

export function RentAvailabilityCalendar({
  booked,
  locale,
  className,
  disabled,
  defaultMonth,
  numberOfMonths = 1,
  compact = false,
  mode = "single",
  selected,
  onSelect,
  resetRangeOnDayClick = true,
  pendingPickupAnchor,
  heldRangeBackdrop,
  onDayClick,
}: RentAvailabilityCalendarProps) {
  const bookedDisabled = React.useCallback((d: Date) => booked.some((b) => isSameDay(b, d)), [booked]);

  const mergedDisabled = React.useMemo<Matcher | undefined>(() => {
    if (mode !== "range") return disabled;
    if (!disabled) return bookedDisabled;
    return (date: Date) => bookedDisabled(date) || matcherHits(disabled, date);
  }, [mode, disabled, bookedDisabled]);

  const heldBackdrop = React.useMemo(() => heldRangeBackdropModifiersFromRange(heldRangeBackdrop), [heldRangeBackdrop]);

  const rangeModifiers = React.useMemo(() => {
    const pickup =
      pendingPickupAnchor != null
        ? {
            rent_pickup_pending: (d: Date) => isSameDay(d, pendingPickupAnchor),
          }
        : {};
    return { booked, ...pickup, ...heldBackdrop.modifiers };
  }, [booked, pendingPickupAnchor, heldBackdrop]);

  const rangeModifiersClassNames = React.useMemo((): Record<string, string> => {
    const next: Record<string, string> = {
      booked: "rent-cal-booked",
      ...heldBackdrop.modifiersClassNames,
    };
    if (pendingPickupAnchor) next.rent_pickup_pending = "rent-cal-pickup-pending";
    return next;
  }, [pendingPickupAnchor, heldBackdrop]);

  const skinClass = cn("rent-calendar-skin", compact && "rent-calendar-skin--compact");

  const captionClass = compact
    ? "select-none text-sm font-semibold tracking-tight text-foreground"
    : "select-none text-base font-semibold tracking-tight text-foreground sm:text-lg lg:text-xl";

  if (mode === "range") {
    return (
      <div className={cn("rent-calendar-scroll w-full", compact && "flex justify-center", className)}>
        <DayPicker
          mode="range"
          locale={locale}
          selected={selected}
          onSelect={onSelect}
          defaultMonth={defaultMonth}
          numberOfMonths={numberOfMonths}
          showOutsideDays
          navLayout="around"
          className={skinClass}
          resetOnSelect={resetRangeOnDayClick}
          modifiers={rangeModifiers}
          modifiersClassNames={rangeModifiersClassNames}
          disabled={mergedDisabled}
          classNames={{
            caption_label: captionClass,
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("rent-calendar-scroll w-full", compact && "flex justify-center", className)}>
      <DayPicker
        locale={locale}
        showOutsideDays
        navLayout="around"
        defaultMonth={defaultMonth}
        className={skinClass}
        modifiers={{ booked }}
        modifiersClassNames={{ booked: "rent-cal-booked" }}
        disabled={disabled}
        onDayClick={onDayClick}
        classNames={{
          caption_label: captionClass,
        }}
      />
    </div>
  );
}
