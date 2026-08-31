/*
 * M^0 on Solana — Earn (yield index), Portal (bridge), wM extension, ext swaps.
 * IDLs vendored in ./idls (earn + portal fetched on-chain 2026-08-06).
 *
 * envio >= 3.9: payload fields are selected per handler via `fields` (no
 * `field_selection` in config.yaml). Named accounts come from the IDL as
 * `instruction.accounts.<name>.address`; the CPI path is `instruction.path`;
 * SPL pre/post balances live on `instruction.transaction.accountActivities`.
 */
import { indexer, type ProtocolStats } from "envio";

const STATS_ID = "m0";
/**
 * $M mint on Solana mainnet. `receive_message` names it as its `m_mint` account,
 * which is preferred at runtime; this constant covers `send_message`, whose IDL
 * accounts don't include the mint. (Verified against live Portal instructions
 * 2026-08-31 — the previously hardcoded `mzeroky…pLJo` never matched, leaving
 * every mTokenDelta null.)
 */
const M_MINT = "mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH";

const emptyStats: ProtocolStats = {
  id: STATS_ID,
  indexUpdates: 0,
  latestIndex: 0n,
  bridgeIn: 0,
  bridgeOut: 0,
  netMBridged: 0n,
  wrapVolume: 0n,
  unwrapVolume: 0n,
  swapCount: 0,
  lastSlot: 0,
};

type StatsContext = {
  ProtocolStats: {
    get: (id: string) => Promise<ProtocolStats | undefined>;
    set: (e: ProtocolStats) => void;
  };
};

async function updateStats(
  context: StatsContext,
  slot: number,
  patch: (prev: ProtocolStats) => Partial<ProtocolStats>,
) {
  const prev = (await context.ProtocolStats.get(STATS_ID)) ?? emptyStats;
  context.ProtocolStats.set({ ...prev, ...patch(prev), lastSlot: Math.max(prev.lastSlot, slot) });
}

/** IDL u64/u128 args are decoded as decimal strings; accept bigint too. */
const asBig = (v: unknown): bigint =>
  typeof v === "bigint" ? v : BigInt(String(v ?? 0));

/** Deterministic per-instruction id: tx signature + CPI path. */
const ixId = (txSig: string, path: readonly number[]): string =>
  `${txSig}-${path.join(".")}`;

/** Common selection: decoded args/accounts, CPI path, tx signature, block time. */
const baseFields = {
  instruction: ["args", "accounts", "path"],
  transaction: ["signature"],
  block: ["time"],
} as const;

// ---- Earn: yield index propagation (rebase history) ----

indexer.onInstruction(
  { program: "Earn", instruction: "propagate_index", fields: baseFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    const index = asBig(instruction.args.index);
    context.IndexUpdate.set({
      id: ixId(txSig, instruction.path),
      slot: instruction.block.slot,
      time: instruction.block.time,
      index,
      indexFloat: Number(index) / 1e12,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      indexUpdates: prev.indexUpdates + 1,
      latestIndex: index > 0n ? index : asBig(prev.latestIndex),
    }));
  },
);

// ---- Portal: bridge messages; $M delta from pre/post token balances ----

/** Net $M minted/burned in the tx, summed over every $M token account it touched. */
function mDelta(
  activities: readonly {
    token:
      | { mint: string; preAmount: bigint | undefined; postAmount: bigint | undefined }
      | undefined;
  }[],
  mMint: string = M_MINT,
): bigint | undefined {
  let delta = 0n;
  let sawM = false;
  for (const a of activities) {
    if (a.token?.mint !== mMint) continue;
    sawM = true;
    delta += (a.token.postAmount ?? 0n) - (a.token.preAmount ?? 0n);
  }
  return sawM ? delta : undefined;
}

const portalFields = {
  ...baseFields,
  accountActivity: ["token.mint", "token.preAmount", "token.postAmount"],
} as const;

