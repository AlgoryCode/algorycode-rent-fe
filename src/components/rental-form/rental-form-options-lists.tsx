"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ReservationExtraOptionTemplateApiRow } from "@/lib/rent-api";
import type { VehicleOptionDefRow } from "@/lib/mock-fleet";

export type RentalFormOptionsListsProps = {
  reservationExtras: ReservationExtraOptionTemplateApiRow[];
  reservationExtrasLoading: boolean;
  vehicleOptionDefs: VehicleOptionDefRow[];
  selectedReservationExtraIds: string[];
  onToggleReservationExtra: (id: string) => void;
  selectedVehicleOptionDefIds: string[];
  onToggleVehicleOptionDef: (id: string) => void;
  onOpenAddRentalOption: () => void;
  onOpenAddVehicleOption: () => void;
  vehicleOptionsApplyHref: string;
};

function OptionSection(props: {
  title: string;
  onAdd: () => void;
  loading?: boolean;
  emptyHint: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card/35">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-2.5 sm:px-4">
        <p className="text-sm font-semibold leading-snug">{props.title}</p>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={props.onAdd}>
          Opsiyon ekle
        </Button>
      </div>
      <div className="p-3 sm:p-4">
        {props.loading ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : props.children ? (
          props.children
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">{props.emptyHint}</p>
        )}
      </div>
    </div>
  );
}

export function RentalFormOptionsLists({
  reservationExtras,
  reservationExtrasLoading,
  vehicleOptionDefs,
  selectedReservationExtraIds,
  onToggleReservationExtra,
  selectedVehicleOptionDefIds,
  onToggleVehicleOptionDef,
  onOpenAddRentalOption,
  onOpenAddVehicleOption,
  vehicleOptionsApplyHref,
}: RentalFormOptionsListsProps) {
  const sortedRentExtras = useMemo(
    () => [...reservationExtras].sort((a, b) => a.lineOrder - b.lineOrder || a.title.localeCompare(b.title, "tr")),
    [reservationExtras],
  );

  const sortedVehicleOpts = useMemo(
    () => [...vehicleOptionDefs].sort((a, b) => a.lineOrder - b.lineOrder || a.title.localeCompare(b.title, "tr")),
    [vehicleOptionDefs],
  );

  return (
    <div className="space-y-4">
      <OptionSection
        title="Kiralama opsiyonları"
        onAdd={onOpenAddRentalOption}
        loading={reservationExtrasLoading}
        emptyHint={
          <>
            Aktif kiralama opsiyonu yok. Sağ üstteki «Opsiyon ekle» ile yeni kalemi tanımlayın veya{" "}
            <Link href="/settings/options/rental" className="text-primary underline-offset-2 hover:underline">
              ayarlardan
            </Link>{" "}
            yönetin.
          </>
        }
      >
        {sortedRentExtras.length > 0 ? (
          <ul className="space-y-2">
            {sortedRentExtras.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-input"
                    checked={selectedReservationExtraIds.includes(r.id)}
                    onChange={() => onToggleReservationExtra(r.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.description ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{String(r.description)}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">+{r.price}</p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </OptionSection>

      <OptionSection
        title="Araç opsiyonları"
        onAdd={onOpenAddVehicleOption}
        emptyHint={
          <>
            Bu araçta tanımlı opsiyon yok. Sağ üstteki «Opsiyon ekle» ile şablondan ekleyin veya{" "}
            <Link href={vehicleOptionsApplyHref} className="text-primary underline-offset-2 hover:underline">
              araç opsiyonları sayfasına
            </Link>{" "}
            gidin.
          </>
        }
      >
        {sortedVehicleOpts.length > 0 ? (
          <ul className="space-y-2">
            {sortedVehicleOpts.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-input"
                    checked={selectedVehicleOptionDefIds.includes(r.id)}
                    onChange={() => onToggleVehicleOptionDef(r.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.description ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">+{r.price}</p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </OptionSection>
    </div>
  );
}
