"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Mail, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFleetSessions } from "@/hooks/use-fleet-sessions";
import { buildRentalRequestMessage, buildRentalRequestUrl, normalizedPhoneForWhatsApp } from "@/lib/customer-contact";
import { loadManualCustomerRows, mergeSessionAndManualCustomers } from "@/lib/manual-customers";
import { aggregateCustomersFromSessions, mergeCustomerDirectoryStates } from "@/lib/rental-metadata";
import { fetchCustomerRecordStatesFromRentApi } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

export function CustomersChannelClient() {
  const { allSessions } = useFleetSessions();
  const { data: customerRecordStates } = useQuery({
    queryKey: rentKeys.customerRecords(),
    queryFn: fetchCustomerRecordStatesFromRentApi,
    staleTime: 20_000,
  });
  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [customMessage] = useState("");

  const rows = useMemo(() => {
    const sessionRows = aggregateCustomersFromSessions(allSessions);
    const manualRows = loadManualCustomerRows();
    const merged = mergeSessionAndManualCustomers(sessionRows, manualRows);
    return mergeCustomerDirectoryStates(merged, customerRecordStates);
  }, [allSessions, customerRecordStates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      ({ customer }) =>
        customer.fullName.toLowerCase().includes(q) ||
        (customer.nationalId ?? "").toLowerCase().includes(q) ||
        customer.phone.toLowerCase().includes(q) ||
        customer.passportNo.toLowerCase().includes(q) ||
        (customer.email ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const selectedRows = useMemo(() => filtered.filter((r) => selectedKeys.has(r.key)), [filtered, selectedKeys]);

  const toggleSelect = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const selectAllFiltered = (checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const r of filtered) next.add(r.key);
      } else {
        for (const r of filtered) next.delete(r.key);
      }
      return next;
    });
  };

  const selectAllCustomers = () => {
    setSelectedKeys(new Set(rows.map((r) => r.key)));
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const requestUrlFor = (customer: (typeof selectedRows)[number]["customer"]) => {
    if (typeof window === "undefined") return "/rental-request-form";
    return buildRentalRequestUrl(window.location.origin, customer);
  };

  const messageFor = (customer: (typeof selectedRows)[number]["customer"]) => {
    const base = buildRentalRequestMessage(customer.fullName, requestUrlFor(customer));
    if (!customMessage.trim()) return base;
    return `${base}\n\n${customMessage.trim()}`;
  };

  const copyLinks = async () => {
    if (selectedRows.length === 0) {
      toast.error("Önce müşteri seçin.");
      return;
    }
    const lines = selectedRows.map((r) => `${r.customer.fullName}: ${requestUrlFor(r.customer)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(`${selectedRows.length} müşteri için bağlantı kopyalandı.`);
    } catch {
      toast.error("Bağlantılar kopyalanamadı.");
    }
  };

  const sendMail = () => {
    if (selectedRows.length === 0) {
      toast.error("Önce müşteri seçin.");
      return;
    }
    const recipients = selectedRows
      .map((r) => r.customer.email?.trim())
      .filter((v): v is string => Boolean(v && v.includes("@")));
    if (recipients.length === 0) {
      toast.error("Seçilen müşterilerde geçerli e-posta bulunamadı.");
      return;
    }
    const body = selectedRows
      .map((r) => `- ${r.customer.fullName}: ${requestUrlFor(r.customer)}`)
      .join("\n");
    const subject = encodeURIComponent("Kiralama talep formu bağlantınız");
    const extra = customMessage.trim() ? `${customMessage.trim()}\n\n` : "";
    const encodedBody = encodeURIComponent(`${extra}Aşağıdaki bağlantılardan talep formunu doldurabilirsiniz:\n${body}`);
    if (recipients.length === 1) {
      window.location.href = `mailto:${encodeURIComponent(recipients[0])}?subject=${subject}&body=${encodedBody}`;
      return;
    }
    window.location.href = `mailto:?bcc=${encodeURIComponent(recipients.join(","))}&subject=${subject}&body=${encodedBody}`;
  };

  const sendWhatsApp = () => {
    if (selectedRows.length === 0) {
      toast.error("Önce müşteri seçin.");
      return;
    }
    const targets = selectedRows
      .map((r) => ({
        name: r.customer.fullName,
        phone: normalizedPhoneForWhatsApp(r.customer.phone),
        text: messageFor(r.customer),
      }))
      .filter((t): t is { name: string; phone: string; text: string } => Boolean(t.phone));

    if (targets.length === 0) {
      toast.error("Seçilen müşterilerde WhatsApp için geçerli telefon yok.");
      return;
    }

    targets.forEach((t, idx) => {
      window.setTimeout(() => {
        const url = `https://wa.me/${t.phone}?text=${encodeURIComponent(t.text)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }, idx * 180);
    });

    if (targets.length > 1) {
      toast.message("Birden fazla WhatsApp sekmesi açıldı; tarayıcı engellerse popup izni verin.");
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedKeys.has(r.key));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card className="glow-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Toplu mesaj kanalı</CardTitle>
          <CardDescription className="text-xs">
            Seçilen müşterilere talep formu bağlantısını mail, WhatsApp veya link kopyalama ile iletin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
              placeholder="Üye ara: isim, TC, telefon, pasaport veya e-posta..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-xs">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) => selectAllFiltered(e.target.checked)}
                className="rounded border-input"
              />
              Filtreleneni seç
            </label>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={selectAllCustomers}>
              Tüm müşterileri seç
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={clearSelection}>
              Seçimi temizle
            </Button>
            <span className="text-xs text-muted-foreground">{selectedRows.length} müşteri seçildi</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={sendMail}>
              <Mail className="h-3.5 w-3.5" />
              Toplu mail
            </Button>
            <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs" onClick={sendWhatsApp}>
              <MessageCircle className="h-3.5 w-3.5" />
              Toplu WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void copyLinks()}>
              <Copy className="h-3.5 w-3.5" />
              Linkleri kopyala
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</p>
          ) : (
            <div className="rounded-lg border">
              <Table className="min-w-[520px] text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={allFilteredSelected}
                        onChange={(e) => selectAllFiltered(e.target.checked)}
                        title="Filtrelenenlerin tümünü seç"
                        aria-label="Filtrelenenlerin tümünü seç"
                      />
                    </TableHead>
                    <TableHead>Ad soyad</TableHead>
                    <TableHead>İletişim</TableHead>
                    <TableHead className="text-right tabular-nums">Kiralama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={selectedKeys.has(row.key)}
                          onChange={(e) => toggleSelect(row.key, e.target.checked)}
                          aria-label={`${row.customer.fullName} seç`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.customer.fullName}</TableCell>
                      <TableCell className="max-w-[240px] text-muted-foreground">
                        <span className="block truncate">{row.customer.phone}</span>
                        {row.customer.email ? (
                          <span className="block truncate text-[11px]">{row.customer.email}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{row.totalRentals}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
