"use client";

// The interactive body of every card: fetches its data client-side (or reads
// mock data), handles loading / error / empty states, and renders the right
// view for the widget kind. The card shell + title live in the server page.
//
// Mark discipline (do not "improve" these away):
//   lines 2px round · area washes ≤12% opacity · bars ≤24px with 4px rounded
//   data-ends and square baselines · solid hairline gridlines, never dashed ·
//   values/labels wear ink tokens, never the series color · a legend appears
//   iff there are ≥2 series.

import { useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { siteConfig } from "@/site.config";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeDeltaPct,
  formatX,
  firstScalar,
  formatValue,
  getByPath,
  getEndpoint,
  isMockMode,
  middleTruncate,
  toArray,
} from "@/lib/data";
import type {
  BarsWidget,
  Format,
  Series,
  StatWidget,
  TableWidget,
  TimeseriesWidget,
  Widget,
} from "@/lib/types";

/** Fixed categorical slots after the accent (validated light+dark). */
const SERIES_COLORS = ["var(--accent)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: unknown };

function useWidgetData(widget: Widget): DataState {
  const mock = isMockMode();
  const [state, setState] = useState<DataState>(() =>
    mock ? { status: "success", data: widget.sample ?? null } : { status: "loading" },
  );

  useEffect(() => {
    if (mock) return;
    const endpoint = getEndpoint();
    if (!endpoint) {
      setState({ status: "success", data: widget.sample ?? null });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    const run = () =>
      fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: widget.query }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
        const json = await res.json();
        if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "GraphQL error");
        return json.data;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });

    run();
    const every = (widget.refreshSeconds ?? siteConfig.refresh ?? 0) * 1000;
    const timer = every > 0 ? setInterval(run, every) : undefined;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [widget, mock]);

  return state;
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function WidgetBody({ widget }: { widget: Widget }) {
  const state = useWidgetData(widget);

  if (state.status === "loading") return <Skeleton kind={widget.kind} />;
  if (state.status === "error") return <Notice tone="error">{state.message}</Notice>;

  switch (widget.kind) {
    case "stat":
      return <StatView widget={widget} data={state.data} />;
    case "timeseries":
      return <TimeseriesView widget={widget} data={state.data} />;
    case "bars":
      return <BarsView widget={widget} data={state.data} />;
    case "table":
      return <TableView widget={widget} data={state.data} />;
  }
}

/* ---------------------------------------------------------------- stat --- */

