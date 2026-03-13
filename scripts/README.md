# Solana Smart Contract Scripts

This directory contains helper scripts for building and deploying the App Market Solana smart contract.

## Scripts

### `build-solana.sh`

Builds the Solana smart contract locally.

**Prerequisites:**
- Anchor CLI installed
- Rust toolchain
- Unrestricted internet access (GitHub downloads required)

**Usage:**
```bash
./scripts/build-solana.sh
```

**What it does:**
1. Checks prerequisites (Anchor CLI, Rust, Solana CLI)
2. Verifies internet connectivity
3. Syncs program keys
4. Builds the smart contract with `anchor build`
5. Shows build artifacts and next steps

**Output:**
- `target/deploy/app_market.so` - Compiled program
- `target/idl/app_market.json` - Interface Definition Language
- `target/deploy/app_market-keypair.json` - Program keypair

### `deploy-devnet.sh`

Deploys the compiled smart contract to Solana Devnet.

**Prerequisites:**
- Program already built (`build-solana.sh` completed successfully)
- Solana CLI installed and configured
- Wallet with sufficient SOL (script will request airdrop if needed)

**Usage:**
```bash
./scripts/deploy-devnet.sh
```

**What it does:**
1. Verifies program is built
2. Configures Solana CLI for Devnet
3. Checks wallet balance (requests airdrop if needed)
4. Deploys program using `anchor deploy`
5. Shows program information and Solana Explorer link
6. Provides next steps for initialization

**After deployment:**
- Note the Program ID
- Update `.env.local` with the Program ID and RPC URL
- Initialize the marketplace using the frontend admin interface

## Troubleshooting

### Build fails with network errors
**Problem:** `Failed to install platform-tools`

**Solution:** The build process requires downloading Solana platform-tools from GitHub. Ensure:
- You have unrestricted internet access
- GitHub.com is accessible
- No firewall/proxy blocking downloads

**Alternative:** Use GitHub Actions workflow instead (see `.github/workflows/solana-build.yml`)

### Deploy fails with insufficient balance
**Problem:** `Error: Insufficient balance`

**Solution:**
```bash
# Request airdrop on Devnet
solana airdrop 2

# Check balance
solana balance
```

### Program already deployed
**Problem:** `Error: program already exists`

**Solution:**
```bash
# Upgrade existing program instead
anchor upgrade target/deploy/app_market.so \
  --program-id FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ \
  --provider.cluster devnet
```

## CI/CD Alternative

If local building is problematic, use GitHub Actions:

1. Push code to GitHub
2. Go to Actions tab
3. Run "Solana Smart Contract Build" workflow
4. Download artifacts
5. Deploy manually or enable automatic deployment

See `.github/workflows/solana-build.yml` for configuration.

## Documentation

For complete deployment instructions, see:
- `SOLANA_DEPLOYMENT.md` - Full deployment guide
- `README.md` - Project overview

## Support

For issues:
1. Check `SOLANA_DEPLOYMENT.md` troubleshooting section
2. Review Anchor documentation: https://www.anchor-lang.com/
3. Check Solana documentation: https://docs.solana.com/
