// Shared types for the site config. See ../site.config.ts for a filled-in example.
// Everything new is optional — configs written against the older template keep working.

/**
 * How a raw value pulled out of the GraphQL response should be displayed.
 *  - number / usd / percent / compact: plain numerics
 *  - bigintDecimals: integer base units scaled by `decimals` (default 18)
 *  - signedDecimals: bigintDecimals with an explicit sign, tinted good/bad
 *  - timeAgo: epoch seconds → "12m ago" (full timestamp on hover)
 *  - datetime: epoch seconds → short absolute date/time
 *  - badge: categorical label rendered as a tinted pill (see TableColumn.badges)
 */
export type Format =
  | "number"
  | "usd"
  | "bigintDecimals"
  | "signedDecimals"
  | "percent"
  | "compact"
  | "timeAgo"
  | "datetime"
  | "badge";

/** Grid width of a card on the 12-column desktop grid. Defaults: stat 4, others 8. */
export type Span = 3 | 4 | 6 | 8 | 9 | 12;

export type Tone = "neutral" | "accent" | "good" | "bad" | "warn";

interface WidgetBase {
  /** Card heading. */
  title: string;
  /** Re-fetch this widget every N seconds (overrides config.refresh; 0 disables). */
  refreshSeconds?: number;
  /** GraphQL query string sent (POST) to the endpoint. */
  query: string;
  /** Small muted line under the widget content. */
  caption?: string;
  /** Grid columns this card spans (desktop). */
  span?: Span;
  /**
   * Optional sample response `data` object used in mock mode
   * (NEXT_PUBLIC_MOCK=1 or an empty endpoint). Its shape must match what the
   * real query returns so the same paths resolve against both.
   */
  sample?: unknown;
}

/** Tiny inline trend rendered under a stat value, plus an automatic delta chip. */
export interface Spark {
  /** Dot-path to the y series within THIS widget's query response. */
  yPath: string;
  /** Optional x path (unused visually; reserved for tooltips later). */
  xPath?: string;
}

/** A secondary fact under a stat, e.g. "Last propagated · 12m ago". */
export interface StatMeta {
  label: string;
  /** Dot-path into the same response. */
  path: string;
  format?: Format;
  decimals?: number;
}

/** A single headline number. */
export interface StatWidget extends WidgetBase {
  kind: "stat";
  /** Dot-path into the response `data` (e.g. "Totals.totalPooledEther"). */
  path: string;
  format?: Format;
  /** Fraction digits for number/usd/percent; token decimals for bigintDecimals (default 18). */
  decimals?: number;
  /** Fractional digits to display for bigintDecimals/signedDecimals (default 2). */
  fractionDigits?: number;
  /** Unit suffix rendered after the value in muted ink, e.g. "$M". */
  unit?: string;
  /** Render a sparkline + delta chip from a series in the same response. */
  spark?: Spark;
  /** Which direction is good for the delta chip (default "up"). */
  deltaGoodWhen?: "up" | "down";
  /** Hide the auto delta chip even when spark is present. */
  hideDelta?: boolean;
  /** Secondary fact line under the value. */
  meta?: StatMeta;
}

export interface Series {
  /** Dot-path to this series' y values. */
  yPath: string;
  /** Legend label (required when more than one series). */
  label?: string;
}

/** A line/area chart over one or more series (max 4; ≥2 renders a legend). */
export interface TimeseriesWidget extends WidgetBase {
  kind: "timeseries";
  /** Dot-path to the x values. Auto-maps over arrays: "DailyApr.day". */
  xPath: string;
  /** Single-series shorthand. Use `series` for multiple. */
  yPath?: string;
  /** Multi-series form (first series uses the accent, then fixed palette slots). */
  series?: Series[];
  yLabel?: string;
  format?: Format;
  /** Fraction digits for tooltip values (axis ticks stay compact). */
  decimals?: number;
  /** Divide y values by 10^scale before plotting (token base units → whole tokens). */
  scale?: number;
  /** Interpret x values for tick labels: raw (default) | epochDays | epochSeconds. */
  xFormat?: "epochDays" | "epochSeconds";
  /** Reverse point order (for queries returned in desc order). */
  reverse?: boolean;
  /** "area" (default) = 2px line + soft wash; "line" = line only. */
  variant?: "area" | "line";
  /** Taller plot for a section-defining chart. */
  height?: "md" | "lg";
}