indexer.onInstruction(
  { program: "Portal", instruction: "send_message", fields: portalFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    const delta = mDelta(instruction.transaction.accountActivities);
    context.BridgeMessage.set({
      id: ixId(txSig, instruction.path),
      direction: "out",
      slot: instruction.block.slot,
      time: instruction.block.time,
      destinationChainId: instruction.args.m0_destination_chain_id,
      payloadType: instruction.args.payload_type,
      mTokenDelta: delta,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      bridgeOut: prev.bridgeOut + 1,
      netMBridged: asBig(prev.netMBridged) + (delta ?? 0n),
    }));
  },
);

indexer.onInstruction(
  { program: "Portal", instruction: "receive_message", fields: portalFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    const delta = mDelta(
      instruction.transaction.accountActivities,
      instruction.accounts.m_mint.address,
    );
    context.BridgeMessage.set({
      id: ixId(txSig, instruction.path),
      direction: "in",
      slot: instruction.block.slot,
      time: instruction.block.time,
      destinationChainId: undefined, // inbound: VAA body carries the source, not decoded here
      payloadType: undefined,
      mTokenDelta: delta,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      bridgeIn: prev.bridgeIn + 1,
      netMBridged: asBig(prev.netMBridged) + (delta ?? 0n),
    }));
  },
);

// ---- wM extension: wrap / unwrap / claims ----

for (const kind of ["wrap", "unwrap"] as const) {
  indexer.onInstruction(
    { program: "WMExt", instruction: kind, fields: baseFields },
    async ({ instruction, context }) => {
      const txSig = instruction.transaction.signature;
      const amount = asBig(instruction.args.amount);
      context.WMEvent.set({
        id: ixId(txSig, instruction.path),
        kind,
        amount,
        tokenAuthority: instruction.accounts.token_authority.address,
        slot: instruction.block.slot,
        time: instruction.block.time,
        txSignature: txSig,
      });
      await updateStats(context, instruction.block.slot, (prev) => ({
        wrapVolume: asBig(prev.wrapVolume) + (kind === "wrap" ? amount : 0n),
        unwrapVolume: asBig(prev.unwrapVolume) + (kind === "unwrap" ? amount : 0n),
      }));
    },
  );
}

indexer.onInstruction(
  { program: "WMExt", instruction: "claim_for", fields: baseFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    context.WMEvent.set({
      id: ixId(txSig, instruction.path),
      kind: "claim_for",
      amount: asBig(instruction.args.snapshot_balance),
      tokenAuthority: instruction.accounts.earn_authority.address,
      slot: instruction.block.slot,
      time: instruction.block.time,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, () => ({}));
  },
);

// ---- Extension swap program ----

indexer.onInstruction(
  { program: "ExtSwap", instruction: "swap", fields: baseFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    context.ExtSwapEvent.set({
      id: ixId(txSig, instruction.path),
      kind: "swap",
      amount: asBig(instruction.args.amount),
      fromMint: instruction.accounts.from_mint.address,
      toMint: instruction.accounts.to_mint.address,
      signer: instruction.accounts.signer.address,
      slot: instruction.block.slot,
      time: instruction.block.time,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      swapCount: prev.swapCount + 1,
    }));
  },
);

indexer.onInstruction(
  { program: "ExtSwap", instruction: "wrap", fields: baseFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    context.ExtSwapEvent.set({
      id: ixId(txSig, instruction.path),
      kind: "wrap",
      amount: asBig(instruction.args.amount),
      fromMint: instruction.accounts.m_mint.address,
      toMint: instruction.accounts.to_mint.address,
      signer: instruction.accounts.signer.address,
      slot: instruction.block.slot,
      time: instruction.block.time,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, () => ({}));
  },
);

indexer.onInstruction(
  { program: "ExtSwap", instruction: "unwrap", fields: baseFields },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signature;
    context.ExtSwapEvent.set({
      id: ixId(txSig, instruction.path),
      kind: "unwrap",
      amount: asBig(instruction.args.amount),
      fromMint: instruction.accounts.from_mint.address,
      toMint: instruction.accounts.m_mint.address,
      signer: instruction.accounts.signer.address,
      slot: instruction.block.slot,
      time: instruction.block.time,
      txSignature: txSig,
    });
    await updateStats(context, instruction.block.slot, () => ({}));
  },
);
