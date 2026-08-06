import { ImageResponse } from "next/og";
import { siteConfig } from "@/site.config";

// Favicon: a rounded brand chip in the prospect's accent color, generated at
// build time from the theme. Keeps every tab identifiable with zero assets.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const accent = siteConfig.theme?.accent ?? siteConfig.accentColor ?? "#2a78d6";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            background: "rgba(255,255,255,0.92)",
          }}
        />
      </div>
    ),
    size,
  );
}
