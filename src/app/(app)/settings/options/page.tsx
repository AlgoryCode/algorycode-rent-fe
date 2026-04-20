import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsOptionsHubPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Opsiyonlar</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Araç şablonları araca kopyalanır; kiralama opsiyonları rezervasyon ekranında listelenir. Alış ve teslim noktaları aynı
          bölümde menüden de erişilebilir.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/settings/options/vehicle" className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="glow-card h-full transition-colors hover:border-primary/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Araç opsiyonları</CardTitle>
              <CardDescription className="text-xs">Şablon kataloğu; araç oluştururken veya “Opsiyon ekle” ile araca uygulanır.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 text-xs font-medium text-primary">Yönet →</CardContent>
          </Card>
        </Link>
        <Link href="/settings/options/rental" className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="glow-card h-full transition-colors hover:border-primary/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Kiralama Opsiyonları</CardTitle>
              <CardDescription className="text-xs">Rezervasyon sihirbazında gösterilen genel ek hizmetler.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 text-xs font-medium text-primary">Yönet →</CardContent>
          </Card>
        </Link>
        <Link href="/settings/locations/pickup" className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="glow-card h-full transition-colors hover:border-primary/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Alış noktaları</CardTitle>
              <CardDescription className="text-xs">Kiralama başlangıcı için handover (PICKUP) kayıtları.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 text-xs font-medium text-primary">Yönet →</CardContent>
          </Card>
        </Link>
        <Link href="/settings/locations/return" className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="glow-card h-full transition-colors hover:border-primary/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Teslim noktaları</CardTitle>
              <CardDescription className="text-xs">Araç iadesi için handover (RETURN) kayıtları.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 text-xs font-medium text-primary">Yönet →</CardContent>
          </Card>
        </Link>
        <Link href="/settings/vehicle-catalog" className="block rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="glow-card h-full transition-colors hover:border-primary/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Araç özellikleri</CardTitle>
              <CardDescription className="text-xs">
                Yakıt türü, vites türü ve araç gövde tipi listeleri; araç formundaki seçenekler buradan yönetilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4 text-xs font-medium text-primary">Yönet →</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
