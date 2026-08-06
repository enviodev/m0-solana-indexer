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
export function formatValue(value: unknown, format?: Format, decimals?: number): string {
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
      return formatBigintDecimals(value, decimals ?? 18);
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
    default:
      return String(value);
  }
}

/** Middle-ellipsis long identifiers: 0x1234…abcd. */
export function middleTruncate(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
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

/** Format a wei-style big integer (string/number/bigint) scaled by `decimals`. */
function formatBigintDecimals(value: unknown, decimals: number): string {
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

  // Keep two fractional digits, dropping trailing zeros.
  const fracDigits = 2n;
  const fracScaled = (remainder * 10n ** fracDigits) / base;
  let out = wholeStr;
  if (fracScaled > 0n) {
    out += "." + fracScaled.toString().padStart(2, "0").replace(/0+$/, "");
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
