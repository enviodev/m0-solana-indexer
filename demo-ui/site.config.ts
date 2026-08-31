// M0 on Solana — live data console. Everything the page shows is declared here.
import type { SiteConfig } from "@/lib/types";

// The static production endpoint of enviodev/m0-solana-indexer on staging.envio.dev —
// stable across redeploys, so it is safe to commit. NEXT_PUBLIC_GRAPHQL_ENDPOINT still
// overrides at build time; empty both and the page renders built-in sample data.
const ENDPOINT = "https://enviodev-65eb751.internal.hyperindex.xyz/v1/graphql";

const M_MINT = "mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH";
const WM_MINT = "mzeroXDoBpRVhnEXBra27qzAMdxgpWVY3DzQW7xMVJp";
const TX = "https://solscan.io/tx/{value}";
const ACCOUNT = "https://solscan.io/account/{value}";

const SIG_A = "4nVwzGuDsbSjWH2qhdhsGuvnTFSawQm6Xr7htNaQtoiro1tavdmWL7uJgRbcdqsaN5dqygqaQHkVvMVg6aCBH5fT";
const SIG_B = "4zLpDABTQHNTH1nZzcAgumdfEEuqfdeQBADWPTyrazHsLxycSa2G2xft8wGGTy67hZg2ThcY7g71SpsrL6cgBtUP";
const SIG_C = "2wxp2Xszpiov8xMW7pYA5iyNvjmib98f1gKBnABbujUWY13TmZRtU8xKSHavLZWpZZo8L2zX28GGUuw4zueAT3xE";

