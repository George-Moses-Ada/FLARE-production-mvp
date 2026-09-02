# FLARE On-Chain MVP Deployment Guide

## Overview
This guide explains how to deploy the FLARE smart contracts and configure the web application to create a functioning on-chain MVP.

## Prerequisites
- Node.js and npm installed
- Foundry installed for smart contract deployment
- Wallet with testnet ETH on Robinhood Chain Testnet
- WalletConnect Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)

## Smart Contract Deployment

### 1. Deploy Smart Contracts

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account <your_account> --broadcast
```

This will deploy:
- `FlareToken.sol` - Test ERC20 token
- `FlareVault.sol` - Secure vault for automation funds
- `FlareExecutor.sol` - Core execution logic
- `FlareFactory.sol` - Factory for creating FLARE instances

### 2. Record Contract Addresses

After deployment, you'll get addresses like:
```
FlareToken: 0x1234...5678
FlareVault: 0xabcd...ef01
FlareExecutor: 0x9876...5432
FlareFactory: 0xfedc...ba98
```

## Web Application Configuration

### 1. Set Up Environment Variables

Create `apps/web/.env` file:

```bash
# WalletConnect Project ID
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here

# Contract Addresses (from deployment)
VITE_FACTORY_ADDRESS=0xfedc...ba98
VITE_EXECUTOR_ADDRESS=0x9876...5432
VITE_VAULT_ADDRESS=0xabcd...ef01
VITE_TOKEN_ADDRESS=0x1234...5678
```

### 2. Install Dependencies

```bash
cd apps/web
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

## Complete User Flow

### 1. Connect Wallet
- User connects wallet to Robinhood Chain Testnet
- RainbowKit handles wallet connection

### 2. Create FLARE
- User enters token address (or uses deployed FlareToken)
- Sets target holder count (e.g., 1000)
- Defines recipient address
- Specifies amount to transfer
- Optional expiration time

### 3. Approve Token Spending
- User approves the vault to spend tokens
- Uses ERC20 approve function

### 4. Fund Vault
- User transfers tokens to the vault
- Tokens are held securely until execution

### 5. Monitor Holder Count
- System monitors token holder count
- In production, this would query blockchain data
- Currently simulated for MVP testing

### 6. Trigger Execution
- When threshold is reached, user triggers FLARE
- Calls `markTriggered` on executor
- Changes FLARE state to triggered

### 7. Execute Transfer
- User calls `execute` on executor
- Vault releases tokens to recipient
- Transaction completed on-chain

## Smart Contract Functions

### FlareFactory
- `createFlare(token, targetHolders, recipient, amount, expiresAt)` - Creates new FLARE instance

### FlareExecutor
- `configure(flare, creator, token, targetHolders, recipient, amount, expiresAt)` - Configures FLARE (called by factory)
- `markTriggered(flare, holderCount)` - Marks FLARE as triggered
- `execute(flare)` - Executes the token transfer
- `cancel(flare)` - Cancels FLARE (creator or owner only)

### FlareVault
- `fund(token, amount)` - Deposits tokens into vault
- `release(token, recipient, amount)` - Releases tokens (executor only)
- `balance(token)` - Checks vault balance

## Testing the MVP

### 1. Deploy Test Token
Use the deployed FlareToken or any ERC20 on Robinhood Chain Testnet.

### 2. Mint Test Tokens
If using FlareToken, call `mint(to, amount)` as owner.

### 3. Create Test FLARE
- Set low holder threshold for testing (e.g., 10)
- Use small token amounts
- Set yourself as recipient

### 4. Simulate Holder Growth
The current implementation simulates holder count growth. In production, this would:
- Query blockchain for actual holder count
- Use indexing services like The Graph
- Monitor token transfer events

### 5. Execute Full Flow
- Connect wallet
- Create FLARE
- Approve tokens
- Fund vault
- Wait for threshold (or simulate)
- Trigger execution
- Execute transfer

## Production Considerations

### Holder Count Monitoring
For production, implement:
- Blockchain indexer for holder count
- Event monitoring for token transfers
- Automated threshold checking
- Push notifications for triggers

### Security
- Audit smart contracts
- Implement proper access controls
- Add emergency pause functionality
- Consider upgradeable contracts

### Gas Optimization
- Batch operations where possible
- Use gas-efficient data structures
- Implement gas estimation in UI

## Troubleshooting

### Build Fails
- Ensure Node.js version is compatible
- Clear node_modules and reinstall
- Check TypeScript configuration

### Wallet Connection Issues
- Verify WalletConnect Project ID
- Check network configuration
- Ensure wallet supports Robinhood Chain Testnet

### Transaction Failures
- Check contract addresses are correct
- Verify user has sufficient gas
- Ensure token approvals are sufficient
- Check holder count threshold logic

## Next Steps

1. **Deploy contracts** to Robinhood Chain Testnet
2. **Configure environment variables** with deployed addresses
3. **Test complete flow** end-to-end
4. **Implement real holder monitoring** (replace simulation)
5. **Add transaction history** for users
6. **Deploy to production** (mainnet)
