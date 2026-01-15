# Build Issues and Solutions

## Current Build Failure

### Problem Summary
The Solana/Anchor smart contract build is failing because:

1. **Missing Solana CLI**: The `solana` command is not available in the environment
2. **Missing Platform Tools**: `cargo-build-sbf` requires platform-tools (v1.41) which must be downloaded from GitHub
3. **Network Restrictions**: The environment has network restrictions that prevent downloading from:
   - `https://release.solana.com/` (Solana CLI installer)
   - `https://github.com/` (platform-tools release assets)

### Error Details

```
error: no such command: `build-sbf`
```

This occurs because:
- Anchor's `anchor build` command calls `cargo-build-sbf`
- `cargo-build-sbf` (v1.18.18) is installed but requires platform-tools (v1.41)
- Platform-tools include:
  - LLVM toolchain (clang, llvm-ar, llvm-objdump, llvm-objcopy)
  - Rust SBF target support
  - BPF/SBF SDK components

### Attempted Solutions

1. ✗ **Install Solana CLI via curl**: Blocked by network (403 Forbidden)
2. ✗ **Install via cargo**: Version conflicts and yanked dependencies
3. ✗ **Download platform-tools manually**: Proxy blocks GitHub releases
4. ✗ **Create symlinks to system tools**: Causes infinite recursion errors

### Working Solutions

#### Option 1: Use GitHub Actions (Recommended)
The project already has a working CI/CD pipeline:
- `.github/workflows/solana-build.yml` successfully builds the contract
- Uses official Solana installation methods
- No network restrictions in GitHub Actions environment

#### Option 2: Use Docker
Build in a container with proper Solana tooling:

```bash
# Use Solana's official Docker image
docker run --rm -v $(pwd):/workspace -w /workspace \
  solanalabs/rust:1.79.0 \
  bash -c "
    curl -sSfL https://release.solana.com/stable/install | sh && \
    export PATH=\"$HOME/.local/share/solana/install/active_release/bin:$PATH\" && \
    cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.0 anchor-cli --locked --force && \
    anchor build
  "
```

#### Option 3: Pre-configured Development Environment
Set up a development environment with Solana tools pre-installed:
- Use a VM or container with unrestricted network access
- Install Solana CLI (v1.18+)
- Install Anchor CLI (v0.30.0)
- Install Rust (1.79.0 - pinned for compatibility)

### Environment Requirements

```toml
[toolchain]
rust = "1.79.0"
solana-cli = "~1.18"
anchor-cli = "0.30.0"
```

### Key Files
- `Anchor.toml` - Specifies anchor_version = "0.30.0"
- `.github/workflows/solana-build.yml` - Working CI build configuration
- `programs/app-market/Cargo.toml` - Smart contract dependencies

### Next Steps

1. **For Local Development**: Set up Docker-based build environment
2. **For CI/CD**: Continue using GitHub Actions (already working)
3. **For Production**: Deploy compiled artifacts from CI/CD pipeline

### References
- Anchor Documentation: https://www.anchor-lang.com/
- Solana CLI Installation: https://docs.solana.com/cli/install-solana-cli-tools
- Platform Tools: https://github.com/anza-xyz/platform-tools
