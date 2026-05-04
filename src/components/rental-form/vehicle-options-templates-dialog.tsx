"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { VehicleOptionTemplatesPickPanel } from "@/components/vehicles/vehicle-option-templates-pick-panel";
import type { Vehicle } from "@/lib/mock-fleet";

type Props = {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VehicleOptionsTemplatesDialog({ vehicle, open, onOpenChange }: Props) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12">
          <DialogTitle className="text-base">Araç opsiyonu ekle</DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Şablonları{" "}
            <Link href="/settings/options/vehicle" className="text-primary underline-offset-2 hover:underline">
              ayarlardan
            </Link>{" "}
            da yönetebilirsiniz.
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <VehicleOptionTemplatesPickPanel vehicle={vehicle} onApplied={close} saveButtonLabel="Kaydet ve kapat" />
        </div>
        <DialogFooter className="shrink-0 border-t border-border/60 px-4 py-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={close}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
