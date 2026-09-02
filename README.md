# FLARE — Production MVP Build

This is the next-stage FLARE build based on the existing animated prototype.

## Confirmed decisions

- Network: Robinhood Chain Testnet
- Chain ID: 46630
- Test ERC-20 included
- FLARE Factory / Executor / Vault contracts included
- Injected EVM wallet + WalletConnect via RainbowKit
- Vercel frontend preparation
- Render-style backend preparation
- PostgreSQL indexer state
- Holder-count monitoring
- One-time execution / cancellation / expiration protections

Robinhood Chain documents Testnet Chain ID 46630 and the public RPC at `https://rpc.testnet.chain.robinhood.com`. Public RPCs are rate-limited, so a production deployment should use an infrastructure provider rather than depending on the public endpoint.

## Remaining external secrets

These cannot be safely invented or committed:

1. `VITE_WALLETCONNECT_PROJECT_ID`
2. A deployer wallet private key, supplied only locally/server-side
3. `DATABASE_URL`
4. After deployment: contract addresses and deployment block
5. For automated execution: a dedicated keeper/executor private key, separate from creator wallets

## Important MVP security model

Creators do NOT give FLARE access to their personal wallet.

Automation funds are deposited into `FlareVault`. The executor can only release configured token amounts to the configured recipient. The keeper is responsible for detecting the condition and submitting the execution transaction.

## Run frontend

```bash
npm install
npm run dev:web
```

## Run API

```bash
cd apps/api
npm install
npm run dev
```

## Deploy contracts

See `contracts/README.md`.

## Frontend deployment

The included `deploy/vercel.json` prepares the monorepo for Vercel.

Recommended environment:

- `VITE_WALLETCONNECT_PROJECT_ID`

## Backend deployment

`deploy/render.yaml` is included as a starting point for a persistent Node worker/API. Railway/Fly.io/another persistent Node host can use the same commands.

## Next implementation pass

After deployment addresses exist, wire:

- Create FLARE transaction
- ERC-20 approval → Vault funding
- Factory create
- API reads / indexed FLARE state
- Triggered state
- Keeper `markTriggered`
- Keeper `execute`
- Transaction explorer links
- Detail page `/flare/:id`
- My FLAREs `/dashboard`
- Explore `/explore`
- Full 4-step `/create` builder

The current animated surface intentionally remains the visual foundation rather than being replaced with a generic dashboard.
