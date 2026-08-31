"use client";

// Header chip proving the data is alive: polls chain_metadata from the same
// GraphQL endpoint the widgets use and shows the latest synced slot. Renders
// nothing on failure - chrome never shows an error - and a "Sample data"
// chip in mock mode instead.

import { useEffect, useState } from "react";
import { getEndpoint, isMockMode, timeAgo } from "@/lib/data";
import { siteConfig } from "@/site.config";

type Row = { chain_id: number; latest_processed_block: number };

export function LiveStatus() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [seenAt, setSeenAt] = useState<number | null>(null);
  const mock = isMockMode();

  useEffect(() => {
    if (mock) return;
    const endpoint = getEndpoint();
    if (!endpoint) return;
    let cancelled = false;

    const run = () =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "query { chain_metadata { chain_id latest_processed_block } }",
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled && Array.isArray(j?.data?.chain_metadata) && j.data.chain_metadata.length) {
            setRows(j.data.chain_metadata as Row[]);
            setSeenAt(Date.now());
          }
        })
        .catch(() => {
          /* silent - a status chip must never surface an error */
        });

    run();
    const every = (siteConfig.refresh ?? 0) * 1000;
    const timer = every > 0 ? setInterval(run, every) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mock]);

  if (mock) return <span className="chip chip--muted">Sample data</span>;
  if (!rows) return null;

  const top = rows.reduce((a, b) => (b.latest_processed_block > a.latest_processed_block ? b : a));
  const unit = top.chain_id === 0 || top.chain_id === 7565164 ? "slot" : "block";
  const title = [
    ...rows.map((r) => `chain ${r.chain_id}: ${unit} ${r.latest_processed_block.toLocaleString("en-US")}`),
    seenAt ? `checked ${timeAgo(seenAt / 1000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span className="chip chip--live" title={title}>
      <span className="pulse" aria-hidden />
      {rows.length > 1 ? (
        <>Live · {rows.length} chains</>
      ) : (
        <>
          Live · {unit}{" "}
          <span className="num">{new Intl.NumberFormat("en-US").format(top.latest_processed_block)}</span>
        </>
      )}
    </span>
  );
}
