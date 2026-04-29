import { cn } from "@/lib/utils";

export function RentCalendarLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mt-4 flex justify-center border-t border-border/50 pt-4 sm:justify-start",
        className,
      )}
      aria-label="Takvim renkleri"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/35 bg-destructive/10 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
        <span className="h-4 w-4 shrink-0 rounded border border-destructive/35 bg-destructive/20" aria-hidden />
        Kirada
      </div>
    </div>
  );
}
