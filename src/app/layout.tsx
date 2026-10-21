import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PSGC API · Philippine Standard Geographic Code", template: "%s · PSGC API" },
  description: "Dashboard and REST API for the Philippine Standard Geographic Code (PSGC) published by the Philippine Statistics Authority: regions, provinces, cities, municipalities and barangays.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ph-blue text-xs font-bold text-white">PH</span>
              PSGC API
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/#explorer" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">Explorer</Link>
              <Link href="/docs" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">API docs</Link>
              <Link href="/docs#integration" className="hidden rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:block">Integration plan</Link>
            </nav>
          </div>
          <div className="flex h-1"><div className="flex-1 bg-ph-blue" /><div className="flex-1 bg-ph-red" /><div className="w-12 bg-ph-yellow" /></div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between">
            <p>Source: Philippine Statistics Authority (PSA), <a className="underline" href="https://psa.gov.ph/classification/psgc">Philippine Standard Geographic Code</a>. Not an official PSA service.</p>
            <p>Data is published only after manual review of each PSA release.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
