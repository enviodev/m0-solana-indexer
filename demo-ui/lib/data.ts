// Pure helpers shared by every widget: endpoint/mock resolution, dot-path
// extraction, and value formatting. No React here so it is safe to import
// from server or client code.

import { siteConfig } from "@/site.config";
import type { Format } from "./types";

/** Resolve the active endpoint (env var wins over config). */
export function getEndpoint(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  return (fromEnv || siteConfig.endpoint || "").trim();
}

/** Mock mode: explicit flag, or no endpoint to talk to. */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK === "1" || getEndpoint() === "";
}

/** Hasura console / playground URL for a HyperIndex GraphQL endpoint. */
export function playgroundUrl(endpoint: string): string {
  return endpoint.replace(/\/v1\/graphql\/?$/, "/console");
}

/**
 * Resolve a dot-path against an object. When traversal hits an array, the
 * remaining path is mapped over every element, so "Rows.amount" against
 * `{ Rows: [{amount: 1}, {amount: 2}] }` yields `[1, 2]`.
 */
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  return walk(obj, parts);
}

function walk(value: unknown, parts: string[]): unknown {
  if (parts.length === 0) return value;
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.map((item) => walk(item, parts));
  const [head, ...rest] = parts;
  return walk((value as Record<string, unknown>)[head], rest);
}

/** Coerce a resolved value into an array for series/table consumption. */
export function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

/** Take the first element if a path resolved to an array (for scalar stats). */
export function firstScalar(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

const EM_DASH = "—";

/** Render a raw value for display. Returns an em dash for missing values. */
export function formatValue(
  value: unknown,
  format?: Format,
  decimals?: number,
  fractionDigits?: number,
): string {
  if (value === null || value === undefined || value === "") return EM_DASH;

  switch (format) {
    case "usd": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: decimals ?? 2,
      }).format(n);
    }
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: decimals ?? 2,
      }).format(n);
    }
    case "bigintDecimals":
      return formatBigintDecimals(value, decimals ?? 18, fractionDigits);
    case "signedDecimals": {
      const s = formatBigintDecimals(value, decimals ?? 18, fractionDigits);
      if (s === "0") return "0";
      return s.startsWith("-") ? `−${s.slice(1)}` : `+${s}`;
    }
    case "percent": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals ?? 2 }).format(n)}%`;
    }
    case "compact": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: decimals ?? 1,
      }).format(n);
    }
    case "timeAgo":
      return timeAgo(value);
    case "datetime": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return new Date(n * 1000).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    case "badge":
      return String(value);
    default:
      return String(value);
  }
}

/** Sign of a numeric-ish value: 1, -1 or 0 (NaN → 0). Works on bigint strings. */
export function signOf(value: unknown): -1 | 0 | 1 {
  const s = String(value ?? "").trim();
  if (!s || s === "0") return 0;
  if (s.startsWith("-")) return /[1-9]/.test(s) ? -1 : 0;
  return /[1-9]/.test(s) ? 1 : 0;
}

/** Relative time for an epoch-seconds value. */
export function timeAgo(value: unknown, now = Date.now()): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const diff = Math.max(0, Math.round(now / 1000 - n));
  if (diff < 45) return "just now";
  const units: [number, string][] = [
    [60, "s"],
    [3600, "m"],
    [86_400, "h"],
    [86_400 * 30, "d"],
  ];
  for (let i = 0; i < units.length; i++) {
    const [limit, unit] = units[i];
    if (diff < limit) {
      const base = i === 0 ? 1 : units[i - 1][0];
      return `${Math.floor(diff / base)}${unit} ago`;
    }
  }
  return `${Math.floor(diff / (86_400 * 30))}mo ago`;
}

/** Full absolute timestamp for titles/tooltips. */
export function absoluteTime(value: unknown): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return new Date(n * 1000).toUTCString();
}

/** Middle-ellipsis long identifiers: 0x1234…abcd. */
export function middleTruncate(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Divide a numeric-ish value by 10^scale, keeping bigint precision where possible. */
export function scaleNumber(value: unknown, scale?: number): number {
  if (!scale) return Number(value);
  try {
    const big = BigInt(String(value).split(".")[0] || "0");
    const base = 10n ** BigInt(scale);
    const whole = big / base;
    const frac = Number(big % base) / Number(base);
    return Number(whole) + frac;
  } catch {
    return Number(value) / 10 ** scale;
  }
}

/**
 * Delta between the last and first finite points of a series, as a percent.
 * Returns null when the series is too short or crosses zero meaninglessly.
 */
export function computeDeltaPct(points: number[]): number | null {
  const finite = points.filter((n) => Number.isFinite(n));
  if (finite.length < 2) return null;
  const first = finite[0];
  const last = finite[finite.length - 1];
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

/** Format a wei-style big integer (string/number/bigint) scaled by `decimals`,
 *  keeping up to `fractionDigits` (default 2) fractional digits, trailing zeros dropped. */
function formatBigintDecimals(value: unknown, decimals: number, fractionDigits = 2): string {
  let big: bigint;
  try {
    const asString = typeof value === "number" ? Math.trunc(value).toString() : String(value).trim();
    big = BigInt(asString.split(".")[0] || "0");
  } catch {
    return String(value);
  }

  const negative = big < 0n;
  if (negative) big = -big;

  const base = 10n ** BigInt(decimals);
  const whole = big / base;
  const remainder = big % base;

  const wholeStr = new Intl.NumberFormat("en-US").format(whole);

  const fracDigits = BigInt(Math.max(0, Math.min(fractionDigits, decimals)));
  const fracScaled = fracDigits > 0n ? (remainder * 10n ** fracDigits) / base : 0n;
  let out = wholeStr;
  if (fracScaled > 0n) {
    out += "." + fracScaled.toString().padStart(Number(fracDigits), "0").replace(/0+$/, "");
  }
  return (negative ? "-" : "") + out;
}

/** Format an x value per xFormat for axis ticks/tooltips. */
export function formatX(value: unknown, xFormat?: "epochDays" | "epochSeconds"): unknown {
  if (!xFormat) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const ms = xFormat === "epochDays" ? n * 86_400_000 : n * 1000;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** URL-safe slug for section anchors. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
