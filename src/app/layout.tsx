import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { LocaleProvider } from "@/components/locale-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { LOCALE_STORAGE_KEY, parseStoredLocale, type AppLocale } from "@/lib/i18n/locales";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AlgoryRent — Filo yönetimi",
  description: "Araç kiralama yönetim paneli",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLocale = parseStoredLocale(cookieStore.get(LOCALE_STORAGE_KEY)?.value) ?? undefined;
  const htmlLang: AppLocale = cookieLocale ?? "tr";

  return (
    <html lang={htmlLang} className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <LocaleProvider initialLocale={cookieLocale}>
          <QueryProvider>{children}</QueryProvider>
        </LocaleProvider>
        <Toaster />
      </body>
    </html>
  );
}