function StatView({ widget, data }: { widget: StatWidget; data: unknown }) {
  const raw = firstScalar(getByPath(data, widget.path));
  const sparkPoints = useMemo(() => {
    if (!widget.spark) return null;
    return toArray(getByPath(data, widget.spark.yPath)).map((v) => Number(v));
  }, [data, widget.spark]);

  if (raw === null || raw === undefined) return <Notice tone="empty">No data yet</Notice>;

  const deltaPct =
    sparkPoints && !widget.hideDelta ? computeDeltaPct(sparkPoints) : null;
  const goodWhenUp = (widget.deltaGoodWhen ?? "up") === "up";
  const deltaTone =
    deltaPct === null || deltaPct === 0
      ? "flat"
      : (deltaPct > 0) === goodWhenUp
        ? "good"
        : "bad";

  return (
    <div className="stat">
      <div className="stat-row">
        <span className="stat-value"><AnimatedNumber value={raw} format={widget.format} decimals={widget.decimals} /></span>
        {deltaPct !== null ? (
          <span className={`delta delta--${deltaTone}`}>
            {deltaPct > 0 ? "▲" : deltaPct < 0 ? "▼" : "—"}{" "}
            {Math.abs(deltaPct).toFixed(Math.abs(deltaPct) < 10 ? 1 : 0)}%
          </span>
        ) : null}
      </div>
      {sparkPoints && sparkPoints.length > 1 ? <Sparkline points={sparkPoints} /> : null}
      {widget.caption ? <p className="stat-caption">{widget.caption}</p> : null}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const mounted = useMounted();
  if (!mounted) return <div className="spark spark--pending" />;
  const data = points.map((y, i) => ({ i, y }));
  return (
    <div className="spark">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke="var(--accent)"
            strokeWidth={1.5}
            fill="url(#spark-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------- timeseries --- */

function normalizeSeries(widget: TimeseriesWidget): Series[] {
  if (widget.series?.length) return widget.series.slice(0, 4);
  if (widget.yPath) return [{ yPath: widget.yPath, label: widget.yLabel }];
  return [];
}

function TimeseriesView({ widget, data }: { widget: TimeseriesWidget; data: unknown }) {
  const mounted = useMounted();
  const seriesDefs = useMemo(() => normalizeSeries(widget), [widget]);

  const points = useMemo(() => {
    const xs = toArray(getByPath(data, widget.xPath));
    const ys = seriesDefs.map((s) => toArray(getByPath(data, s.yPath)));
    const n = Math.min(xs.length, ...ys.map((y) => y.length));
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < n; i++) {
      const row: Record<string, unknown> = { x: formatX(xs[i], widget.xFormat) };
      seriesDefs.forEach((_, si) => (row[`y${si}`] = Number(ys[si][i])));
      out.push(row);
    }
    if (widget.reverse) out.reverse();
    return out;
  }, [data, widget.xPath, widget.xFormat, widget.reverse, seriesDefs]);

  if (seriesDefs.length === 0 || points.length === 0)
    return <Notice tone="empty">No data points</Notice>;
  if (!mounted) return <div className="chart chart--pending" />;

  const area = (widget.variant ?? "area") === "area";
  const Chart = area ? AreaChart : LineChart;

  return (
    <>
      {seriesDefs.length >= 2 ? (
        <div className="legend">
          {seriesDefs.map((s, i) => (
            <span key={i} className="legend-item">
              <span className="legend-mark" style={{ background: SERIES_COLORS[i] }} />
              {s.label ?? `Series ${i + 1}`}
            </span>
          ))}
        </div>
      ) : null}
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {area ? (
              <defs>
                {seriesDefs.map((_, i) => (
                  <linearGradient key={i} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_COLORS[i]} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={SERIES_COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
            ) : null}
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              minTickGap={32}
            />
            <YAxis
              width={52}
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                widget.format === "percent"
                  ? formatValue(v, "percent")
                  : Math.abs(Number(v)) < 10 && Number(v) % 1 !== 0
                    ? Number(v).toFixed(4)
                    : formatValue(v, "compact")
              }
              domain={area ? [0, "auto"] : ["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
              content={
                <ChartTooltip
                  format={widget.format}
                  decimals={widget.decimals}
                  labels={seriesDefs.map((s, i) => s.label ?? (seriesDefs.length > 1 ? `Series ${i + 1}` : widget.yLabel ?? ""))}
                />
              }
            />
            {seriesDefs.map((_, i) =>
              area ? (
                <Area
                  key={i}
                  type="monotone"
                  dataKey={`y${i}`}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill={`url(#fill-${i})`}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                />
              ) : (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`y${i}`}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function ChartTooltip(props: {
  active?: boolean;
  payload?: { value: number; dataKey?: string; color?: string }[];
  label?: unknown;
  format?: Format;
  decimals?: number;
  labels: string[];
}) {
  const { active, payload, label, format, decimals, labels } = props;
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="tooltip-x">{String(label)}</div>
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          {payload.length > 1 ? (
            <span className="legend-mark" style={{ background: p.color }} />
          ) : null}
          {labels[i] ? <span className="tooltip-label">{labels[i]}</span> : null}
          <span className="tooltip-y">{formatValue(p.value, format, decimals)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- bars --- */

function BarsView({ widget, data }: { widget: BarsWidget; data: unknown }) {
  const mounted = useMounted();
  const points = useMemo(() => {
    const xs = toArray(getByPath(data, widget.xPath));
    const ys = toArray(getByPath(data, widget.yPath));
    const n = Math.min(xs.length, ys.length);
    const out: { x: unknown; y: number }[] = [];
    for (let i = 0; i < n; i++) out.push({ x: formatX(xs[i], widget.xFormat), y: Number(ys[i]) });
    if (widget.reverse) out.reverse();
    return out;
  }, [data, widget.xPath, widget.yPath, widget.xFormat, widget.reverse]);

  if (points.length === 0) return <Notice tone="empty">No data points</Notice>;
  if (!mounted) return <div className="chart chart--pending" />;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--baseline)" }}
            minTickGap={32}
          />
          <YAxis
            width={52}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(v, "compact")}
          />
          <Tooltip
            cursor={{ fill: "var(--grid)", opacity: 0.5 }}
            content={<ChartTooltip format={widget.format} decimals={widget.decimals} labels={[widget.yLabel ?? ""]} />}
          />
          <Bar dataKey="y" fill="var(--accent)" maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- table --- */

function TableView({ widget, data }: { widget: TableWidget; data: unknown }) {
  const rows = useMemo(() => {
    const cols = widget.columns.map((c) => toArray(getByPath(data, c.path)));
    const length = cols.reduce((max, c) => Math.max(max, c.length), 0);
    const limit = widget.limit ?? length;
    const out: unknown[][] = [];
    for (let i = 0; i < Math.min(length, limit); i++) out.push(cols.map((c) => c[i]));
    return out;
  }, [data, widget]);

  if (rows.length === 0) return <Notice tone="empty">No rows</Notice>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {widget.columns.map((c, i) => (
              <th key={i} className={c.align === "right" ? "num" : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const col = widget.columns[ci];
                const rawStr = cell == null ? "" : String(cell);
                const display =
                  col.truncate === "middle"
                    ? middleTruncate(rawStr)
                    : formatValue(cell, col.format, col.decimals);
                const content = col.linkTemplate && rawStr ? (
                  <a
                    href={col.linkTemplate.replaceAll("{value}", rawStr)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {display}
                  </a>
                ) : (
                  display
                );
                return (
                  <td
                    key={ci}
                    title={rawStr || undefined}
                    className={[
                      col.align === "right" ? "num" : "",
                      col.truncate === "middle" ? "mono" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------ states & chrome --- */

function Skeleton({ kind }: { kind: Widget["kind"] }) {
  if (kind === "stat") {
    return (
      <div className="stat">
        <div className="sk sk-value" />
        <div className="sk sk-line" />
      </div>
    );
  }
  return <div className={`sk ${kind === "table" ? "sk-table" : "sk-chart"}`} />;
}

function Notice({ tone, children }: { tone: "error" | "empty"; children: React.ReactNode }) {
  return <div className={`notice notice--${tone}`}>{children}</div>;
}
