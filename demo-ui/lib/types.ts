// Shared types for the site config. See ../site.config.ts for a filled-in example.
// Everything new is optional — configs written against the older template keep working.

/** How a raw value pulled out of the GraphQL response should be displayed. */
export type Format = "number" | "usd" | "bigintDecimals" | "percent" | "compact";

/** Grid width of a card on the 12-column desktop grid. Defaults: stat 4, others 8. */
export type Span = 4 | 6 | 8 | 12;

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

/** A single headline number. */
export interface StatWidget extends WidgetBase {
  kind: "stat";
  /** Dot-path into the response `data` (e.g. "Totals.totalPooledEther"). */
  path: string;
  format?: Format;
  /** Fraction digits for number/usd/percent; token decimals for bigintDecimals (default 18). */
  decimals?: number;
  /** Render a sparkline + delta chip from a series in the same response. */
  spark?: Spark;
  /** Which direction is good for the delta chip (default "up"). */
  deltaGoodWhen?: "up" | "down";
  /** Hide the auto delta chip even when spark is present. */
  hideDelta?: boolean;
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
  /** Interpret x values for tick labels: raw (default) | epochDays | epochSeconds. */
  xFormat?: "epochDays" | "epochSeconds";
  /** Reverse point order (for queries returned in desc order). */
  reverse?: boolean;
  /** "area" (default) = 2px line + soft wash; "line" = line only. */
  variant?: "area" | "line";
}

/** Discrete columns — daily volumes, counts per period. */
export interface BarsWidget extends WidgetBase {
  kind: "bars";
  xPath: string;
  yPath: string;
  yLabel?: string;
  format?: Format;
  decimals?: number;
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
  /** Right-align numeric columns. */
  align?: "left" | "right";
  /** Middle-ellipsis long identifiers (addresses, hashes) in monospace. */
  truncate?: "middle";
  /** Render as a link; "{value}" is replaced (e.g. "https://etherscan.io/tx/{value}"). */
  linkTemplate?: string;
}

/** A recent-rows table. */
export interface TableWidget extends WidgetBase {
  kind: "table";
  columns: TableColumn[];
  /** Max rows to render (default: all returned). */
  limit?: number;
}

export type Widget = StatWidget | TimeseriesWidget | BarsWidget | TableWidget;

export interface FooterLink {
  label: string;
  href: string;
}

export interface ChainChip {
  /** EVM chain id (informational). */
  id: number;
  /** Short label shown in the header, e.g. "Ethereum". */
  label: string;
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
  /** Legacy accent (still honored). Prefer `theme.accent`. */
  accentColor?: string;
  theme?: Theme;
  /** GraphQL endpoint. Overridable at runtime via NEXT_PUBLIC_GRAPHQL_ENDPOINT. */
  endpoint: string;
  /** Chains covered — rendered as header chips. */
  chains?: ChainChip[];
  /** Show the live "synced to block N" chip (reads chain_metadata; default true). */
  liveStatus?: boolean;
  /** Default widget re-fetch interval in seconds (0/unset = static page). */
  refresh?: number;
  /** Optional dominant hero metric shown beside the title. */
  hero?: StatWidget;
  widgets: Widget[];
  footerLinks?: FooterLink[];
}

/** Back-compat alias for configs written against the older template. */
export type DemoConfig = SiteConfig;
