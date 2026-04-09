"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RentalLogFilterValues } from "@/lib/rental-log-filters";
import { emptyRentalLogFilters } from "@/lib/rental-log-filters";
import { RENTAL_STATUS_LABEL, type RentalStatus } from "@/lib/rental-status";
import { CalendarDays, Filter } from "lucide-react";

import "react-day-picker/style.css";

type Props = {
  values: RentalLogFilterValues;
  onChange: (next: RentalLogFilterValues) => void;
  /** Tüm filolar için plaka araması */
  showVehicleQuery?: boolean;
  /** true ise filtreler otomatik değil, butonla uygulanır */
  manualApply?: boolean;
  onApply?: () => void;
};

export function RentalLogFiltersBar({ values, onChange, showVehicleQuery, manualApply = false, onApply }: Props) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const clear = () => onChange(emptyRentalLogFilters());
  const rangeLabel = useMemo(() => {
    if (!values.rangeStart && !values.rangeEnd) return "Aralık seçin";
    const from = values.rangeStart ? format(new Date(`${values.rangeStart}T00:00:00`), "dd.MM.yyyy") : "?";
    const to = values.rangeEnd ? format(new Date(`${values.rangeEnd}T00:00:00`), "dd.MM.yyyy") : "?";
    return `${from} - ${to}`;
  }, [values.rangeStart, values.rangeEnd]);
  const selectedRange = useMemo<DateRange | undefined>(() => {
    if (!values.rangeStart && !values.rangeEnd) return undefined;
    return {
      from: values.rangeStart ? new Date(`${values.rangeStart}T00:00:00`) : undefined,
      to: values.rangeEnd ? new Date(`${values.rangeEnd}T00:00:00`) : undefined,
    };
  }, [values.rangeStart, values.rangeEnd]);

  return (
    <div className="space-y-4 border-b border-border/60 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="rlf-customer" className="text-xs">
            Müşteri ara
          </Label>
          <Input
            id="rlf-customer"
            placeholder="İsim veya TC kimlik no"
            className="h-9 text-sm"
            value={values.customerQuery}
            onChange={(e) => onChange({ ...values, customerQuery: e.target.value })}
          />
        </div>
        <div className="relative space-y-1.5">
          <Label className="text-xs">Tarih aralığı</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start gap-1.5 px-2 text-left text-[11px] font-normal"
            onClick={() => setRangeOpen((v) => !v)}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {rangeLabel}
          </Button>
          {rangeOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-[min(300px,90vw)] rounded-md border border-border/70 bg-background p-1.5 shadow-lg">
              <DayPicker
                mode="range"
                locale={tr}
                selected={selectedRange}
                onSelect={(range) => {
                  onChange({
                    ...values,
                    rangeStart: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                    rangeEnd: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                  });
                }}
                numberOfMonths={1}
                classNames={{
                  months: "text-[11px]",
                  caption_label: "text-xs font-medium",
                  weekday: "text-[11px] font-semibold text-foreground/90",
                  day: "h-7 w-7 p-0",
                  day_button: "h-7 w-7 rounded-full text-[11px]",
                  selected: "bg-primary text-primary-foreground hover:bg-primary",
                  range_start: "bg-primary text-primary-foreground rounded-full",
                  range_end: "bg-primary text-primary-foreground rounded-full",
                  range_middle: "bg-primary/20 text-foreground",
                }}
              />
              <div className="mt-1 flex items-center justify-end gap-1.5 border-t border-border/60 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onChange({ ...values, rangeStart: "", rangeEnd: "" })}
                >
                  Temizle
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setRangeOpen(false)}>
                  Tamam
                </Button>
              </div>
            </div>
          )}
        </div>
        {showVehicleQuery && (
          <div className="space-y-1.5">
            <Label htmlFor="rlf-plate" className="text-xs">
              Plaka ara
            </Label>
            <Input
              id="rlf-plate"
              placeholder="Örn. 34 ABC"
              className="h-9 font-mono text-sm"
              value={values.vehicleQuery ?? ""}
              onChange={(e) => onChange({ ...values, vehicleQuery: e.target.value })}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="rlf-status" className="text-xs">
            Statü
          </Label>
          <Select
            value={values.status}
            onValueChange={(v) => onChange({ ...values, status: v as "all" | RentalStatus })}
          >
            <SelectTrigger id="rlf-status" className="h-9 text-xs font-normal">
              <SelectValue placeholder="Statü seçin" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all" className="text-xs">
                Tümü
              </SelectItem>
              {(Object.keys(RENTAL_STATUS_LABEL) as RentalStatus[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {RENTAL_STATUS_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clear}>
          Filtreleri temizle
        </Button>
        {manualApply && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/80 bg-background px-3 text-xs hover:bg-accent"
            onClick={onApply}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtrele
          </Button>
        )}
      </div>
    </div>
  );
}
