"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, ChevronDown, ImageIcon, MessageSquare } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RentalSession } from "@/lib/mock-fleet";
import { sessionCreatedAt } from "@/lib/rental-metadata";

type Props = {
  sessions: RentalSession[];
  /** Global liste: plaka + araç detay linki */
  plateOf?: (s: RentalSession) => { plate: string; vehicleId: string };
  /** Araç detayı: satıra tıklanınca yorum / foto / kaza sekmeleri */
  expandableDetails?: boolean;
};

function SessionSummary({
  s,
  plateOf,
  showIdChip,
}: {
  s: RentalSession;
  plateOf?: Props["plateOf"];
  showIdChip?: boolean;
}) {
  return (
    <>
      <div className="min-w-0 flex-1 space-y-0.5 text-left">
        <p className="text-[11px] font-medium text-muted-foreground">
          {format(parseISO(sessionCreatedAt(s)), "d MMMM yyyy, HH:mm", { locale: tr })}
        </p>
        <p className="text-sm font-medium">
          Kiralama oluşturuldu · <span className="text-foreground">{s.customer.fullName}</span>
        </p>
        {plateOf && (
          <p className="text-xs">
            <Link
              href={`/vehicles/${plateOf(s).vehicleId}`}
              className="font-mono font-medium text-primary underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {plateOf(s).plate}
            </Link>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Dönem:{" "}
          <span className="font-mono text-foreground">
            {s.startDate} → {s.endDate}
          </span>
          {" · "}
          TC <span className="font-mono">{s.customer.nationalId}</span>
        </p>
      </div>
      {showIdChip && (
        <code className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:mt-0.5">
          {s.id.length > 12 ? `${s.id.slice(0, 8)}…` : s.id}
        </code>
      )}
    </>
  );
}

function RentalDetailTabs({ s }: { s: RentalSession }) {
  const accidents = s.accidentReports ?? [];

  return (
    <Tabs defaultValue="yorum" className="w-full">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        <TabsTrigger value="yorum" className="gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          Yorum
        </TabsTrigger>
        <TabsTrigger value="fotograflar" className="gap-1">
          <ImageIcon className="h-3.5 w-3.5" />
          Fotoğraflar
        </TabsTrigger>
        <TabsTrigger value="kaza" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Kaza bildirimi
        </TabsTrigger>
      </TabsList>
      <TabsContent value="yorum" className="px-0.5">
        {!s.feedback ? (
          <p className="py-2 text-xs text-muted-foreground">Bu kiralama için yorum yok.</p>
        ) : (
          <div className="rounded-md border bg-background px-2.5 py-2 text-xs">
            <span className="text-[10px] text-muted-foreground">
              {format(parseISO(s.feedback.at), "d MMM yyyy HH:mm", { locale: tr })}
            </span>
            <p className="mt-1">{s.feedback.text}</p>
          </div>
        )}
      </TabsContent>
      <TabsContent value="fotograflar" className="px-0.5">
        {s.photos.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">Bu kiralama için fotoğraf yok.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {s.photos.map((p) => (
              <figure key={p.id} className="w-24 shrink-0 sm:w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || "Kiralama"} className="aspect-video w-full rounded-md border object-cover" />
                {p.caption && <figcaption className="mt-0.5 text-[10px] text-muted-foreground">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="kaza" className="px-0.5">
        {accidents.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">Bu kiralama için kaza bildirimi yok.</p>
        ) : (
          <ul className="space-y-3">
            {accidents.map((a) => (
              <li key={a.id} className="rounded-md border bg-background p-2.5 text-xs">
                <p className="text-[10px] text-muted-foreground">
                  {format(parseISO(a.at), "d MMM yyyy HH:mm", { locale: tr })}
                </p>
                <p className="mt-1">{a.description}</p>
                {a.photos && a.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.photos.map((p) => (
                      <figure key={p.id} className="w-20 shrink-0 sm:w-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.caption || "Kaza"} className="aspect-video w-full rounded border object-cover" />
                        {p.caption && <figcaption className="mt-0.5 text-[9px] text-muted-foreground">{p.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

export function RentalLogEntries({ sessions, plateOf, expandableDetails }: Props) {
  if (sessions.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">Filtreye uygun günlük kaydı yok.</p>;
  }

  if (expandableDetails) {
    return (
      <ul className="mt-4 space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="overflow-hidden rounded-lg border bg-muted/20">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 sm:px-4"
                >
                  <SessionSummary s={s} plateOf={plateOf} />
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/60 bg-background/40 px-3 py-3 sm:px-4">
                  <RentalDetailTabs s={s} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-4 space-y-0 divide-y divide-border rounded-lg border bg-muted/20">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
          <SessionSummary s={s} plateOf={plateOf} showIdChip />
        </li>
      ))}
    </ul>
  );
}
