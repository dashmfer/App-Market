# Blockchain & Solana Integration Security Audit

**Audit Date:** 2026-02-10
**Scope:** All Solana blockchain integration, smart contract interactions, wallet handling, escrow logic, and token operations
**Auditor:** Security Review (automated analysis)

---

## Summary Table

| # | Severity | Category | Finding | File |
|---|----------|----------|---------|------|
| B-01 | **CRITICAL** | Private Key Exposure | Mint keypair secret key sent to client in API response | `app/api/token-launch/deploy/route.ts:176` |
| B-02 | **CRITICAL** | Escrow Desync | Escrow auto-release marks DB as COMPLETED without on-chain fund release | `app/api/cron/escrow-auto-release/route.ts:119-133` |
| B-03 | **CRITICAL** | Transaction Verification | On-chain tx verification silently swallowed on RPC failure; purchase still recorded | `app/api/purchases/route.ts:87-90` |
| B-04 | **HIGH** | Escrow Bypass | Buy-now sends SOL directly to treasury wallet, not on-chain escrow PDA | `components/listings/buy-now-modal.tsx:74-83` |
| B-05 | **HIGH** | Front-Running | Zero slippage protection on PATO initial buy (`minimumAmountOut: new BN(0)`) | `lib/meteora-dbc.ts:261` |
| B-06 | **HIGH** | RPC Endpoint | Public RPC URL exposed via `NEXT_PUBLIC_` env var; rate-limited public endpoints used as fallback | `lib/solana.ts:45-53`, `components/providers.tsx:19` |
| B-07 | **HIGH** | Off-Chain/On-Chain Desync | Transfer confirmation completes in DB without on-chain escrow release | `app/api/transactions/[id]/confirm/route.ts:206-214` |
| B-08 | **HIGH** | Private Key in Environment | Backend authority secret key stored as plaintext JSON array in env var | `.env.example:78`, `app/api/cron/expire-withdrawals/route.ts:37-44` |
| B-09 | **MEDIUM** | Hardcoded Program ID | Program ID and treasury wallet hardcoded as fallback defaults | `lib/solana.ts:5-12` |
| B-10 | **MEDIUM** | Hardcoded Admin Pubkey | Expected admin pubkey hardcoded in smart contract | `programs/app-market/src/lib.rs:83` |
| B-11 | **MEDIUM** | Token Launch Status | Client can self-report LIVE status without server-side on-chain verification | `app/api/token-launch/[id]/route.ts:216-258` |
| B-12 | **MEDIUM** | Wallet Verification Logging | Signature verification result logged (information disclosure) | `lib/wallet-verification.ts:111` |
| B-13 | **MEDIUM** | Transaction Replay | No on-chain transaction signature deduplication; same tx hash could be submitted twice | `app/api/purchases/route.ts:65-91` |
| B-14 | **MEDIUM** | Buyback Placeholder | Buyback swap execution is simulated, returns fake tx signatures | `lib/buyback.ts:189-201` |
| B-15 | **LOW** | Vanity Key Generation | Vanity keypair brute-force runs server-side synchronously, potential DoS | `app/api/token-launch/route.ts:127-134` |
| B-16 | **LOW** | ExportKeyModal | Private key stored in React ref (not state), but still accessible in memory | `components/wallet/ExportKeyModal.tsx:35` |
| B-17 | **LOW** | Devnet Fallback | Multiple files fall back to devnet RPC when env var not set | `app/api/purchases/route.ts:67`, `lib/pool-watcher.ts:3` |
| B-18 | **LOW** | toTokenUnits Precision | `Math.floor(amount * Math.pow(10, decimals))` can lose precision for fractional amounts | `lib/solana.ts:251` |

---

## Detailed Findings

---

### B-01: CRITICAL -- Mint Keypair Secret Key Sent to Client in API Response

**File:** `/home/user/App-Market/app/api/token-launch/deploy/route.ts`, line 176

**Description:**
The `/api/token-launch/deploy` endpoint decrypts the vanity mint keypair stored in the database and sends the **full 64-byte secret key** to the client as a JSON array:

```typescript
// Line 176
mintKeypairBytes: Array.from(decryptedKeypair.secretKey),
```

