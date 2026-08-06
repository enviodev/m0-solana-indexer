"use client";

// Header chip proving the data is alive: reads chain_metadata from the same
// GraphQL endpoint the widgets use and shows the latest synced block. Renders
// nothing on failure — chrome never shows an error — and shows a "Sample data"
// chip in mock mode instead.

import { useEffect, useState } from "react";
import { getEndpoint, isMockMode } from "@/lib/data";

type Row = { chain_id: number; latest_processed_block: number };

export function LiveStatus() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const mock = isMockMode();

  useEffect(() => {
    if (mock) return;
    const endpoint = getEndpoint();
    if (!endpoint) return;
    let cancelled = false;
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
        }
      })
      .catch(() => {
        /* silent — a status chip must never surface an error */
      });
    return () => {
      cancelled = true;
    };
  }, [mock]);

  if (mock) return <span className="chip chip--muted">Sample data</span>;
  if (!rows) return null;

  const top = rows.reduce((a, b) => (b.latest_processed_block > a.latest_processed_block ? b : a));
  const label =
    rows.length > 1
      ? `Live · ${rows.length} chains synced`
      : `Live · block ${new Intl.NumberFormat("en-US").format(top.latest_processed_block)}`;

  return (
    <span className="chip chip--live" title={rows.map((r) => `chain ${r.chain_id}: ${r.latest_processed_block}`).join("\n")}>
      <span className="pulse" aria-hidden />
      {label}
    </span>
  );
}
