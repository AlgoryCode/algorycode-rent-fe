"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFleetVehicles } from "@/hooks/use-fleet-vehicles";
import { getRentApiErrorMessage } from "@/lib/rent-api";
import {
  MAX_VEHICLE_IMAGE_BYTES,
  VEHICLE_IMAGE_SLOTS,
  type VehicleImageSlot,
  type VehicleImages,
} from "@/lib/vehicle-images";

type Props = {
  vehicleId: string;
  /** API’den gelen kayıtlı görseller (silme yalnızca bunlar için). */
  images: VehicleImages | undefined;
  /** Önizleme ile aynı kaynak: boş slotlarda demo görsel gösterilir; silinemez. */
  fallbackImages: VehicleImages;
};

export function VehicleImageSlotsRemoteEditor({ vehicleId, images, fallbackImages }: Props) {
  const { replaceVehicleImageSlot, deleteVehicleImageSlot } = useFleetVehicles();
  const cameraInputRefs = useRef<Map<VehicleImageSlot, HTMLInputElement | null>>(new Map());
  const galleryInputRefs = useRef<Map<VehicleImageSlot, HTMLInputElement | null>>(new Map());

  const [busySlot, setBusySlot] = useState<VehicleImageSlot | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<VehicleImageSlot | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleFile = async (key: VehicleImageSlot, fileList: FileList | null) => {
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
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setBusySlot(key);
      try {
        await replaceVehicleImageSlot(vehicleId, key, result);
        toast.success("Görsel kaydedildi.");
      } catch (e) {
        toast.error(getRentApiErrorMessage(e));
      } finally {
        setBusySlot(null);
      }
    };
    reader.onerror = () => toast.error("Dosya okunamadı.");
    reader.readAsDataURL(file);
  };

  const confirmRemove = async () => {
    if (!slotToDelete) return;
    setDeleting(true);
    try {
      await deleteVehicleImageSlot(vehicleId, slotToDelete);
      toast.success("Görsel kaldırıldı.");
      setSlotToDelete(null);
    } catch (e) {
      toast.error(getRentApiErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs font-medium">Görselleri yönet</Label>
        <p className="text-[10px] text-muted-foreground">
          Tüm açılarda fotoğraf görünür (kayıtlı değilse örnek görsel). Kayıtlı görselin üstündeki Sil’e basınca Evet/Hayır ile onaylanır.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {VEHICLE_IMAGE_SLOTS.map(({ key, label }) => {
          const stored = images?.[key];
          const hasStored = typeof stored === "string" && stored.trim().length > 0;
          const displaySrc: string | undefined = hasStored ? stored.trim() : fallbackImages[key];
          const busy = busySlot === key;
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
                  disabled={busy}
                  onChange={(e) => {
                    void handleFile(key, e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={(el) => setGalleryInputRef(key, el)}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={`${label} fotoğrafını galeriden seç`}
                  disabled={busy}
                  onChange={(e) => {
                    void handleFile(key, e.target.files);
                    e.target.value = "";
                  }}
                />
                {displaySrc ? (
                  <div className="relative aspect-[4/3] w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displaySrc} alt={label} className="h-full w-full object-cover" loading="lazy" />
                    {!hasStored ? (
                      <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground shadow ring-1 ring-border/80">
                        Örnek
                      </span>
                    ) : null}
                    {hasStored ? (
                      <div className="absolute right-1 top-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 gap-1 px-2 text-[10px] shadow-md"
                          aria-label={`${label} görselini sil`}
                          disabled={busy}
                          onClick={() => setSlotToDelete(key)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Sil
                        </Button>
                      </div>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent p-1.5 pt-6">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 text-[10px]"
                          disabled={busy}
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
                          disabled={busy}
                          onClick={() => triggerGalleryPick(key)}
                        >
                          Galeriden
                        </Button>
                      </div>
                    </div>
                    {busy ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-[10px] font-medium">
                        Kaydediliyor…
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border/80 bg-background/50 px-2 text-center">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={busy}
                        onClick={() => triggerCameraPick(key)}
                      >
                        Kameradan çek
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={busy}
                        onClick={() => triggerGalleryPick(key)}
                      >
                        Galeriden seç
                      </Button>
                    </div>
                    {busy ? <p className="text-[10px] text-muted-foreground">Kaydediliyor…</p> : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={slotToDelete != null} onOpenChange={(open) => !open && !deleting && setSlotToDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-border/60 bg-card/95 shadow-xl">
          <DialogHeader>
            <DialogTitle>Görseli silmek istiyor musunuz?</DialogTitle>
            <DialogDescription className="text-xs">
              {slotToDelete ? (
                <>
                  <span className="font-medium text-foreground">
                    {VEHICLE_IMAGE_SLOTS.find((s) => s.key === slotToDelete)?.label ?? slotToDelete}
                  </span>{" "}
                  açısındaki kayıtlı görsel sunucudan kalıcı olarak kaldırılır. Devam etmek için Evet’e basın.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSlotToDelete(null)} disabled={deleting}>
              Hayır
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => void confirmRemove()} disabled={deleting}>
              {deleting ? "Siliniyor…" : "Evet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
