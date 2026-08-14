// M^0 on Solana — live data console. Endpoint filled at deploy time.
import type { SiteConfig } from "@/lib/types";

export const siteConfig: SiteConfig = {
  title: "M^0 Solana Analytics",
  subtitle:
    "Live $M on Solana: yield index propagation, Portal bridge traffic, wM wrap and unwrap activity, and extension swaps. Indexed from slot 403,000,000 (27 Feb 2026), the earliest slot available, straight through to the chain tip.",
  protocolName: "M^0",

  theme: {
    accent: "#0f7d5c",
    accentDark: "#2fae86",
    preset: "product",
    radius: "md",
    halo: true,
  },

  endpoint: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? "https://indexer.dev.hyperindex.xyz/44b912b/v1/graphql",

  chains: [{ id: 7565164, label: "Solana" }],
  refresh: 30,

  hero: {
    kind: "stat",
    title: "Yield index",
    query:
      "query { Latest: IndexUpdate(order_by: {slot: desc}, limit: 1) { index } Series: IndexUpdate(order_by: {slot: asc}) { time indexFloat } }",
    path: "Latest.index",
    format: "bigintDecimals",
    decimals: 12,
    caption: "Latest index propagated from Ethereum via the Portal bridge",
    spark: { yPath: "Series.indexFloat" },
    sample: {
      Latest: [{ index: "1090699442016" }],
      Series: [
        { time: 1754400000, indexFloat: 1.090612 },
        { time: 1754470000, indexFloat: 1.090699 },
      ],
    },
  },

  widgets: [
    {
      kind: "stat",
      title: "Index propagations",
      query: "query { ProtocolStats { indexUpdates } }",
      path: "ProtocolStats.indexUpdates",
      format: "number",
      decimals: 0,
      caption: "propagate_index instructions indexed",
      sample: { ProtocolStats: [{ indexUpdates: 8 }] },
      span: 4,
    },
    {
      kind: "stat",
      title: "Bridge messages in",
      query: "query { ProtocolStats { bridgeIn } }",
      path: "ProtocolStats.bridgeIn",
      format: "number",
      decimals: 0,
      caption: "Portal receive_message instructions",
      sample: { ProtocolStats: [{ bridgeIn: 8 }] },
      span: 4,
    },
    {
      kind: "stat",
      title: "wM wrap volume",
      query: "query { ProtocolStats { wrapVolume } }",
      path: "ProtocolStats.wrapVolume",
      format: "bigintDecimals",
      decimals: 6,
      caption: "$M wrapped into wM",
      sample: { ProtocolStats: [{ wrapVolume: "99990000" }] },
      span: 4,
    },
    {
      kind: "timeseries",
      title: "Yield index over time",
      query: "query { IndexUpdate(order_by: {slot: asc}) { time indexFloat } }",
      xPath: "IndexUpdate.time",
      yPath: "IndexUpdate.indexFloat",
      xFormat: "epochSeconds",
      format: "number",
      decimals: 6,
      yLabel: "Index",
      variant: "line",
      sample: {
        IndexUpdate: [
          { time: 1754400000, indexFloat: 1.090612 },
          { time: 1754430000, indexFloat: 1.090649 },
          { time: 1754470000, indexFloat: 1.090699 },
        ],
      },
      span: 8,
    },
    {
      kind: "table",
      title: "Recent index propagations",
      query:
        "query { IndexUpdate(order_by: {slot: desc}, limit: 8) { slot index txSignature } }",
      columns: [
        { header: "Slot", path: "IndexUpdate.slot", format: "number", align: "right" },
        {
          header: "Index",
          path: "IndexUpdate.index",
          format: "bigintDecimals",
          decimals: 12,
          align: "right",
        },
        {
          header: "Transaction",
          path: "IndexUpdate.txSignature",
          truncate: "middle",
          linkTemplate: "https://solscan.io/tx/{value}",
        },
      ],
      limit: 8,
      sample: {
        IndexUpdate: [
          { slot: 437584902, index: "1090699442016", txSignature: "323Zuc9gqHXr46kGAy2yPRXeEHAg4B7aqqNajeLTzh2PMM9yzR91Kdp8bErEpSrTrFzNNfAPAqC5QdQvqTkr1ztB" },
        ],
      },
      span: 12,
    },
    {
      kind: "table",
      title: "Recent bridge messages",
      query:
        "query { BridgeMessage(order_by: {slot: desc}, limit: 8) { direction slot txSignature } }",
      columns: [
        { header: "Direction", path: "BridgeMessage.direction" },
        { header: "Slot", path: "BridgeMessage.slot", format: "number", align: "right" },
        {
          header: "Transaction",
          path: "BridgeMessage.txSignature",
          truncate: "middle",
          linkTemplate: "https://solscan.io/tx/{value}",
        },
      ],
      limit: 8,
      sample: {
        BridgeMessage: [{ direction: "in", slot: 437584902, txSignature: "323Zuc9…" }],
      },
      span: 12,
    },
  ],

  footerLinks: [
    { label: "M^0", href: "https://www.m0.org" },
    { label: "Envio", href: "https://envio.dev" },
    { label: "Indexer on Envio", href: "https://envio.dev/app/enviodev/m0-solana-indexer" },
  ],
};