This secret key is transmitted over the network in the API response body, then reconstructed client-side in `PATOLaunchModal.tsx` (line 201-202):

```typescript
const mintKeypair = Keypair.fromSecretKey(
  new Uint8Array(data.mintKeypairBytes)
);
```

**Impact:**
- The mint keypair secret key is exposed in browser network logs, browser memory, and any proxy or CDN that logs response bodies.
- An attacker who intercepts this response (MITM, browser extension, XSS) gains the ability to sign transactions as the token mint authority.
- The key is cached in the browser's JavaScript memory for the duration of the page session.

**Recommended Fix:**
Instead of sending the secret key to the client, have the server partially sign the transaction with the mint keypair before sending it to the client. The client only needs to add their own signature. The Solana Transaction model supports partial signing:

```typescript
// Server-side: partially sign with mint keypair
result.createPoolTx.partialSign(decryptedKeypair);

// Send only the partially-signed transaction to client
// Do NOT send mintKeypairBytes
```

---

### B-02: CRITICAL -- Escrow Auto-Release Marks DB as COMPLETED Without On-Chain Fund Release

**File:** `/home/user/App-Market/app/api/cron/escrow-auto-release/route.ts`, lines 119-133

**Description:**
The escrow auto-release cron job finds transactions where the transfer deadline has passed and updates them to `COMPLETED` in the database. However, there is an explicit TODO comment acknowledging that **no on-chain escrow release transaction is executed**:

```typescript
// TODO: Execute on-chain refund transaction before updating database status.
// Currently funds remain locked in escrow. Requires:
// 1. Backend authority keypair to sign refund transactions
// 2. Complete IDL for refund_escrow instruction
// 3. Error handling for failed on-chain refunds

// Update transaction to COMPLETED
await withRetry(() => prisma.transaction.update({
  where: { id: transaction.id },
  data: {
    status: "COMPLETED",
    transferCompletedAt: now,
    releasedAt: now,
  },
}), `Update transaction ${transaction.id}`);
```

**Impact:**
- The database indicates funds have been released, but SOL remains locked in the on-chain escrow PDA permanently.
- Sellers see "Funds Auto-Released" notifications but never actually receive SOL.
- This effectively results in permanent fund locking for any auto-released transaction.
- Users cannot dispute because the DB says the transaction is completed.

**Recommended Fix:**
Do not update the database status to `COMPLETED` until the on-chain escrow release transaction succeeds. Implement the on-chain release flow using the backend authority keypair, and only then update the DB. If on-chain release fails, keep the status as `TRANSFER_IN_PROGRESS` and flag for manual review.

---

### B-03: CRITICAL -- On-Chain Transaction Verification Silently Fails

**File:** `/home/user/App-Market/app/api/purchases/route.ts`, lines 65-91

**Description:**
The purchase API verifies the on-chain transaction, but if the RPC call throws an error, the catch block only logs the error and continues processing the purchase:

```typescript
} catch (verifyErr) {
  console.error("Error verifying on-chain tx:", verifyErr);
  // Don't block purchase if RPC is temporarily unavailable
}
```

After this catch block, the purchase proceeds to create database records and mark the listing as sold.

**Impact:**
- An attacker can submit a fake or invalid `onChainTx` signature. If the RPC endpoint is slow, down, or returns an error, the purchase is recorded without any on-chain verification.
- This creates a race condition: submit purchase with a fake tx hash during RPC downtime, and the listing gets marked as sold without actual payment.
- The "confirmed" commitment level is used, but transaction finality is not verified.

**Recommended Fix:**
- Never proceed with a purchase if on-chain verification fails. Return an error to the client asking them to retry.
- Use `"finalized"` commitment level instead of `"confirmed"` for payment verification.
- Add a separate verification step: after the tx is confirmed, verify the transaction actually transfers the correct amount to the correct escrow PDA.
- Parse the transaction instructions to confirm the transfer recipient and amount match expectations.

---

### B-04: HIGH -- Buy-Now Sends SOL Directly to Treasury, Not On-Chain Escrow PDA

**File:** `/home/user/App-Market/components/listings/buy-now-modal.tsx`, lines 72-83