export const siteConfig: SiteConfig = {
  title: "M0 on Solana",
  eyebrow: "Live protocol analytics",
  subtitle:
    "$M supply moving through the Portal bridge, the yield index propagated from Ethereum, wM wrap and unwrap flow, and swaps between $M extensions — decoded from the on-chain programs and kept current to the chain tip.",
  protocolName: "M0",
  protocolTag: "Solana",

  theme: {
    accent: "#0f7d5c",
    accentDark: "#22a078",
    preset: "product",
    radius: "md",
    halo: true,
  },

  endpoint: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ?? ENDPOINT,

  chains: [{ id: 7565164, label: "Solana mainnet" }],
  refresh: 2,

  facts: [
    { label: "Indexed from", value: "slot 403,000,000 · 27 Feb 2026" },
    { label: "Programs", value: "Earn · Portal · wM · Ext. swap" },
    { label: "Data", value: "Envio HyperIndex · refreshed live", href: "https://docs.envio.dev/docs/HyperIndex/solana" },
  ],

  hero: {
    kind: "stat",
    title: "Yield index",
    query:
      "query { Latest: IndexUpdate(order_by: {slot: desc}, limit: 1) { index time } Series: IndexUpdate(order_by: {slot: asc}) { time indexFloat } }",
    path: "Latest.index",
    format: "bigintDecimals",
    decimals: 12,
    fractionDigits: 6,
    caption: "Latest M index propagated from Ethereum. $M balances rebase against it.",
    spark: { yPath: "Series.indexFloat" },
    meta: { label: "Last propagated", path: "Latest.time", format: "timeAgo" },
    sample: {
      Latest: [{ index: "1093194056471", time: 1788183389 }],
      Series: [
        { time: 1772176741, indexFloat: 1.074872 },
        { time: 1780000000, indexFloat: 1.0841 },
        { time: 1788183389, indexFloat: 1.093194 },
      ],
    },
  },

  sections: [
    {
      eyebrow: "01 · Yield",
      title: "Index propagation",
      description:
        "Every propagate_index instruction carries the M index from Ethereum to Solana through the Earn program. The series below is the full rebase history since the earliest indexed slot.",
      widgets: [
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
          height: "lg",
          sample: {
            IndexUpdate: [
              { time: 1772176741, indexFloat: 1.074872 },
              { time: 1776000000, indexFloat: 1.0792 },
              { time: 1780000000, indexFloat: 1.0841 },
              { time: 1784000000, indexFloat: 1.0887 },
              { time: 1788183389, indexFloat: 1.093194 },
            ],
          },
          span: 8,
        },
        {
          kind: "stat",
          title: "Propagations",
          query: "query { ProtocolStats { indexUpdates lastSlot } }",
          path: "ProtocolStats.indexUpdates",
          format: "number",
          decimals: 0,
          caption: "propagate_index instructions indexed",
          meta: { label: "Latest slot", path: "ProtocolStats.lastSlot", format: "number", decimals: 0 },
          sample: { ProtocolStats: [{ indexUpdates: 1302, lastSlot: 443164309 }] },
          span: 4,
        },
        {
          kind: "table",
          title: "Recent propagations",
          query:
            "query { IndexUpdate(order_by: {slot: desc}, limit: 8) { time slot index txSignature } }",
          columns: [
            { header: "When", path: "IndexUpdate.time", format: "timeAgo" },
            { header: "Slot", path: "IndexUpdate.slot", format: "number", decimals: 0, align: "right" },
            { header: "Index", path: "IndexUpdate.index", format: "bigintDecimals", decimals: 12, fractionDigits: 9, align: "right" },
            { header: "Transaction", path: "IndexUpdate.txSignature", truncate: "middle", linkTemplate: TX, width: "grow", align: "right" },
          ],
          limit: 8,
          sample: {
            IndexUpdate: [
              { time: 1788183389, slot: 443164309, index: "1093194056471", txSignature: SIG_A },
              { time: 1788179936, slot: 443153422, index: "1093190205595", txSignature: SIG_B },
            ],
          },
          span: 12,
        },
      ],
    },
    {
      eyebrow: "02 · Bridge",
      title: "Portal bridge",
      description:
        "Wormhole-backed Portal messages mint $M on the way in and burn it on the way out. Each message's $M delta is the net change across every $M token account in its transaction.",
      widgets: [
        {
          kind: "stat",
          title: "Net $M bridged",
          query: "query { ProtocolStats { netMBridged } }",
          path: "ProtocolStats.netMBridged",
          format: "signedDecimals",
          decimals: 6,
          unit: "$M",
          caption: "Minted on inbound minus burned on outbound",
          sample: { ProtocolStats: [{ netMBridged: "128235019038" }] },
          span: 4,
        },
        {
          kind: "stat",
          title: "Messages in",
          query: "query { ProtocolStats { bridgeIn } }",
          path: "ProtocolStats.bridgeIn",
          format: "number",
          decimals: 0,
          caption: "receive_message · Ethereum → Solana",
          sample: { ProtocolStats: [{ bridgeIn: 1298 }] },
          span: 4,
        },
        {
          kind: "stat",
          title: "Messages out",
          query: "query { ProtocolStats { bridgeOut } }",
          path: "ProtocolStats.bridgeOut",
          format: "number",
          decimals: 0,
          caption: "send_message · Solana → other chains",
          sample: { ProtocolStats: [{ bridgeOut: 287 }] },
          span: 4,
        },
        {
          kind: "table",
          title: "Recent bridge messages",
          query:
            "query { BridgeMessage(order_by: {slot: desc}, limit: 10) { time direction mTokenDelta destinationChainId slot txSignature } }",
          columns: [
            { header: "When", path: "BridgeMessage.time", format: "timeAgo" },
            {
              header: "Direction",
              path: "BridgeMessage.direction",
              format: "badge",
              badges: {
                in: { label: "Inbound", tone: "accent" },
                out: { label: "Outbound", tone: "neutral" },
              },
            },
            { header: "Δ $M", path: "BridgeMessage.mTokenDelta", format: "signedDecimals", decimals: 6, align: "right" },
            { header: "Dest. chain", path: "BridgeMessage.destinationChainId", format: "number", decimals: 0, align: "right" },
            { header: "Slot", path: "BridgeMessage.slot", format: "number", decimals: 0, align: "right" },
            { header: "Transaction", path: "BridgeMessage.txSignature", truncate: "middle", linkTemplate: TX, width: "grow", align: "right" },
          ],
          limit: 10,
          sample: {
            BridgeMessage: [
              { time: 1788183389, direction: "in", mTokenDelta: "117303070099", destinationChainId: null, slot: 443164309, txSignature: SIG_A },
              { time: 1788179936, direction: "out", mTokenDelta: "-25000000000", destinationChainId: 1, slot: 443153422, txSignature: SIG_B },
            ],
          },
          span: 12,
        },
      ],
    },
    {
      eyebrow: "03 · Extensions",
      title: "wM and extension swaps",
      description:
        "$M wraps into yield-bearing wM through the extension program; the swap program moves value between $M extensions in a single instruction.",
      widgets: [
        {
          kind: "stat",
          title: "wM wrap volume",
          query: "query { ProtocolStats { wrapVolume } }",
          path: "ProtocolStats.wrapVolume",
          format: "bigintDecimals",
          decimals: 6,
          unit: "$M",
          caption: "$M wrapped into wM",
          sample: { ProtocolStats: [{ wrapVolume: "24383817839312" }] },
          span: 4,
        },
        {
          kind: "stat",
          title: "wM unwrap volume",
          query: "query { ProtocolStats { unwrapVolume } }",
          path: "ProtocolStats.unwrapVolume",
          format: "bigintDecimals",
          decimals: 6,
          unit: "$M",
          caption: "wM unwrapped back to $M",
          sample: { ProtocolStats: [{ unwrapVolume: "25551158916979" }] },
          span: 4,
        },
        {
          kind: "stat",
          title: "Extension swaps",
          query: "query { ProtocolStats { swapCount } }",
          path: "ProtocolStats.swapCount",
          format: "number",
          decimals: 0,
          caption: "swap instructions on the extension swap program",
          sample: { ProtocolStats: [{ swapCount: 609 }] },
          span: 4,
        },
        {
          kind: "table",
          title: "Recent wM activity",
          query:
            "query { WMEvent(order_by: {slot: desc}, limit: 6) { time kind amount tokenAuthority txSignature } }",
          columns: [
            { header: "When", path: "WMEvent.time", format: "timeAgo" },
            {
              header: "Kind",
              path: "WMEvent.kind",
              format: "badge",
              badges: {
                wrap: { label: "Wrap", tone: "accent" },
                unwrap: { label: "Unwrap", tone: "neutral" },
                claim_for: { label: "Claim", tone: "good" },
              },
            },
            { header: "Amount", path: "WMEvent.amount", format: "bigintDecimals", decimals: 6, align: "right", unit: "$M" },
            { header: "Authority", path: "WMEvent.tokenAuthority", truncate: "middle", linkTemplate: ACCOUNT },
            { header: "Tx", path: "WMEvent.txSignature", truncate: "middle", linkTemplate: TX, width: "grow", align: "right" },
          ],
          limit: 6,
          sample: {
            WMEvent: [
              { time: 1787737184, kind: "wrap", amount: "12496002478", tokenAuthority: "5qRSth9bauYSDcSF6rduiLciDAfCNWWd8EiHhgX1w5Tb", txSignature: SIG_A },
              { time: 1787736799, kind: "claim_for", amount: "1200000", tokenAuthority: "5qRSth9bauYSDcSF6rduiLciDAfCNWWd8EiHhgX1w5Tb", txSignature: SIG_B },
            ],
          },
          span: 12,
        },
        {
          kind: "table",
          title: "Recent extension swaps",
          query:
            "query { ExtSwapEvent(order_by: {slot: desc}, limit: 6) { time kind amount fromMint toMint txSignature } }",
          columns: [
            { header: "When", path: "ExtSwapEvent.time", format: "timeAgo" },
            {
              header: "Kind",
              path: "ExtSwapEvent.kind",
              format: "badge",
              badges: {
                swap: { label: "Swap", tone: "accent" },
                wrap: { label: "Wrap", tone: "neutral" },
                unwrap: { label: "Unwrap", tone: "neutral" },
              },
            },
            { header: "Amount", path: "ExtSwapEvent.amount", format: "bigintDecimals", decimals: 6, align: "right" },
            { header: "From", path: "ExtSwapEvent.fromMint", truncate: "middle", linkTemplate: ACCOUNT },
            { header: "To", path: "ExtSwapEvent.toMint", truncate: "middle", linkTemplate: ACCOUNT },
            { header: "Tx", path: "ExtSwapEvent.txSignature", truncate: "middle", linkTemplate: TX, width: "grow", align: "right" },
          ],
          limit: 6,
          sample: {
            ExtSwapEvent: [
              { time: 1788183389, kind: "wrap", amount: "128235019038", fromMint: M_MINT, toMint: "xoUSDq85Rjsb6SbUwJyreFgeWQvxdkT7R3c3g7s6p5Y", txSignature: SIG_A },
              { time: 1787844601, kind: "unwrap", amount: "166232153004", fromMint: WM_MINT, toMint: M_MINT, txSignature: SIG_C },
            ],
          },
          span: 12,
        },
      ],
    },
  ],

  footerLinks: [
    { label: "M0", href: "https://www.m0.org" },
    { label: "Envio HyperIndex", href: "https://docs.envio.dev/docs/HyperIndex/solana" },
    { label: "Indexer source", href: "https://github.com/enviodev/m0-solana-indexer" },
  ],
};
