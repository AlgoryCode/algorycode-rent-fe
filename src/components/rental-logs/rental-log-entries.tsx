"use client";

import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, ArrowRight, ChevronDown, ImageIcon, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RentalSession } from "@/lib/mock-fleet";
import { sessionCreatedAt } from "@/lib/rental-metadata";
import { RENTAL_STATUS_LABEL, type RentalStatus } from "@/lib/rental-status";

function sessionStatus(s: RentalSession): RentalStatus {
  return s.status ?? "active";
}

function statusBadgeVariant(st: RentalStatus): "success" | "warning" | "muted" | "destructive" {
  switch (st) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "completed":
      return "muted";
    case "cancelled":
      return "destructive";
    default:
      return "muted";
  }
}

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
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            Kiralama oluşturuldu · <span className="text-foreground">{s.customer.fullName}</span>
          </p>
          <Badge variant={statusBadgeVariant(sessionStatus(s))} className="text-[10px]">
            {RENTAL_STATUS_LABEL[sessionStatus(s)]}
          </Badge>
        </div>
        {plateOf && (
          <p className="text-xs text-muted-foreground">
            Plaka: <span className="font-mono font-medium text-foreground">{plateOf(s).plate}</span>
          </p>
        )}
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            Baş: <span className="font-mono text-foreground">{s.startDate}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-primary/90" />
          <span>
            Bitiş: <span className="font-mono text-foreground">{s.endDate}</span>
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
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[480px] text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Zaman</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="min-w-[120px]">Fotoğraflar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accidents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {format(parseISO(a.at), "d MMM yyyy HH:mm", { locale: tr })}
                    </TableCell>
                    <TableCell>{a.description}</TableCell>
                    <TableCell>
                      {a.photos && a.photos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {a.photos.map((p) => (
                            <figure key={p.id} className="w-20 shrink-0 sm:w-24">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.url} alt={p.caption || "Kaza"} className="aspect-video w-full rounded border object-cover" />
                              {p.caption && <figcaption className="mt-0.5 text-[9px] text-muted-foreground">{p.caption}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

export function RentalLogEntries({ sessions, plateOf, expandableDetails }: Props) {
  const router = useRouter();

  if (sessions.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">Filtreye uygun günlük kaydı yok.</p>;
  }

  if (expandableDetails) {
    return (
      <div className="mt-4 rounded-lg border">
        <Table className="text-xs">
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id} className="hover:bg-transparent">
                <TableCell className="p-0">
                  <div className="overflow-hidden border-b border-border last:border-0">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="group flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-4"
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border">
      <Table className="min-w-[720px] text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Oluşturulma</TableHead>
            <TableHead>Müşteri</TableHead>
            <TableHead>Statü</TableHead>
            {plateOf ? <TableHead>Plaka</TableHead> : null}
            <TableHead>Dönem</TableHead>
            <TableHead>TC</TableHead>
            <TableHead className="w-[1%] whitespace-nowrap">ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <TableRow
              key={s.id}
              role="link"
              tabIndex={0}
              aria-label={`Kiralama detayı: ${s.customer.fullName}`}
              className="cursor-pointer"
              onClick={() => router.push(`/rentals/${s.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/rentals/${s.id}`);
                }
              }}
            >
              <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                {format(parseISO(sessionCreatedAt(s)), "d MMM yyyy, HH:mm", { locale: tr })}
              </TableCell>
              <TableCell className="font-medium">{s.customer.fullName}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(sessionStatus(s))} className="text-[10px]">
                  {RENTAL_STATUS_LABEL[sessionStatus(s)]}
                </Badge>
              </TableCell>
              {plateOf ? (
                <TableCell className="font-mono text-[11px] text-muted-foreground">{plateOf(s).plate}</TableCell>
              ) : null}
              <TableCell className="tabular-nums text-muted-foreground">
                <span className="font-mono text-foreground">{s.startDate}</span>
                {" → "}
                <span className="font-mono text-foreground">{s.endDate}</span>
              </TableCell>
              <TableCell className="font-mono text-[11px]">{s.customer.nationalId}</TableCell>
              <TableCell>
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {s.id.length > 12 ? `${s.id.slice(0, 8)}…` : s.id}
                </code>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
