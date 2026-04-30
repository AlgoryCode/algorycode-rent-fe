"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RentalLogsNewRentalFabMobile({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
      onClick={onClick}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
