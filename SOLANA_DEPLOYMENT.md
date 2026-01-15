# Solana Smart Contract Deployment Guide

This document outlines the steps to deploy the App Market Solana smart contract and integrate it with the frontend.

## ⚠️ Important: Network Requirements

**The Solana build process requires internet access to download platform-tools from GitHub.** If you're in a restricted network environment, you have these options:

1. **Local Development**: Build on your local machine with proper internet access
2. **GitHub Actions**: Use the provided CI/CD workflow (recommended)
3. **Cloud Environment**: Use GitHub Codespaces, Gitpod, or similar with unrestricted network access
4. **Pre-built Binaries**: Use verifiable builds from another environment

**Current Status**:
- ✅ Anchor CLI v0.32.1 installed
- ✅ Rust toolchain ready
- ✅ Frontend integration complete (`hooks/useSolanaContract.ts`)
- ✅ Contract code ready (`programs/app-market/src/lib.rs`)
- ⚠️ Network access needed for platform-tools download
- ⏳ Deployment pending proper network environment

## Prerequisites

- Solana CLI installed (v1.18.18 or later)
- Anchor CLI installed (v0.29.0 or v0.32.1)
- Rust toolchain installed
- Node.js and npm/yarn installed
- Solana wallet with SOL for deployment
- **Unrestricted internet access** (GitHub downloads required)

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

### Option 1: GitHub Actions (Recommended) ⭐

The easiest way to build the contract is using GitHub Actions, which has proper network access:

1. **Push your code** to GitHub
2. **Navigate** to the Actions tab in your repository
3. **Run** the "Solana Smart Contract Build" workflow
4. **Download** the build artifacts (app_market.so, app_market.json)

To enable automatic deployment to Devnet:
- Add `SOLANA_DEPLOY_KEYPAIR` secret in GitHub repository settings
- Run workflow with "deploy" option enabled

**Workflow location**: `.github/workflows/solana-build.yml`

### Option 2: Local Build Script 🖥️

If you have unrestricted internet access locally:

```bash
# Build the contract
./scripts/build-solana.sh

# Deploy to Devnet
./scripts/deploy-devnet.sh
```

These scripts will:
- ✅ Check prerequisites
- ✅ Verify network connectivity
- ✅ Build the smart contract
- ✅ (Deploy script) Deploy to Devnet and show next steps

### Option 3: Manual Build 🔧

If you prefer manual control:

