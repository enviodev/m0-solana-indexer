import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "@/site.config";
import "./globals.css";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.subtitle,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme injection: the light/dark accent pair land as CSS vars; globals.css
  // picks the right one per mode. theme.accent wins over legacy accentColor.
  const accent = siteConfig.theme?.accent ?? siteConfig.accentColor ?? "#2a78d6";
  const accentDark = siteConfig.theme?.accentDark ?? accent;
  const themeStyle = {
    "--accent-light": accent,
    "--accent-dark": accentDark,
  } as CSSProperties;

  const preset = process.env.NEXT_PUBLIC_PRESET ?? siteConfig.theme?.preset ?? "product";
  return (
    <html lang="en">
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