/** Discrete columns — daily volumes, counts per period. */
export interface BarsWidget extends WidgetBase {
  kind: "bars";
  xPath: string;
  yPath: string;
  yLabel?: string;
  format?: Format;
  decimals?: number;
  /** Divide y values by 10^scale before plotting. */
  scale?: number;
  /** Interpret x values for tick labels: raw (default) | epochDays | epochSeconds. */
  xFormat?: "epochDays" | "epochSeconds";
  /** Reverse point order (for queries returned in desc order). */
  reverse?: boolean;
}

export interface TableColumn {
  header: string;
  /** Dot-path to this column's values, e.g. "WithdrawalRequest.amount". */
  path: string;
  format?: Format;
  /** Token decimals for bigintDecimals columns (default 18). */
  decimals?: number;
  /** Fractional digits to display for bigintDecimals/signedDecimals (default 2). */
  fractionDigits?: number;
  /** Right-align numeric columns. */
  align?: "left" | "right";
  /** Middle-ellipsis long identifiers (addresses, hashes) in monospace. */
  truncate?: "middle";
  /** Render as a link; "{value}" is replaced (e.g. "https://etherscan.io/tx/{value}"). */
  linkTemplate?: string;
  /** For format "badge": raw value → { label, tone }. Unlisted values render neutral. */
  badges?: Record<string, { label: string; tone?: Tone }>;
  /** Unit suffix appended to formatted numerics, e.g. "$M". */
  unit?: string;
  /** Column width hint; "grow" takes remaining space. */
  width?: "grow";
}

/** A recent-rows table. */
export interface TableWidget extends WidgetBase {
  kind: "table";
  columns: TableColumn[];
  /** Max rows to render (default: all returned). */
  limit?: number;
}

export type Widget = StatWidget | TimeseriesWidget | BarsWidget | TableWidget;

/** A titled group of widgets with its own 12-column grid. */
export interface Section {
  /** Anchor id (defaults to a slug of the title). */
  id?: string;
  /** Small eyebrow above the title, e.g. "01 · Yield". */
  eyebrow?: string;
  title: string;
  /** One factual sentence about what this section covers. */
  description?: string;
  widgets: Widget[];
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface ChainChip {
  /** Chain id (informational). */
  id: number;
  /** Short label shown in the header, e.g. "Ethereum". */
  label: string;
}

/** A label/value pair shown under the hero copy, e.g. "Indexed from · slot 403,000,000". */
export interface Fact {
  label: string;
  value: string;
  href?: string;
}

/** Per-prospect look & feel. Everything optional; sensible defaults apply. */
export interface Theme {
  /** Brand accent (light mode). Must hold ≥3:1 against white for chart marks. */
  accent: string;
  /** Visual personality: "product" (default) | "editorial" (oversized hero, generous
   *  whitespace — single-headline stories) | "terminal" (dense, mono figures, flat
   *  panels — flow-heavy live data). Overridable at build time via NEXT_PUBLIC_PRESET. */
  preset?: "product" | "editorial" | "terminal";
  /** Accent adjusted for dark surfaces (defaults to `accent`). */
  accentDark?: string;
  /** Corner personality: "sm" 10px · "md" 14px (default) · "lg" 20px. */
  radius?: "sm" | "md" | "lg";
  /** Subtle radial accent wash behind the hero. Tasteful, off by default. */
  halo?: boolean;
}

export interface SiteConfig {
  /** Page H1 — product voice, e.g. "Spiko Analytics". Never a sales claim. */
  title: string;
  /** One factual sentence about coverage. */
  subtitle: string;
  protocolName: string;
  /** Short qualifier next to the wordmark, e.g. "Solana". */
  protocolTag?: string;
  /** Small eyebrow above the H1, e.g. "Live protocol data". */
  eyebrow?: string;
  /** Legacy accent (still honored). Prefer `theme.accent`. */
  accentColor?: string;
  theme?: Theme;
  /** GraphQL endpoint. Overridable at runtime via NEXT_PUBLIC_GRAPHQL_ENDPOINT. */
  endpoint: string;
  /** Chains covered — rendered as header chips. */
  chains?: ChainChip[];
  /** Show the live "synced to slot N" chip (reads chain_metadata; default true). */
  liveStatus?: boolean;
  /** Default widget re-fetch interval in seconds (0/unset = static page). */
  refresh?: number;
  /** Optional dominant hero metric shown beside the title. */
  hero?: StatWidget;
  /** Facts rendered under the hero copy. */
  facts?: Fact[];
  /** Grouped layout. When present, `widgets` is ignored. */
  sections?: Section[];
  /** Flat layout (legacy). */
  widgets?: Widget[];
  footerLinks?: FooterLink[];
}

/** Back-compat alias for configs written against the older template. */
export type DemoConfig = SiteConfig;