#### Step 1: Install Dependencies

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install AVM (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install Anchor CLI
avm install 0.29.0
avm use 0.29.0
```

#### Step 2: Build the Contract

```bash
# Navigate to project root
cd /path/to/App-Market

# Sync program keys
anchor keys sync

# Build the smart contract
anchor build

# This generates:
# - target/deploy/app_market.so (compiled program)
# - target/idl/app_market.json (Interface Definition Language)
# - target/types/app_market.ts (TypeScript types)
```

#### Step 3: Run Tests (Optional)

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
- **`hooks/useSolanaContract.ts`**: React hooks for contract interactions
- **`target/idl/app_market.json`**: Contract IDL (interface)

**Note**: If `anchor build` fails due to toolchain issues, the IDL has been manually generated from the contract source code and is ready to use for frontend development.

### Step 4: Usage Examples

#### Using the Contract Hooks

```typescript
import { useSolanaContract } from "@/hooks/useSolanaContract";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

function MyComponent() {
  const { publicKey, connected } = useWallet();
  const {
    createListing,
    placeBid,
    buyNow,
    makeOffer,
    fetchActiveListings
  } = useSolanaContract();

  // Create a listing
  const handleCreateListing = async () => {
    try {
      const { tx, listingPDA, salt } = await createListing(
        "my-app-listing-id",  // unique listing ID
        0.1,                   // 0.1 SOL starting price
        7 * 24 * 60 * 60,      // 7 days duration (seconds)
        0.05,                  // reserve price (optional)
        1.0                    // buy now price (optional)
      );
      console.log("Listing created at:", listingPDA);
      console.log("Transaction:", tx);
    } catch (error) {
      console.error("Error creating listing:", error);
    }
  };

  // Place a bid
  const handlePlaceBid = async (listingAddress: string) => {
    try {
      const listingPDA = new PublicKey(listingAddress);
      const tx = await placeBid(listingPDA, 0.15); // bid 0.15 SOL
      console.log("Bid placed:", tx);
    } catch (error) {
      console.error("Error placing bid:", error);
    }
  };

  // Buy now
  const handleBuyNow = async (listingAddress: string) => {
    try {
      const listingPDA = new PublicKey(listingAddress);
      const tx = await buyNow(listingPDA);
      console.log("Purchase complete:", tx);
    } catch (error) {
      console.error("Error buying:", error);
    }
  };

  // Make an offer
  const handleMakeOffer = async (listingAddress: string) => {
    try {
      const listingPDA = new PublicKey(listingAddress);
      const { tx, offerPDA } = await makeOffer(
        listingPDA,
        0.08,                 // offer 0.08 SOL
        "Interested in buying this app!"
      );
      console.log("Offer created:", offerPDA);
    } catch (error) {
      console.error("Error making offer:", error);
    }
  };

  // Fetch active listings
  const loadListings = async () => {
    try {
      const listings = await fetchActiveListings();
      console.log("Active listings:", listings);
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  return (
    <div>
      {connected ? (
        <>
          <button onClick={handleCreateListing}>Create Listing</button>
          <button onClick={loadListings}>Load Listings</button>
        </>
      ) : (
        <p>Connect your wallet to interact with the marketplace</p>
      )}
    </div>
  );
}
```

#### Available Hook Functions

The `useSolanaContract()` hook provides these functions:

**Listing Operations:**
- `createListing(listingId, startingPrice, duration, reservePrice?, buyNowPrice?)` - Create new listing
- `cancelListing(listingPDA)` - Cancel active listing
- `fetchListing(listingPDA)` - Get listing details
- `fetchSellerListings(sellerPubkey)` - Get all listings for a seller
- `fetchActiveListings()` - Get all active listings

**Bidding Operations:**
- `placeBid(listingPDA, bidAmount)` - Place a bid
- `buyNow(listingPDA)` - Instant purchase
- `endAuction(listingPDA)` - End auction (after time expires)

**Transaction Operations:**
- `confirmTransfer(listingPDA)` - Buyer confirms receipt
- `requestWithdrawal(listingPDA, amount, reason)` - Seller requests payment
- `approveWithdrawal(listingPDA, withdrawalId)` - Buyer approves withdrawal
- `fetchTransaction(transactionPDA)` - Get transaction details

**Offer Operations:**
- `makeOffer(listingPDA, amount, message)` - Make an offer
- `acceptOffer(listingPDA, buyerPubkey)` - Accept buyer's offer
- `cancelOffer(listingPDA)` - Cancel your offer
- `fetchOffer(offerPDA)` - Get offer details

**Dispute Operations:**
- `raiseDispute(listingPDA, reason, evidence)` - Raise a dispute
- `resolveDispute(listingPDA, refundBuyer, resolution)` - Admin resolves dispute

**Admin Operations:**
- `initializeMarketplace(treasuryWallet, platformTokenMint, platformFeeBps, disputeFeeBps, tokenLaunchFeeBps)` - Initialize marketplace

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

# Or install Agave toolchain (new Solana validator client)
cargo install agave-install
agave-install init stable
```

**Problem**: Anchor version mismatch
```bash
# Solution: Update Anchor.toml
[toolchain]
anchor_version = "0.29.0"

# Or install the matching version
avm install 0.29.0
avm use 0.29.0
```

**Problem**: Network issues downloading Solana platform-tools
If you encounter network errors during build:
1. The IDL has been manually generated from the contract source
2. Frontend integration can proceed without building the contract
3. Actual deployment will need proper Solana/Anchor toolchain setup
4. Consider using a different network environment or trying again later

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
