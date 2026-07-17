import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DemoDataBanner } from "@/components/layout/DemoDataBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SITE_URL } from "@/lib/content/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const DESCRIPTION =
  "A demo dataset exploring how AI adoption signals could be tracked across seven public-interest sectors. Demo data only -- not live monitoring.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Signal Commons",
  description: DESCRIPTION,
  openGraph: {
    siteName: "Signal Commons",
    title: "Signal Commons",
    description: DESCRIPTION,
    type: "website",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-md"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <DemoDataBanner />
        <main id="main-content" className="flex-1 pb-16">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
