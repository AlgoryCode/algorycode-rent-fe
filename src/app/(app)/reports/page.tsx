"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Card className="glow-card">
        <CardHeader>
          <CardTitle className="text-base">Raporlar</CardTitle>
          <CardDescription>Detayli raporlar bu alanda sunulacak.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Yakit, gelir-gider, doluluk ve performans raporlari icin hazirlaniyor.</p>
        </CardContent>
      </Card>
    </div>
  );
}
