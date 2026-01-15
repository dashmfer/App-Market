# Solana Smart Contract Deployment Guide

This document outlines the steps to deploy the App Market Solana smart contract and integrate it with the frontend.

## Prerequisites

- Solana CLI installed (v1.18.18 or later)
- Anchor CLI installed (v0.29.0 or v0.32.1)
- Rust toolchain installed
- Node.js and npm/yarn installed
- Solana wallet with SOL for deployment

## Smart Contract Overview

The App Market smart contract is a comprehensive escrow and marketplace system built on Solana using the Anchor framework. It includes:

### Core Features
- **Auctions**: Time-limited bidding with reserve prices, anti-sniping protection
- **Buy Now**: Instant purchase functionality
- **Offers**: Direct offers to sellers with expiration
- **Escrow**: Non-custodial fund holding using PDAs
- **Dispute Resolution**: Admin-mediated dispute handling
- **Security**: 48-hour timelocks for admin changes, DoS protection, fee caps

### Contract Structure
- **Location**: `programs/app-market/src/lib.rs`
- **Program ID**: `FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ`
- **Lines of Code**: ~3,140 lines
- **Instructions**: 25 public functions

## Building the Contract

### Step 1: Install Dependencies

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install AVM (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install Anchor CLI
avm install 0.29.0
avm use 0.29.0

# Or install latest
avm install latest
avm use latest
```

### Step 2: Build the Contract

```bash
# Navigate to project root
cd /path/to/App-Market

# Build the smart contract
anchor build

# This generates:
# - target/deploy/app_market.so (compiled program)
# - target/idl/app_market.json (Interface Definition Language)
# - target/types/app_market.ts (TypeScript types)
```

### Step 3: Run Tests (Optional)

```bash
# Run Anchor tests
anchor test

# Run specific test file
anchor test tests/app-market.ts
```

## Deployment

### Step 1: Configure Solana Network

```bash
# Set cluster (devnet, testnet, or mainnet-beta)
solana config set --url https://api.devnet.solana.com

# Create/import wallet
solana-keygen new -o ~/.config/solana/id.json

# Check balance
solana balance

# Airdrop SOL on devnet (for testing)
solana airdrop 2
```

### Step 2: Update Anchor.toml

Ensure `Anchor.toml` has correct settings:

```toml
[provider]
cluster = "Devnet"  # or "Mainnet" for production
wallet = "~/.config/solana/id.json"

[programs.devnet]
app_market = "FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ"
```

### Step 3: Deploy to Devnet

```bash
# Deploy the program
anchor deploy

# The output will show:
# - Program ID
# - Transaction signature
# - Deployed program size
# - Cost in SOL
```

### Step 4: Initialize the Marketplace

After deployment, initialize the marketplace config:

```bash
# Run initialization script (create one if needed)
anchor run initialize

# Or manually using Anchor client:
ts-node scripts/initialize-marketplace.ts
```

Example initialization script:

```typescript
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { IDL } from "../target/types/app_market";

const PROGRAM_ID = new PublicKey("FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ");
const connection = new Connection("https://api.devnet.solana.com");
const wallet = Keypair.fromSecretKey(/* your wallet secret key */);

// Initialize marketplace
const program = new Program(IDL, PROGRAM_ID, provider);
await program.methods
  .initialize(
    500, // 5% platform fee
    200, // 2% dispute fee
    backendAuthorityPubkey
  )
  .accounts({
    config: configPDA,
    admin: wallet.publicKey,
    treasury: treasuryPubkey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

## Frontend Integration

### Step 1: Copy IDL to Frontend

```bash
# The IDL is already at target/idl/app_market.json
# It's already imported in lib/solana.ts
```

### Step 2: Update Environment Variables

Create/update `.env.local`:

```env
# Solana RPC endpoint
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Program ID (already set in code)
NEXT_PUBLIC_PROGRAM_ID=FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ

# Treasury wallet (receives platform fees)
NEXT_PUBLIC_TREASURY_WALLET=<your-treasury-wallet-pubkey>

# Backend authority (for upload verification)
BACKEND_AUTHORITY_SECRET=<backend-authority-secret-key>
```

### Step 3: Integration Files

The following files handle Solana integration:

- **`lib/solana.ts`**: Core Solana utilities, PDAs, constants
- **`lib/solana-contract.ts`**: Contract interaction functions
- **`target/idl/app_market.json`**: Contract IDL (interface)

### Step 4: Usage Examples

#### Create a Listing

```typescript
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { createListing } from "@/lib/solana-contract";

const wallet = useAnchorWallet();
const { connection } = useConnection();
const provider = new AnchorProvider(connection, wallet, {});

const tx = await createListing({
  provider,
  salt: Date.now(),
  listingType: "Auction",
  startingPrice: 1.0, // 1 SOL
  reservePrice: 1.0,
  buyNowPrice: 5.0,
  durationSeconds: 86400 * 7, // 7 days
  requiresGithub: true,
  requiredGithubUsername: "octocat",
});
```

#### Place a Bid

```typescript
import { placeBid } from "@/lib/solana-contract";

const tx = await placeBid({
  provider,
  listing: listingPubkey,
  amount: 2.5, // 2.5 SOL
  withdrawalCount: 0, // Get from listing account
});
```

## Testing

### Local Testing with Anchor

```bash
# Start local validator
solana-test-validator

# In another terminal, run tests
anchor test --skip-local-validator
```

### Frontend Testing

1. **Use Devnet**: Set RPC URL to devnet and use devnet wallet
2. **Use Phantom/Solflare**: Connect wallet in browser
3. **Airdrop SOL**: Get devnet SOL for testing transactions

## Deployment Checklist

- [ ] Contract built successfully with `anchor build`
- [ ] Tests pass with `anchor test`
- [ ] Deployed to Devnet with `anchor deploy`
- [ ] Marketplace initialized with correct parameters
- [ ] Program ID updated in frontend (`lib/solana.ts`)
- [ ] IDL copied to frontend (`target/idl/app_market.json`)
- [ ] Environment variables configured (`.env.local`)
- [ ] Treasury wallet configured
- [ ] Backend authority configured
- [ ] Frontend tested with wallet connection
- [ ] End-to-end flow tested:
  - [ ] Create listing
  - [ ] Place bid
  - [ ] Settle auction
  - [ ] Confirm transfer
  - [ ] Complete transaction

## Security Considerations

### Pre-Deployment
- [ ] Code audited by security professionals
- [ ] Access control verified (admin functions, timelocks)
- [ ] Math operations checked for overflow/underflow
- [ ] PDA derivations verified
- [ ] Fee calculations validated

### Post-Deployment
- [ ] Monitor transaction logs for anomalies
- [ ] Set up alerts for admin actions
- [ ] Regular balance checks on escrow accounts
- [ ] Backup admin keypairs securely
- [ ] Document emergency procedures

## Troubleshooting

### Build Issues

**Problem**: `cargo build-sbf` not found
```bash
# Solution: Install Solana CLI completely
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

**Problem**: Anchor version mismatch
```bash
# Solution: Update Anchor.toml
[toolchain]
anchor_version = "0.29.0"
```

### Deployment Issues

**Problem**: Insufficient SOL for deployment
```bash
# Solution: Airdrop more SOL on devnet
solana airdrop 5
```

**Problem**: Program ID mismatch
```bash
# Solution: Sync program keys
anchor keys sync
```

### Runtime Issues

**Problem**: Transaction fails with "custom program error: 0x0"
- Check account ownership and PDA derivations
- Verify all required accounts are passed correctly
- Ensure wallet has sufficient balance

**Problem**: "Account not found"
- Ensure program is deployed
- Verify correct cluster (devnet vs mainnet)
- Check Program ID is correct

## Monitoring

### On-Chain Activity

```bash
# View program logs
solana logs <PROGRAM_ID>

# Get account info
solana account <ACCOUNT_PUBKEY>

# View transaction
solana confirm -v <TRANSACTION_SIGNATURE>
```

### Metrics to Track

- Total listings created
- Total volume (from MarketConfig.total_volume)
- Total sales (from MarketConfig.total_sales)
- Active disputes
- Escrow balances
- Treasury balance

## Upgrading the Contract

Solana programs can be upgraded if the upgrade authority is set:

```bash
# Build new version
anchor build

# Upgrade program (requires upgrade authority)
solana program deploy --program-id <KEYPAIR> target/deploy/app_market.so
```

**Important**: Test thoroughly on devnet before mainnet upgrades!

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Anchor Examples](https://github.com/coral-xyz/anchor/tree/master/tests)

## Support

For deployment assistance or issues:
- Check contract source: `programs/app-market/src/lib.rs`
- Review IDL: `target/idl/app_market.json`
- Examine integration: `lib/solana-contract.ts`
