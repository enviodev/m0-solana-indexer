/*
 * M^0 on Solana — Earn (yield index), Portal (bridge), wM extension, ext swaps.
 * IDLs vendored in ./idls (earn + portal fetched on-chain 2026-08-06).
 */
import { indexer, type ProtocolStats } from "envio";

const STATS_ID = "m0";
const M_MINT = "mzerokyEX9TNDoK4o2YZQBDmMzjokAeN6M2g2S3pLJo";

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


const asBig = (v: unknown): bigint =>
  typeof v === "bigint" ? v : BigInt(String(v ?? 0));

function ixId(txSig: string | undefined, address: readonly number[]): string {
  return `${txSig ?? "unknown"}-${address.join(".")}`;
}

// ---- Earn: yield index propagation (rebase history) ----

indexer.onInstruction(
  { program: "Earn", instruction: "propagate_index" },
  async ({ instruction, context }) => {
    const txSig = instruction.transaction.signatures?.[0];
    const args = instruction.params?.args as { index?: bigint } | undefined;
    const index = asBig(args?.index ?? 0n);
    context.IndexUpdate.set({
      id: ixId(txSig, instruction.instructionAddress),
      slot: instruction.block.slot,
      time: instruction.block.time,
      index,
      indexFloat: Number(index) / 1e12,
      txSignature: txSig ?? "",
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      indexUpdates: prev.indexUpdates + 1,
      latestIndex: index > 0n ? index : asBig(prev.latestIndex),
    }));
  },
);

// ---- Portal: bridge messages; $M delta from pre/post token balances ----

function mDelta(
  tokenBalances:
    | readonly { mint?: string; preAmount?: string; postAmount?: string }[]
    | undefined,
): bigint | undefined {
  if (!tokenBalances) return undefined;
  let delta = 0n;
  let sawM = false;
  for (const tb of tokenBalances) {
    if (tb.mint !== M_MINT) continue;
    sawM = true;
    delta += BigInt(tb.postAmount ?? "0") - BigInt(tb.preAmount ?? "0");
  }
  return sawM ? delta : undefined;
}

for (const [instructionName, direction] of [
  ["receive_message", "in"],
  ["send_message", "out"],
] as const) {
  indexer.onInstruction(
    { program: "Portal", instruction: instructionName },
    async ({ instruction, context }) => {
      const txSig = instruction.transaction.signatures?.[0];
      const args = instruction.params?.args as
        | { m0_destination_chain_id?: number; payload_type?: number }
        | undefined;
      const delta = mDelta(
        (instruction.transaction as unknown as {
          tokenBalances?: readonly { mint?: string; preAmount?: string; postAmount?: string }[];
        }).tokenBalances,
      );
      context.BridgeMessage.set({
        id: ixId(txSig, instruction.instructionAddress),
        direction,
        slot: instruction.block.slot,
        time: instruction.block.time,
        destinationChainId: args?.m0_destination_chain_id,
        payloadType: args?.payload_type,
        mTokenDelta: delta,
        txSignature: txSig ?? "",
      });
      await updateStats(context, instruction.block.slot, (prev) => ({
        bridgeIn: prev.bridgeIn + (direction === "in" ? 1 : 0),
        bridgeOut: prev.bridgeOut + (direction === "out" ? 1 : 0),
        netMBridged: asBig(prev.netMBridged) + (delta ?? 0n),
      }));
    },
  );
}

// ---- wM extension: wrap / unwrap / claims ----

for (const kind of ["wrap", "unwrap", "claim_for"] as const) {
  indexer.onInstruction({ program: "WMExt", instruction: kind }, async ({ instruction, context }) => {
    const txSig = instruction.transaction.signatures?.[0];
    const args = instruction.params?.args as
      | { amount?: bigint; snapshot_balance?: bigint }
      | undefined;
    const amount = asBig(args?.amount ?? args?.snapshot_balance ?? 0n);
    const accounts: Readonly<Record<string, string>> = instruction.params?.accounts ?? {};
    context.WMEvent.set({
      id: ixId(txSig, instruction.instructionAddress),
      kind,
      amount,
      tokenAuthority: accounts["token_authority"] ?? accounts["earn_authority"],
      slot: instruction.block.slot,
      time: instruction.block.time,
      txSignature: txSig ?? "",
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      wrapVolume: asBig(prev.wrapVolume) + (kind === "wrap" ? asBig(amount) : 0n),
      unwrapVolume: asBig(prev.unwrapVolume) + (kind === "unwrap" ? asBig(amount) : 0n),
    }));
  });
}

// ---- Extension swap program ----

for (const kind of ["swap", "wrap", "unwrap"] as const) {
  indexer.onInstruction({ program: "ExtSwap", instruction: kind }, async ({ instruction, context }) => {
    const txSig = instruction.transaction.signatures?.[0];
    const args = instruction.params?.args as { amount?: bigint } | undefined;
    const accounts: Readonly<Record<string, string>> = instruction.params?.accounts ?? {};
    context.ExtSwapEvent.set({
      id: ixId(txSig, instruction.instructionAddress),
      kind,
      amount: asBig(args?.amount ?? 0n),
      fromMint: accounts["from_mint"] ?? accounts["m_mint"],
      toMint: accounts["to_mint"],
      signer: accounts["signer"],
      slot: instruction.block.slot,
      time: instruction.block.time,
      txSignature: txSig ?? "",
    });
    await updateStats(context, instruction.block.slot, (prev) => ({
      swapCount: prev.swapCount + (kind === "swap" ? 1 : 0),
    }));
  });
}
