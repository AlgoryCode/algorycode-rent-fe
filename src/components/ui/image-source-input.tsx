"use client";

import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onPick: (file: File) => void | Promise<void>;
  disabled?: boolean;
  previewDataUrl?: string;
};

export function ImageSourceInput({ onPick, disabled = false, previewDataUrl }: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    await onPick(file);
  };

  return (
    <div className="flex flex-wrap items-start gap-3">
      {previewDataUrl ? (
        <div
          className="relative h-16 w-[4.25rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-muted shadow-sm ring-1 ring-black/5 dark:ring-white/10"
          aria-live="polite"
        >
          <img src={previewDataUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            await handleFile(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            await handleFile(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-3.5 w-3.5" />
          Kameradan çek
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Galeriden seç
        </Button>
      </div>
    </div>
  );
}
