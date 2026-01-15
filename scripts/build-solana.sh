#!/usr/bin/env bash
set -e

# Solana Smart Contract Build Script
# This script builds the App Market Solana smart contract locally

echo "🔨 Building App Market Solana Smart Contract..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI not found${NC}"
    echo "Install with: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    echo "Then: avm install 0.29.0 && avm use 0.29.0"
    exit 1
fi

if ! command -v solana &> /dev/null; then
    echo -e "${YELLOW}⚠️  Solana CLI not found (optional for build, required for deploy)${NC}"
else
    echo -e "${GREEN}✓${NC} Solana CLI: $(solana --version)"
fi

echo -e "${GREEN}✓${NC} Anchor CLI: $(anchor --version)"
echo -e "${GREEN}✓${NC} Rust: $(rustc --version)"
echo ""

# Check internet connectivity
echo "🌐 Checking internet connectivity..."
if curl -s --head --connect-timeout 5 https://github.com &> /dev/null; then
    echo -e "${GREEN}✓${NC} Internet connection OK"
else
    echo -e "${RED}❌ No internet connection${NC}"
    echo "Solana build requires internet access to download platform-tools."
    echo "Please ensure you have unrestricted access to GitHub."
    exit 1
fi
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Sync program keys
echo "🔑 Syncing program keys..."
anchor keys sync
echo ""

# Build the contract
echo "⚙️  Building smart contract..."
echo "This may take a few minutes on first build..."
if anchor build; then
    echo ""
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo ""

    # Show build artifacts
    echo "📦 Build artifacts:"
    echo "  - Program: $(ls -lh target/deploy/app_market.so | awk '{print $5}') (target/deploy/app_market.so)"
    echo "  - IDL: $(ls -lh target/idl/app_market.json | awk '{print $5}') (target/idl/app_market.json)"
    echo "  - Keypair: target/deploy/app_market-keypair.json"
    echo ""

    # Extract Program ID
    PROGRAM_ID=$(anchor keys list | grep "app_market" | awk '{print $2}')
    echo "🔑 Program ID: ${PROGRAM_ID}"
    echo ""

    # Next steps
    echo "📝 Next steps:"
    echo "  1. Deploy to Devnet:"
    echo "     $ solana config set --url https://api.devnet.solana.com"
    echo "     $ anchor deploy"
    echo ""
    echo "  2. Initialize marketplace (using frontend or script)"
    echo ""
    echo "  3. Update .env.local:"
    echo "     NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com"
    echo "     NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID}"
    echo ""

else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Network access blocked (platform-tools download failed)"
    echo "  - Anchor version mismatch (use 0.29.0)"
    echo "  - Rust version incompatibility"
    echo ""
    echo "See SOLANA_DEPLOYMENT.md for troubleshooting"
    exit 1
fi