**Description:**
The client-side buy-now flow sends SOL directly to the `TREASURY_WALLET` rather than the on-chain escrow PDA:

```typescript
// TODO: Replace with PDA-based escrow from smart contract once IDL is complete
// const [escrowPda] = getEscrowPDA(listingPDA);
const escrowPubkey = TREASURY_WALLET;
const lamports = Math.floor(totalPrice * LAMPORTS_PER_SOL);

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: escrowPubkey,
    lamports,
  })
);
```

The same pattern exists in the partner purchase flow (line 150).

**Impact:**
- Funds bypass the on-chain escrow program entirely. There is no programmatic guarantee the buyer can get a refund.
- The smart contract's escrow logic (disputes, refunds, finalization checks) is completely bypassed.
- The treasury wallet holder has immediate, unilateral access to buyer funds with no on-chain escrow protection.
- Sellers must trust the platform to release funds, rather than relying on the smart contract.

**Recommended Fix:**
Replace the `TREASURY_WALLET` transfer with a call to the on-chain `buy_now` instruction through the Anchor program, which properly deposits into the escrow PDA. The smart contract already has all the necessary escrow logic (`buy_now`, `finalize_transaction`, `confirm_receipt`, `emergency_refund`).

---

### B-05: HIGH -- Zero Slippage Protection on PATO Initial Buy

**File:** `/home/user/App-Market/lib/meteora-dbc.ts`, line 261

**Description:**
When creating a pool with an initial buy, the `minimumAmountOut` parameter is set to zero:

```typescript
firstBuyParam: {
  buyer: params.creatorWallet,
  buyAmount: new BN(
    Math.floor(params.initialBuyAmountSOL * LAMPORTS_PER_SOL)
  ),
  minimumAmountOut: new BN(0), // No minimum for initial buy
  referralTokenAccount: null,
},
```

**Impact:**
- A front-running bot monitoring the mempool can sandwich the initial buy transaction, extracting value from the creator.
- With zero slippage protection, the creator could receive far fewer tokens than expected.
- On a bonding curve, this is especially dangerous because the price impact of the first buy can be manipulated.

**Recommended Fix:**
Calculate an expected output amount based on the bonding curve parameters and set `minimumAmountOut` to at least 95-99% of that value. Even for initial buys, slippage protection should never be zero.

---

### B-06: HIGH -- Public RPC URL Exposed and Rate-Limited Endpoints Used as Fallback

**File:** `/home/user/App-Market/lib/solana.ts`, lines 45-53; `/home/user/App-Market/components/providers.tsx`, line 19

**Description:**
Multiple locations fall back to public Solana RPC endpoints:

```typescript
// lib/solana.ts
if (!rpcUrl) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL must be set in production");
  }
  return new Connection("https://api.devnet.solana.com", "confirmed");
}

// components/providers.tsx (client-side)
return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");

// app/api/purchases/route.ts (server-side!)
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
```

Additionally, the RPC URL is exposed as a `NEXT_PUBLIC_` variable, meaning it is embedded in the client-side JavaScript bundle. If this is a premium RPC endpoint with an API key in the URL (e.g., Helius, QuickNode), the API key is publicly visible.

**Impact:**
- Public RPC endpoints are heavily rate-limited and unreliable for production use.
- If the production RPC URL contains an API key (common with Helius/QuickNode URL-based auth), that key is exposed to all users.
- The `purchases/route.ts` server-side route falls back to devnet even in production if the env var is missing, which could silently validate against the wrong network.

**Recommended Fix:**
- Use a separate server-side env var (without `NEXT_PUBLIC_` prefix) for server-side RPC calls. Only expose a public-safe RPC endpoint to the client.
- Never include API keys in `NEXT_PUBLIC_` environment variables.
- Remove all devnet fallbacks from server-side routes. Fail hard if the RPC URL is not configured.
- Consider using an RPC proxy that handles rate limiting and key management.

---

### B-07: HIGH -- Transfer Confirmation Completes in DB Without On-Chain Escrow Release

**File:** `/home/user/App-Market/app/api/transactions/[id]/confirm/route.ts`, lines 206-214

