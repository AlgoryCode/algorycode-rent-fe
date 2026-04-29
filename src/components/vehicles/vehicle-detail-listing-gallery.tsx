"use client";

import { useMemo, useState } from "react";

import { VEHICLE_IMAGE_SLOTS, type VehicleImageSlot, type VehicleImages } from "@/lib/vehicle-images";
import { cn } from "@/lib/utils";

type Props = {
  images: VehicleImages;
};

/** Üst bileşende `key={vehicle.id}` verin; araç değişince seçim sıfırlanır. */
export function VehicleDetailListingGallery({ images }: Props) {
  const filled = useMemo(
    () => VEHICLE_IMAGE_SLOTS.filter(({ key }) => images[key]).map(({ key, label }) => ({ key, label, src: images[key]! })),
    [images],
  );

  const [selectedKey, setSelectedKey] = useState<VehicleImageSlot | null>(null);

  const heroKey = selectedKey ?? filled[0]?.key;
  const hero = heroKey ? images[heroKey] : undefined;

  if (filled.length === 0 || !hero) {
    return <p className="text-center text-xs text-muted-foreground">Görsel bulunamadı.</p>;
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-2xl items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-muted/25",
          "aspect-[16/10] max-h-[min(22rem,55vh)] lg:max-h-[min(26rem,60vh)]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt=""
          className="max-h-full max-w-full object-contain object-center"
          loading="eager"
          decoding="async"
        />
      </div>

      {filled.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
          {filled.map(({ key, label, src }) => {
            const active = key === heroKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={cn(
                  "relative shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                  "h-14 w-[4.5rem] sm:h-16 sm:w-20",
                  active ? "border-primary ring-2 ring-primary/25" : "border-border/60 opacity-90 hover:border-muted-foreground/40 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
