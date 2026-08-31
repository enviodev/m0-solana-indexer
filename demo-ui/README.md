# M0 on Solana — analytics dashboard

A config-driven Next.js dashboard that renders live data from the M0 Solana
[Envio HyperIndex](https://docs.envio.dev) GraphQL API (`../`). Point it at an
endpoint, declare sections and widgets, deploy. It also runs entirely on
built-in sample data, so it demos itself with no backend.

## The one file you edit: `site.config.ts`

Everything the demo shows comes from `site.config.ts`. Nothing else needs to be
touched. Set the header text and accent color, point `endpoint` at your
deployed GraphQL URL, and list 3–4 widgets.

```ts
export const siteConfig: DemoConfig = {
  protocolName: "Lido",
  title: "Liquid staking, indexed in real time",
  subtitle: "…",
  accentColor: "#00a3ff",   // drives chart, stat values, links, badges
  endpoint: "https://indexer.hyperindex.xyz/<id>/v1/graphql",
  widgets: [ /* … */ ],
  footerLinks: [ /* … */ ],
};
```

### Widgets

Every widget has a `title`, a GraphQL `query`, and an optional `sample`
(a mock response `data` object used offline). A `path` is a dot-path into the
response `data`; when it crosses an array it maps over every element, so
`"WithdrawalRequest.amount"` against `{ WithdrawalRequest: [{amount}, …] }`
resolves to the list of amounts.

| kind         | span | key fields |
| ------------ | ---- | ---------- |
| `stat`       | 1 col | `path`, `format?`, `decimals?`, `caption?` |
| `timeseries` | 2 col | `xPath`, `yPath`, `yLabel?`, `format?` (area chart) |
| `table`      | 2 col | `columns: {header, path, format?, decimals?}[]`, `limit?` |

`format` is one of `"number"`, `"usd"`, or `"bigintDecimals"` (scales a
wei-style integer by `decimals`, default 18). Missing values render as `—`.

## Mock mode

If `NEXT_PUBLIC_MOCK=1` **or** the resolved endpoint is empty, every widget
renders from its `sample` data instead of hitting the network. The shipped
config leaves `endpoint` empty, so `pnpm dev` works out of the box and the
production build succeeds with no backend. Keep each widget's `sample` in sync
with its query's shape.

## Environment variables

| var | purpose |
| --- | --- |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | Overrides `endpoint` at runtime (wins over config). |
| `NEXT_PUBLIC_MOCK` | Set to `1` to force sample data. |

Copy `.env.example` to `.env.local` to set them locally. All data fetching is
client-side, so these are inlined at build time.

## Develop & build

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # production build (no network needed)
pnpm typecheck      # tsc --noEmit
```

Requires Node 22+.

## Test queries first

Before wiring a query into a widget, confirm it works against the endpoint:

```bash
curl -s "$NEXT_PUBLIC_GRAPHQL_ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ TotalReward(limit: 1) { apr } }"}' | jq
```

Match each widget's `path` (and `sample` shape) to the `data` object you see.

## Deploy

```bash
vercel deploy --prod
```

Set `NEXT_PUBLIC_GRAPHQL_ENDPOINT` in the Vercel project (or bake it into
`site.config.ts`) so production talks to the live indexer instead of sample data.

## v3 config surface (August 2026 redesign)

- `sections[]` — titled groups (`eyebrow`, `title`, `description`, `widgets`) each on
  its own 12-column grid; `widgets` at the root is still honored as a single group
- `eyebrow`, `protocolTag`, `facts[]` — hero copy: label/value pairs under the subtitle
- Stat: `unit` suffix, `meta` (secondary fact line, e.g. last propagated · 12m ago),
  `format: "signedDecimals"` tints positive/negative
- Table column formats: `badge` (with `badges: { raw: { label, tone } }`),
  `signedDecimals`, `timeAgo` (absolute time on hover), `datetime`; `unit`; `width: "grow"`
- Charts: `scale` divides y by 10^n (base units → tokens); timeseries `height: "lg"`
- Typography: Inter + JetBrains Mono via `next/font` (self-hosted at build)
- `app/opengraph-image.tsx` renders the social card from the config

## v2 config surface (July 2026 redesign)

Everything remains config-driven via `site.config.ts`; new optional powers:

- `theme` — `accent` + `accentDark` (brand pair), `radius` ("sm"|"md"|"lg"), `halo` (hero wash)
- `hero` — a dominant stat beside the title (spark + auto delta chip supported)
- `chains` — header chips; `liveStatus` — live "synced to block N" chip from chain_metadata
- Widget kinds: `stat` (now with `spark` + delta), `timeseries` (multi-`series`, `variant`
  "area"|"line" — use "line" + fitted domain for comparisons), `bars`, `table` (column
  `align`, `truncate: "middle"`, `linkTemplate`)
- Per-widget `span` (4|6|8|12) on a 12-column grid for layout control

Design guardrails are annotated in `components/WidgetBody.tsx` — don't strip them.
