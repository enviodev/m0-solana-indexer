import { describe, it } from "vitest";
import { createTestIndexer } from "envio";

// Envio's chain id for Solana mainnet (`id: solana` in config.yaml).
const SOLANA = 7565164;
// Simulated instructions only run when their slot is inside the configured range.
const START_SLOT = 403_000_000;

const M_MINT = "mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH";
const WM_MINT = "mzeroXDoBpRVhnEXBra27qzAMdxgpWVY3DzQW7xMVJp";
const USER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const VAULT_ATA = "6EEwsUpHqvbXNvSVBGxBhCiTdvGDMg2XSMzsFRQu3S9j";
const USER_ATA = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
const SIG_A =
  "5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7";
const SIG_B =
  "2Zy1r8m7Q3pT6vK9nX4cL1sB5dF8gH2jK4mN6pQ8rS1tU3vW5xY7zA9bC1dE3fG5hJ7kL9mN1pQ3rS5tU7vW9xY";

describe("M^0 Solana handlers", () => {
  it("records a yield-index propagation and tracks the latest index", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [SOLANA]: {
          simulate: [
            {
              program: "Earn",
              instruction: "propagate_index",
              slot: START_SLOT,
              path: [0],
              args: { index: "1050000000000", earner_merkle_root: "0x00" },
              transaction: { signature: SIG_A },
              block: { time: 1_700_000_000 },
            },
          ],
        },
      },
    });

    t.expect(await indexer.IndexUpdate.getOrThrow(`${SIG_A}-0`)).toEqual({
      id: `${SIG_A}-0`,
      slot: START_SLOT,
      time: 1_700_000_000,
      index: 1_050_000_000_000n,
      indexFloat: 1.05,
      txSignature: SIG_A,
    });
    t.expect(await indexer.ProtocolStats.getOrThrow("m0")).toMatchObject({
      indexUpdates: 1,
      latestIndex: 1_050_000_000_000n,
      lastSlot: START_SLOT,
    });
  });

  it("derives the net $M delta of bridge messages from token balance changes", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [SOLANA]: {
          simulate: [
            {
              // Inbound: $M minted to the user (+1_000_000).
              program: "Portal",
              instruction: "receive_message",
              slot: START_SLOT,
              path: [1],
              args: { guardian_set_index: 4, vaa_body: "0x" },
              accounts: { m_mint: { address: M_MINT } },
              transaction: {
                signature: SIG_A,
                accountActivities: [
                  {
                    address: USER_ATA,
                    token: { mint: M_MINT, owner: USER, decimals: 6, preAmount: 0n, postAmount: 1_000_000n },
                  },
                  {
                    // Unrelated mint must be ignored.
                    address: VAULT_ATA,
                    token: { mint: WM_MINT, owner: USER, decimals: 6, preAmount: 5n, postAmount: 0n },
                  },
                ],
              },
            },
            {
              // Outbound: $M burned from the user (-400_000).
              program: "Portal",
              instruction: "send_message",
              slot: START_SLOT + 1,
              path: [0],
              args: { m0_destination_chain_id: 1, message_id: "0x01", payload: "0x", payload_type: 0 },
              transaction: {
                signature: SIG_B,
                accountActivities: [
                  {
                    address: USER_ATA,
                    token: { mint: M_MINT, owner: USER, decimals: 6, preAmount: 1_000_000n, postAmount: 600_000n },
                  },
                ],
              },
            },
          ],
        },
      },
    });

    t.expect(await indexer.BridgeMessage.getOrThrow(`${SIG_A}-1`)).toMatchObject({
      direction: "in",
      slot: START_SLOT,
      destinationChainId: undefined,
      payloadType: undefined,
      mTokenDelta: 1_000_000n,
      txSignature: SIG_A,
    });
    t.expect(await indexer.BridgeMessage.getOrThrow(`${SIG_B}-0`)).toMatchObject({
      direction: "out",
      slot: START_SLOT + 1,
      destinationChainId: 1,
      payloadType: 0,
      mTokenDelta: -400_000n,
      txSignature: SIG_B,
    });
    t.expect(await indexer.ProtocolStats.getOrThrow("m0")).toMatchObject({
      bridgeIn: 1,
      bridgeOut: 1,
      netMBridged: 600_000n,
      lastSlot: START_SLOT + 1,
    });
  });

  it("leaves mTokenDelta unset when the tx touched no $M account", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [SOLANA]: {
          simulate: [
            {
              program: "Portal",
              instruction: "send_message",
              slot: START_SLOT,
              args: { m0_destination_chain_id: 1, message_id: "0x01", payload: "0x", payload_type: 1 },
              transaction: { signature: SIG_A, accountActivities: [] },
            },
          ],
        },
      },
    });

    t.expect(await indexer.BridgeMessage.getOrThrow(`${SIG_A}-0`)).toMatchObject({
      direction: "out",
      payloadType: 1,
      mTokenDelta: undefined,
    });
    t.expect(await indexer.ProtocolStats.getOrThrow("m0")).toMatchObject({
      bridgeOut: 1,
      netMBridged: 0n,
    });
  });

  it("accumulates wM wrap/unwrap volume and records claims", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [SOLANA]: {
          simulate: [
            {
              program: "WMExt",
              instruction: "wrap",
              slot: START_SLOT,
              args: { amount: "300" },
              accounts: { token_authority: { address: USER } },
              transaction: { signature: SIG_A },
            },
            {
              program: "WMExt",
              instruction: "unwrap",
              slot: START_SLOT + 1,
              args: { amount: "100" },
              accounts: { token_authority: { address: USER } },
              transaction: { signature: SIG_B },
            },
            {
              program: "WMExt",
              instruction: "claim_for",
              slot: START_SLOT + 2,
              path: [2, 0],
              args: { snapshot_balance: "42" },
              accounts: { earn_authority: { address: USER } },
              transaction: { signature: SIG_B },
            },
          ],
        },
      },
    });

    t.expect(await indexer.WMEvent.getOrThrow(`${SIG_A}-0`)).toMatchObject({
      kind: "wrap",
      amount: 300n,
      tokenAuthority: USER,
    });
    t.expect(await indexer.WMEvent.getOrThrow(`${SIG_B}-2.0`)).toMatchObject({
      kind: "claim_for",
      amount: 42n,
      tokenAuthority: USER,
      slot: START_SLOT + 2,
    });
    t.expect(await indexer.ProtocolStats.getOrThrow("m0")).toMatchObject({
      wrapVolume: 300n,
      unwrapVolume: 100n,
      lastSlot: START_SLOT + 2,
    });
  });

  it("records extension swaps with from/to mints and counts only swaps", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [SOLANA]: {
          simulate: [
            {
              program: "ExtSwap",
              instruction: "swap",
              slot: START_SLOT,
              args: { amount: "7", remaining_accounts_split_idx: 0 },
              accounts: {
                signer: { address: USER },
                from_mint: { address: WM_MINT },
                to_mint: { address: M_MINT },
              },
              transaction: { signature: SIG_A },
            },
            {
              program: "ExtSwap",
              instruction: "wrap",
              slot: START_SLOT + 1,
              args: { amount: "8" },
              accounts: {
                signer: { address: USER },
                m_mint: { address: M_MINT },
                to_mint: { address: WM_MINT },
              },
              transaction: { signature: SIG_B },
            },
          ],
        },
      },
    });

    t.expect(await indexer.ExtSwapEvent.getOrThrow(`${SIG_A}-0`)).toMatchObject({
      kind: "swap",
      amount: 7n,
      fromMint: WM_MINT,
      toMint: M_MINT,
      signer: USER,
    });
    t.expect(await indexer.ExtSwapEvent.getOrThrow(`${SIG_B}-0`)).toMatchObject({
      kind: "wrap",
      amount: 8n,
      fromMint: M_MINT,
      toMint: WM_MINT,
    });
    t.expect(await indexer.ProtocolStats.getOrThrow("m0")).toMatchObject({
      swapCount: 1,
      lastSlot: START_SLOT + 1,
    });
  });
});
