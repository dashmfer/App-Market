# Semgrep Rules for Solana Anchor Security

Custom Semgrep rules for detecting security vulnerabilities in Solana Anchor smart contracts.

## Important Notes

1. **Rust Support**: Semgrep's Rust support is experimental. These rules may need adjustment.
2. **Pattern Limitations**: Some patterns are simplified due to Semgrep's pattern matching limitations with Rust macros.
3. **Manual Review Required**: All findings should be manually verified.

## Rules Included

### Critical Severity
- `anchor-missing-admin-check`: Functions that modify admin fields without access control
- `anchor-initialize-no-access-control`: Initialize functions vulnerable to frontrunning

### High Severity
- `anchor-unchecked-account-info`: AccountInfo with CHECK comment but no validation
- `anchor-treasury-no-validation`: Treasury accounts without owner validation
- `anchor-unchecked-arithmetic`: Arithmetic operations without overflow protection

### Medium Severity
- `anchor-partial-refund-remainder`: Fund distribution where remainder can be extracted
- `anchor-missing-timelock`: Privileged functions without time delays
- `anchor-init-if-needed`: Potentially vulnerable account initialization

### Low/Info Severity
- `anchor-magic-numbers`: Unnamed constants in security code
- `anchor-saturating-without-event`: Silent overflow handling
- `anchor-pda-seeds-client-controlled`: Client-provided PDA seeds

## Usage

```bash
# Validate rules
semgrep --validate --config solana-anchor-security.yaml

# Run on codebase
semgrep --config solana-anchor-security.yaml programs/

# Run with metrics disabled (for proprietary code)
semgrep --config solana-anchor-security.yaml --metrics=off programs/
```

## Testing Rules

Create test files with annotations:
```rust
// ruleid: anchor-missing-admin-check
pub fn dangerous_function(ctx: Context<Admin>) -> Result<()> {
    ctx.accounts.config.admin = ctx.accounts.attacker.key();
    Ok(())
}

// ok: anchor-missing-admin-check
pub fn safe_function(ctx: Context<Admin>) -> Result<()> {
    require!(ctx.accounts.signer.key() == ctx.accounts.config.admin, Unauthorized);
    ctx.accounts.config.admin = ctx.accounts.new_admin.key();
    Ok(())
}
```

Then run:
```bash
semgrep --test --config solana-anchor-security.yaml test-file.rs
```

## Patterns Derived From

These rules are based on vulnerabilities found in the App Market Escrow audit:

1. **C-01**: Initialization frontrunning (no access control)
2. **C-02**: Centralized backend authority without fallback
3. **H-01**: Admin fund extraction via partial refund
4. **H-03**: Unchecked treasury AccountInfo
5. **Various**: Arithmetic safety, magic numbers, timelock patterns

## Limitations

1. **Macro Expansion**: Semgrep doesn't fully expand Rust macros, so patterns inside `#[derive(Accounts)]` may not match
2. **Type Inference**: Semgrep doesn't perform Rust type inference, so type-based patterns are limited
3. **Cross-Function Analysis**: Single-function patterns only; use CodeQL for interprocedural analysis

## Contributing

To add new rules:
1. Create test cases (vulnerable + safe examples)
2. Write the rule pattern
3. Run `semgrep --test` until all tests pass
4. Optimize patterns (remove quote variants, subset patterns)
5. Re-run tests after optimization
