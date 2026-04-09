"use client";

import { useCallback, useRef } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  MAX_VEHICLE_IMAGE_BYTES,
  VEHICLE_IMAGE_SLOTS,
  type VehicleImageSlot,
  type VehicleImages,
} from "@/lib/vehicle-images";

type Props = {
  value: VehicleImages;
  onChange: (next: VehicleImages) => void;
};

export function VehicleImageSlotsEditor({ value, onChange }: Props) {
  const cameraInputRefs = useRef<Map<VehicleImageSlot, HTMLInputElement | null>>(new Map());
  const galleryInputRefs = useRef<Map<VehicleImageSlot, HTMLInputElement | null>>(new Map());

  const setCameraInputRef = useCallback((key: VehicleImageSlot, el: HTMLInputElement | null) => {
    if (el) cameraInputRefs.current.set(key, el);
    else cameraInputRefs.current.delete(key);
  }, []);

  const setGalleryInputRef = useCallback((key: VehicleImageSlot, el: HTMLInputElement | null) => {
    if (el) galleryInputRefs.current.set(key, el);
    else galleryInputRefs.current.delete(key);
  }, []);

  const triggerCameraPick = (key: VehicleImageSlot) => {
    cameraInputRefs.current.get(key)?.click();
  };

  const triggerGalleryPick = (key: VehicleImageSlot) => {
    galleryInputRefs.current.get(key)?.click();
  };

  const handleFile = (key: VehicleImageSlot, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Yalnızca görsel dosyası seçin.");
      return;
    }
    if (file.size > MAX_VEHICLE_IMAGE_BYTES) {
      toast.error(`Dosya en fazla ${MAX_VEHICLE_IMAGE_BYTES / (1024 * 1024)} MB olabilir.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onChange({ ...value, [key]: result });
      }
    };
    reader.onerror = () => toast.error("Dosya okunamadı.");
    reader.readAsDataURL(file);
  };

  const remove = (key: VehicleImageSlot) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs font-medium">Araç görselleri</Label>
        <p className="text-[10px] text-muted-foreground">
          Ön, arka, yanlar ve iç mekân. Küçük önizleme; × ile kaldırın veya yeniden yükleyin (kamera veya galeri).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {VEHICLE_IMAGE_SLOTS.map(({ key, label }) => {
          const src = value[key];
          return (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
                <input
                  ref={(el) => setCameraInputRef(key, el)}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label={`${label} fotoğrafı kameradan çek`}
                  onChange={(e) => {
                    handleFile(key, e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={(el) => setGalleryInputRef(key, el)}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={`${label} fotoğrafını galeriden seç`}
                  onChange={(e) => {
                    handleFile(key, e.target.files);
                    e.target.value = "";
                  }}
                />
                {src ? (
                  <div className="relative aspect-[4/3] w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={label} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/95 text-destructive shadow-md ring-1 ring-border hover:bg-destructive/10"
                      aria-label={`${label} görselini kaldır`}
                      onClick={() => remove(key)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent p-1.5 pt-6">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 text-[10px]"
                          onClick={() => triggerCameraPick(key)}
                        >
                          <Camera className="h-3 w-3" />
                          Kameradan
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 text-[10px]"
                          onClick={() => triggerGalleryPick(key)}
                        >
                          Galeriden
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border/80 bg-background/50 px-2 text-center">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => triggerCameraPick(key)}>
                        Kameradan çek
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => triggerGalleryPick(key)}>
                        Galeriden seç
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
