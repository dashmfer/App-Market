#!/usr/bin/env bash
set -e

# Solana Smart Contract Deployment Script (Devnet)
# Deploys the App Market smart contract to Solana Devnet

echo "🚀 Deploying App Market to Solana Devnet..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if program is built
if [ ! -f "target/deploy/app_market.so" ]; then
    echo -e "${RED}❌ Program not built${NC}"
    echo "Run ./scripts/build-solana.sh first"
    exit 1
fi

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI not found${NC}"
    echo "Install with: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Configure for Devnet
echo "⚙️  Configuring Solana CLI for Devnet..."
solana config set --url https://api.devnet.solana.com

# Check wallet
echo ""
echo "💳 Wallet Information:"
WALLET=$(solana config get keypair | grep "Keypair Path" | awk '{print $3}')
echo "  Keypair: ${WALLET}"

BALANCE=$(solana balance)
echo "  Balance: ${BALANCE}"
echo ""

# Check if balance is sufficient
if [[ "${BALANCE}" == "0 SOL" ]]; then
    echo -e "${YELLOW}⚠️  Wallet has no SOL${NC}"
    echo "Requesting airdrop..."
    solana airdrop 2 || echo "Airdrop failed - please fund your wallet manually"
    sleep 2
    BALANCE=$(solana balance)
    echo "  New balance: ${BALANCE}"
    echo ""
fi

# Extract Program ID
PROGRAM_ID=$(anchor keys list | grep "app_market" | awk '{print $2}')
echo "🔑 Program ID: ${PROGRAM_ID}"
echo ""

# Deploy
echo "📤 Deploying program..."
echo "This will upload the program bytecode to Solana Devnet..."
echo ""

if anchor deploy --provider.cluster devnet; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""

    # Show program info
    echo "📊 Program Information:"
    solana program show ${PROGRAM_ID}
    echo ""

    # Explorer link
    echo "🔗 View on Solana Explorer:"
    echo "   https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet"
    echo ""

    # Next steps
    echo "📝 Next steps:"
    echo ""
    echo "1. Initialize the marketplace:"
    echo "   Use the frontend with an admin wallet to call initializeMarketplace()"
    echo ""
    echo "2. Update .env.local:"
    echo "   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com"
    echo "   NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID}"
    echo ""
    echo "3. Test the integration:"
    echo "   - Connect wallet"
    echo "   - Create a test listing"
    echo "   - Place bids"
    echo "   - Test full transaction flow"
    echo ""

else
    echo ""
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Insufficient SOL balance"
    echo "  - Network connectivity issues"
    echo "  - Program already deployed (use 'anchor upgrade' to update)"
    echo ""
    exit 1
fi
