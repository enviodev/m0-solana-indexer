# M^0 Solana indexer

A HyperIndex indexer for [M^0](https://m0.org) on Solana mainnet, streamed via
HyperSync. It tracks:

- **Earn** `propagate_index` — yield-index propagation from Ethereum (`IndexUpdate`,
  the $M rebase history).
- **Portal** `send_message` / `receive_message` — Wormhole bridge messages in and out,
  with the net $M minted/burned per transaction derived from SPL pre/post balances
  (`BridgeMessage`).
- **wM extension** `wrap` / `unwrap` / `claim_for` — wM wrap/unwrap volume and yield
  claims (`WMEvent`).
- **Extension swap** `swap` / `wrap` / `unwrap` — swaps between $M extensions
  (`ExtSwapEvent`).
- `ProtocolStats` — running aggregates for the dashboard headline row.

`demo-ui/` is a Next.js dashboard that reads from the hosted GraphQL endpoint.

## Requirements

- Node 22+, pnpm 10+
- Docker (for the local Postgres + Hasura stack)
- An Envio API token in `.env` (`ENVIO_API_TOKEN`, see `.env.example`;
  create one at https://envio.dev/app/api-tokens)

## Quick start

```bash
pnpm install
pnpm codegen           # regenerate the typed `envio` module after config/schema edits
pnpm test              # simulate-based handler tests, no network needed
pnpm dev               # Postgres + Hasura + indexer; GraphQL at http://localhost:8080
```

`start_block` in `config.yaml` is a **slot** number. HyperSync serves roughly the
last six months of Solana history and the floor moves forward, so check the head
with `curl -s https://solana.hypersync.xyz/height` before lowering it.

Query the playground at `http://localhost:8080` (admin secret `testing`):

```graphql
{
  ProtocolStats { indexUpdates latestIndex bridgeIn bridgeOut netMBridged wrapVolume unwrapVolume swapCount lastSlot }
  IndexUpdate(limit: 5, order_by: {slot: desc}) { slot time indexFloat txSignature }
  BridgeMessage(limit: 5, order_by: {slot: desc}) { direction mTokenDelta destinationChainId txSignature }
}
```

## Layout

- `config.yaml` — `ecosystem: svm`, one `solana` chain, four programs with their
  instruction discriminators. IDLs are vendored in `idls/`.
- `schema.graphql` — entities above.
- `src/handlers/M0Handlers.ts` — `indexer.onInstruction` handlers. Each registration
  selects the payload it needs via `fields` (args/accounts/path, tx signature, block
  time, and SPL token activity for the Portal handlers).
- `src/indexer.test.ts` — Vitest + `createTestIndexer()` with simulated instructions.

## Envio version notes

Built against `envio@3.9.0`. Compared with the `3.5.1-svm-alpha` line this project
originally targeted:

- `chains[].id: solana` is required (Envio chain id `7565164`); the HyperSync
  endpoint defaults from it, so `hypersync_config` is optional.
- Per-instruction `field_selection` in `config.yaml` is gone; select fields on the
  handler registration (`fields: { instruction, transaction, accountActivity, block, log }`).
- `instruction.params.{args,accounts}` → `instruction.args` and
  `instruction.accounts.<name>.address`; `instructionAddress` → `instruction.path`;
  `transaction.signatures[0]` → `transaction.signature`;
  `transaction.tokenBalances` → `transaction.accountActivities[].token`.
