import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "@/site.config";
import "./globals.css";

// Type for the UI, mono for figures and identifiers. Both self-hosted by
// next/font at build time — no runtime requests, no layout shift.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500", "600"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://m0-solana-analytics.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteConfig.title,
  description: siteConfig.subtitle,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.subtitle,
    type: "website",
    siteName: `${siteConfig.protocolName} analytics`,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.subtitle,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme injection: the light/dark accent pair land as CSS vars; globals.css
  // picks the right one per mode. theme.accent wins over legacy accentColor.
  const accent = siteConfig.theme?.accent ?? siteConfig.accentColor ?? "#0f7d5c";
  const accentDark = siteConfig.theme?.accentDark ?? accent;
  const themeStyle = {
    "--accent-light": accent,
    "--accent-dark": accentDark,
  } as CSSProperties;

  const preset = process.env.NEXT_PUBLIC_PRESET ?? siteConfig.theme?.preset ?? "product";
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body
        style={themeStyle}
        data-radius={siteConfig.theme?.radius ?? "md"}
        data-preset={preset}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
