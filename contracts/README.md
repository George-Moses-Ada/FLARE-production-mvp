# FLARE contracts

Solidity contracts for the Robinhood Chain Testnet MVP.

Architecture:
Factory → Executor → Vault → ERC-20

Install OpenZeppelin and forge-std with Foundry:

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

Compile:

```bash
forge build
```

Deploy:

```bash
export PRIVATE_KEY=0x...
export RH_RPC_URL=https://rpc.testnet.chain.robinhood.com
forge script script/Deploy.s.sol:Deploy --rpc-url $RH_RPC_URL --broadcast
```

Never commit `PRIVATE_KEY`.
