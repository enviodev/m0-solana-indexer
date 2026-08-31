import { ImageResponse } from "next/og";
import { siteConfig } from "@/site.config";

// Social card: dark ground, the brand mark, the H1 and one factual line.
export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const accent = siteConfig.theme?.accentDark ?? siteConfig.theme?.accent ?? "#22a078";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0c0c0b 0%, #131513 100%)",
          color: "#f2f2ee",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: accent,
              boxShadow: `0 0 0 8px ${accent}33`,
            }}
          />
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            <span>{siteConfig.protocolName}</span>
            <span style={{ color: "#85837c", marginLeft: 14 }}>{`/ ${siteConfig.protocolTag ?? ""}`}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
            {siteConfig.title}
          </div>
          <div style={{ fontSize: 30, color: "#bdbcb3", maxWidth: 900, lineHeight: 1.3 }}>
            {`${siteConfig.eyebrow ?? "Live protocol analytics"} · indexed by Envio HyperIndex`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