**Description:**
When all required transfer checklist items are confirmed by both buyer and seller, the transaction is marked as `COMPLETED` in the database and `releasedAt` is set. However, **no on-chain escrow release transaction is executed**:

```typescript
if (allConfirmed) {
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: "COMPLETED",
      transferCompletedAt: new Date(),
      releasedAt: new Date(),  // But no on-chain release happens
    },
  });
```

**Impact:**
- Similar to B-02, funds remain locked in the on-chain escrow PDA while the database claims they have been released.
- The on-chain `confirm_receipt` or `finalize_transaction` instruction is never called.
- This breaks the escrow guarantee: sellers never receive funds from the on-chain escrow.

**Recommended Fix:**
After both parties confirm, trigger the on-chain escrow release using the appropriate smart contract instruction (`confirm_receipt` or `finalize_transaction`) before updating the database status.

---

### B-08: HIGH -- Backend Authority Secret Key Stored as Plaintext in Environment Variable

**File:** `/home/user/App-Market/.env.example`, line 78; `/home/user/App-Market/app/api/cron/expire-withdrawals/route.ts`, lines 37-44

**Description:**
The backend authority keypair (used to sign on-chain transactions) is stored as a JSON array of bytes in an environment variable:

```
BACKEND_AUTHORITY_SECRET_KEY="[1,2,3,...,64]"
```

And parsed at runtime:
```typescript
const keypairBytes = JSON.parse(secretKeyJson);
return Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
```

**Impact:**
- Environment variables are often logged by deployment platforms, CI/CD systems, and monitoring tools.
- The secret key is not encrypted at rest in the environment.
- Anyone with access to the deployment environment (Vercel dashboard, server shell, logs) can extract the full private key.
- This key has authority to verify uploads and execute on-chain operations on behalf of the platform.

