"use client";

import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onPick: (file: File) => void | Promise<void>;
  disabled?: boolean;
};

export function ImageSourceInput({ onPick, disabled = false }: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    await onPick(file);
  };

  return (
    <div className="flex flex-wrap gap-2">
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
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={disabled} onClick={() => cameraRef.current?.click()}>
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
  );
}