**Recommended Fix:**
- Use a secrets manager (AWS Secrets Manager, Hashicorp Vault, or Vercel's encrypted environment variables) instead of raw env vars.
- Consider using a hardware security module (HSM) or a key management service (KMS) for signing operations.
- At minimum, encrypt the key at rest using a separate encryption key and decrypt at runtime.

---

### B-09: MEDIUM -- Program ID and Treasury Wallet Hardcoded as Fallback Defaults

**File:** `/home/user/App-Market/lib/solana.ts`, lines 5-12

**Description:**
The program ID and treasury wallet address are hardcoded with fallback defaults:

```typescript
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog"
);

export const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || "3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6"
);
```

The same addresses also appear as hardcoded constants in `scripts/initialize-marketplace.ts` (lines 14, 17).

**Impact:**
- If environment variables are misconfigured or missing, the application silently uses hardcoded addresses, which may be devnet/test addresses on mainnet.
- Hardcoded addresses make key rotation difficult and create single points of failure.
- The `NEXT_PUBLIC_` prefix means these are embedded in client bundles, which is acceptable for public addresses but makes updates require a redeploy.

**Recommended Fix:**
- Remove fallback defaults in production builds. Fail hard if critical addresses are not configured.
- Use a configuration validation step at startup to verify all required addresses are set.

---

### B-10: MEDIUM -- Expected Admin Pubkey Hardcoded in Smart Contract

**File:** `/home/user/App-Market/programs/app-market/src/lib.rs`, line 83

**Description:**
The smart contract hardcodes an expected admin public key to prevent initialization front-running:

```rust
pub const EXPECTED_ADMIN: Pubkey = solana_program::pubkey!("63jQ3qffMgacpUw8ebDZPuyUHf7DsfsYnQ7sk8fmFaF1");
```

This is used in the `initialize` instruction (line 97-100):
```rust
require!(
    ctx.accounts.admin.key() == EXPECTED_ADMIN,
    AppMarketError::NotExpectedAdmin
);
```

**Impact:**
- While this is a valid anti-front-running measure for initialization, the hardcoded key means if the admin key is compromised, the program must be redeployed.
- The admin key is publicly visible on-chain and in source code, making it a target.
- Positive: After initialization, admin changes go through a 48-hour timelock, which is good security practice.

**Recommended Fix:**
- This is an acceptable pattern for initialization protection. Document the key management procedures.
- Ensure the admin key is stored in a hardware wallet and never used for other purposes.
- Consider a multisig approach for the admin role.

---

### B-11: MEDIUM -- Client Can Self-Report Token Launch Status Without Server-Side Verification

**File:** `/home/user/App-Market/app/api/token-launch/[id]/route.ts`, lines 216-258 (PATCH handler)

**Description:**
After deploying a token, the client calls `PATCH /api/token-launch/[id]` to update the status to `LIVE`. The server validates the state transition but does **not verify on-chain** that the pool was actually created:

```typescript
const { status, onChainTx, dbcPoolAddress } = body;

// Validate status transition
const validTransitions: Record<string, string[]> = {
  PENDING: ["LAUNCHING", "CANCELLED"],
  LAUNCHING: ["LIVE", "FAILED"],
  // ...
};
```

The `onChainTx` signature is accepted but never verified against the chain.

**Impact:**
- A malicious user could report a token launch as `LIVE` without actually deploying it on-chain.
- This could create phantom token launches in the database.
- Users might see tokens listed as live that don't actually exist.

**Recommended Fix:**
- Verify the `onChainTx` on-chain before accepting the status update.
- Fetch the pool account from the RPC and confirm it exists at the expected address.
- Only accept the `LIVE` status from the server-side pool watcher, not from the client.

---

### B-12: MEDIUM -- Wallet Verification Result Logged

**File:** `/home/user/App-Market/lib/wallet-verification.ts`, line 111

**Description:**
The wallet signature verification result is logged:

```typescript
console.log("[Wallet Verification] Signature verified:", verified);
```

While the private key itself is not logged, logging authentication results at this level of detail is an information disclosure concern in production.

**Impact:**
- Server logs may contain detailed authentication flow information.
- Helps attackers understand the authentication process and timing.
- Low direct impact but increases attack surface visibility.

**Recommended Fix:**
- Remove or reduce logging verbosity in production.
- Use structured logging with configurable log levels.
- Never log authentication success/failure details at the default log level.

---

### B-13: MEDIUM -- No On-Chain Transaction Signature Deduplication

**File:** `/home/user/App-Market/app/api/purchases/route.ts`, lines 65-91

**Description:**
The purchase API accepts an `onChainTx` signature but does not check if this signature has already been used for another purchase. The only deduplication is checking if a transaction already exists for the listing (line 148-153), but the same on-chain tx could theoretically be submitted for different listings.

```typescript
// The on-chain tx is verified but not checked for reuse
if (onChainTx) {
  const txInfo = await connection.getTransaction(onChainTx, { ... });
  // Only checks if tx exists and succeeded, not if it was already used
}
```

**Impact:**
- A single on-chain payment could potentially be used to claim multiple purchases if the attacker can craft listings appropriately.
- The listing-level uniqueness check prevents double-purchase of the same listing, but cross-listing replay is theoretically possible.

**Recommended Fix:**
- Store used `onChainTx` signatures in the database with a unique constraint.
- Before accepting a purchase, verify the signature hasn't been used before.
- Parse the on-chain transaction to verify it transfers the correct amount to the correct destination for this specific listing.

---

### B-14: MEDIUM -- Buyback Swap Execution is Simulated

**File:** `/home/user/App-Market/lib/buyback.ts`, lines 189-201

**Description:**
The Jupiter swap execution function returns simulated results:

```typescript
async function executeJupiterSwap(quote: any): Promise<{...}> {
  // Placeholder - in production this would:
  // 1. Call Jupiter swap API with the quote
  // 2. Sign and send the transaction
  // 3. Wait for confirmation

  console.log("[Jupiter] Would execute swap with quote:", quote);

  return {
    success: true,
    tokensReceived: quote.outAmount || 0,
    txSignature: "simulated_tx_" + Date.now(),
  };
}
```

**Impact:**
- If the buyback feature is accidentally enabled (`ENABLE_AUTO_BUYBACK=true`), the system will log fake buyback operations and reset the accumulator without actually performing any swaps.
- Revenue designated for buyback would be silently lost (accumulator resets to 0 on "success").
- The fake `txSignature` value would be stored in any auditing system.

**Recommended Fix:**
- Return `success: false` from the placeholder implementation so the accumulator is never reset.
- Add a clear guard: if the implementation is a placeholder, refuse to execute.
- Add feature flag validation that checks implementation completeness before enabling.

---

### B-15: LOW -- Vanity Keypair Generation Runs Synchronously Server-Side

**File:** `/home/user/App-Market/app/api/token-launch/route.ts`, lines 127-134

**Description:**
The `grindVanityKeypair` function runs a CPU-intensive brute-force loop (up to 10 million iterations) synchronously on the server's event loop:

```typescript
vanityKeypair = grindVanityKeypair(vanitySuffix);
```

**Impact:**
- For a 3-character suffix like "app", this typically takes seconds but can occasionally take much longer.
- During grinding, the server's event loop is blocked, preventing all other requests from being processed.
- An attacker could trigger multiple concurrent token launch requests to DoS the server.

**Recommended Fix:**
- Run vanity key generation in a worker thread or a separate background process.
- Pre-grind a pool of vanity keypairs and store them encrypted in the database.
- Add rate limiting on the token launch endpoint (already partially addressed by session authentication).

---

### B-16: LOW -- ExportKeyModal Private Key Handling

**File:** `/home/user/App-Market/components/wallet/ExportKeyModal.tsx`, line 35

**Description:**
The component uses a React `useRef` instead of `useState` to store the private key, with a comment explaining why:

```typescript
// Don't store the private key in React state - it persists in React DevTools
// Use a ref instead so it doesn't appear in component inspection
const privateKeyRef = useRef<string | null>(initialPrivateKey);
```

The key is cleared on modal close (line 72), which is good practice.

**Impact:**
- While using a ref is better than state for security-sensitive data, the key is still in JavaScript heap memory and accessible via browser developer tools, memory dumps, or browser extensions.
- The clipboard copy (line 42) leaves the key in the system clipboard, potentially accessible to other applications.

**Recommended Fix:**
- This is a reasonable approach given browser constraints. The key clearing on close is good.
- Consider adding a timeout that auto-hides the key after 30-60 seconds.
- Warn users to clear their clipboard after copying.
- Consider implementing a "copy and clear" pattern that also clears the clipboard after a timeout.

---

### B-17: LOW -- Multiple Files Fall Back to Devnet RPC

**File:** `/home/user/App-Market/app/api/purchases/route.ts`, line 67; `/home/user/App-Market/lib/pool-watcher.ts`, line 3

**Description:**
Several server-side files fall back to devnet or mainnet public RPCs when `NEXT_PUBLIC_SOLANA_RPC_URL` is not set:

```typescript
// purchases/route.ts (server-side!)
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// pool-watcher.ts
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
```

Note that `lib/solana.ts` correctly throws in production when the env var is missing, but these files bypass that check.

**Impact:**
- In production, if the env var is temporarily unset, purchase verification could silently switch to devnet.
- Pool watching could switch to the rate-limited public mainnet RPC.

**Recommended Fix:**
- All server-side code should use `getConnection()` from `lib/solana.ts`, which properly throws in production.
- Remove inline fallbacks from individual route handlers.

---

### B-18: LOW -- Floating-Point Precision Loss in Token Unit Conversion

**File:** `/home/user/App-Market/lib/solana.ts`, line 251

**Description:**
The `toTokenUnits` function uses floating-point multiplication:

```typescript
export const toTokenUnits = (amount: number, currency: "SOL" | "APP" | "USDC"): BN => {
  const decimals = TOKEN_DECIMALS[currency];
  return new BN(Math.floor(amount * Math.pow(10, decimals)));
};
```

For SOL with 9 decimals, `amount * 10^9` can lose precision for certain fractional values due to IEEE 754 floating-point representation.

**Impact:**
- Users could lose or gain small fractions of a lamport due to rounding.
- For large amounts, the error could be up to several lamports.
- The `solToLamports` function in the same file correctly handles this using string manipulation (lines 115-118).

**Recommended Fix:**
Use the same string-based approach as `solToLamports` for all token unit conversions, or use a decimal library:

```typescript
export const toTokenUnits = (amount: number, currency: "SOL" | "APP" | "USDC"): BN => {
  const decimals = TOKEN_DECIMALS[currency];
  const [whole, decimal = ""] = amount.toString().split(".");
  const paddedDecimal = decimal.padEnd(decimals, "0").slice(0, decimals);
  return new BN(whole + paddedDecimal);
};
```

---

## Positive Security Observations

The following security practices are noteworthy and well-implemented:

### Smart Contract Security
1. **Checks-Effects-Interactions pattern**: The Rust smart contract consistently follows the CEI pattern, performing all checks before state mutations, and external calls last.
2. **Overflow protection**: All arithmetic operations use `checked_add`, `checked_sub`, `checked_mul`, `checked_div` or `saturating_add` to prevent integer overflow.
3. **Anti-sniping protection**: The auction implements a 15-minute anti-snipe window with automatic extension, preventing last-second bid manipulation.
4. **Withdrawal pattern**: Instead of directly refunding outbid users (which can fail with a malicious contract), the program uses a pull-based withdrawal pattern via `PendingWithdrawal` PDAs.
5. **Admin timelock**: Treasury and admin changes require a 48-hour timelock, preventing immediate malicious changes.
6. **Fee locking**: Platform fees are locked at listing creation time, preventing retroactive fee manipulation.
7. **DoS prevention**: Maximum bids per listing (1000), maximum consecutive bids (10), and maximum offers (100) prevent spam attacks.
8. **Initialization front-running prevention**: The `EXPECTED_ADMIN` check prevents unauthorized initialization.

### Encryption
9. **AES-256-GCM for vanity keypairs**: Vanity keypairs stored in the database are encrypted using AES-256-GCM with random salts and IVs, which is industry-standard authenticated encryption.
10. **Separate encryption secret**: The encryption secret is required to be different from `NEXTAUTH_SECRET`.

### Authentication
11. **Ed25519 signature verification**: Wallet authentication uses proper `nacl.sign.detached.verify` for cryptographic signature verification.
12. **Timing-safe webhook verification**: The pool graduation webhook uses `timingSafeEqual` to prevent timing attacks.
13. **Cron secret verification**: Cron endpoints properly verify authorization headers.

### Transaction Safety
14. **Serializable DB transactions**: Purchase operations use `isolationLevel: 'Serializable'` to prevent race conditions.
15. **Transaction status machine**: The smart contract enforces a strict state machine for transaction lifecycle.
16. **Emergency fallback**: 30-day emergency refund and auto-verify mechanisms prevent permanent fund locking if the backend is unresponsive.

---

## Risk Matrix

| Severity | Count | Immediate Action Required |
|----------|-------|--------------------------|
| CRITICAL | 3 | Yes - must fix before mainnet launch |
| HIGH | 5 | Yes - fix within 1 sprint |
| MEDIUM | 6 | Plan for next release cycle |
| LOW | 4 | Address in regular maintenance |

---

## Priority Remediation Plan

### Phase 1: Critical (Block Deployment)
1. **B-01**: Server-side partial signing for mint keypair. Never send secret keys to clients.
2. **B-02**: Implement on-chain escrow release in the auto-release cron. Do not mark as COMPLETED without on-chain confirmation.
3. **B-03**: Fail the purchase if on-chain verification fails. Never silently skip verification.

### Phase 2: High (Fix Before Production Traffic)
4. **B-04**: Replace direct treasury transfers with smart contract escrow instructions.
5. **B-05**: Add slippage protection to initial buy transactions.
6. **B-06**: Separate server-side and client-side RPC endpoints. Remove API keys from NEXT_PUBLIC vars.
7. **B-07**: Implement on-chain escrow release in the transfer confirmation flow.
8. **B-08**: Migrate backend authority key to a secrets manager.

### Phase 3: Medium (Next Sprint)
9. **B-09, B-17**: Remove hardcoded fallbacks; fail hard on missing configuration.
10. **B-11**: Add server-side on-chain verification for token launch status updates.
11. **B-13**: Add on-chain tx signature deduplication.
12. **B-14**: Fix buyback placeholder to return failure instead of fake success.

### Phase 4: Low (Maintenance)
13. **B-12, B-15, B-16, B-18**: Address in regular development cycles.
