# Dependency Vulnerability Scan Report

**Project:** App-Market
**Date:** 2026-03-05
**Scan scope:** npm (JavaScript/TypeScript) and Cargo (Rust) dependencies

---

## Executive Summary

| Ecosystem | Total Dependencies | Vulnerabilities Found | Critical | High | Moderate | Low |
|-----------|-------------------|-----------------------|----------|------|----------|-----|
| npm       | 2,278             | 8                     | 0        | 8    | 0        | 0   |
| Cargo     | ~200+             | 2 (known advisories)  | 0        | 1    | 1        | 0   |

**Overall risk: MODERATE.** The npm audit surfaces 8 high-severity findings, but 5 of them relate to a single transitive chain (`bigint-buffer` via Solana SDKs) with no upstream fix available. The Rust-side `ed25519-dalek` 1.0.1 and `curve25519-dalek` 3.2.1 are pinned by `anchor-lang 0.29.0` and carry known advisories. The npm overrides and local shim packages are correctly configured and functioning.

---

## 1. npm Audit Findings (`npm audit --json`)

### 1.1 Vulnerabilities with No Fix Available

#### GHSA-3gc7-fjrx-p6mg -- bigint-buffer Buffer Overflow (HIGH)

- **Package:** `bigint-buffer` (all versions <= 1.1.5)
- **CVSS:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
- **CWE:** CWE-120 (Buffer Overflow)
- **Chain:** `bigint-buffer` -> `@solana/buffer-layout-utils` -> `@solana/spl-token` -> `@meteora-ag/dynamic-bonding-curve-sdk`
- **Impact:** Denial-of-service via crafted input to `toBigIntLE()`. This is a server-side concern if processing untrusted Solana transaction data; in a browser wallet context the risk is lower.
- **Fix status:** No fix available upstream. The `bigint-buffer` package is abandoned. The Solana team has not yet migrated `@solana/spl-token` away from `@solana/buffer-layout-utils`.
- **Recommendation:** Monitor for `@solana/spl-token` v0.5+ which may drop this dependency. Consider using `@solana/spl-token` from the newer `@solana/kit` monorepo if compatible.

This single root vulnerability produces **5 of the 8 total findings** (bigint-buffer, @solana/buffer-layout-utils, @solana/spl-token, @meteora-ag/dynamic-bonding-curve-sdk, and the transitive count).

### 1.2 Vulnerabilities with Fix Available (Semver Major)

#### GHSA-9g9p-9gw9-jx7f -- Next.js Image Optimizer DoS (MODERATE)

- **Package:** `next` (installed: 14.2.35, affected: >= 10.0.0 < 15.5.10)
- **CVSS:** 5.9
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-770
- **Impact:** DoS via `remotePatterns` configuration in self-hosted deployments. If deployed on Vercel, Vercel's infrastructure mitigates this.
- **Fix:** Upgrade to `next >= 15.5.10` (semver major from 14.x).

#### GHSA-h25m-26qc-wcjf -- Next.js RSC Deserialization DoS (HIGH)

- **Package:** `next` (installed: 14.2.35, affected: >= 13.0.0 < 15.0.8)
- **CVSS:** 7.5
- **CWE:** CWE-400, CWE-502 (Deserialization of Untrusted Data)
- **Impact:** DoS when using insecure React Server Components patterns. This project uses Next.js 14.x with primarily client-side rendering via Privy auth; risk depends on RSC usage.
- **Fix:** Upgrade to `next >= 15.0.8` (semver major).

#### GHSA-5j98-mcp5-4vw2 -- glob CLI Command Injection (HIGH)

- **Package:** `glob` 10.2.0 - 10.4.5 (via `@next/eslint-plugin-next` via `eslint-config-next`)
- **CVSS:** 7.5
- **Impact:** Command injection via glob's CLI `-c/--cmd` flag. This is only exploitable if the glob CLI is invoked with attacker-controlled arguments, which does not happen in normal ESLint usage. **Low practical risk.**
- **Fix:** Upgrade `eslint-config-next` to 16.x (semver major).

### 1.3 Summary Table

| # | Package | Severity | Installed | Fix | Practical Risk |
|---|---------|----------|-----------|-----|----------------|
| 1 | bigint-buffer | HIGH | 1.1.5 | None | Medium (DoS only) |
| 2 | @solana/buffer-layout-utils | HIGH | * | None (transitive) | Medium |
| 3 | @solana/spl-token | HIGH | 0.4.x | None (transitive) | Medium |
| 4 | @meteora-ag/dynamic-bonding-curve-sdk | HIGH | 1.5.x | None (transitive) | Medium |
| 5 | next | HIGH | 14.2.35 | 15.0.8+ (major) | Medium-High |
| 6 | glob | HIGH | 10.x | 10.5.0+ via eslint-config-next 16.x | Low |
| 7 | @next/eslint-plugin-next | HIGH | 14.x | eslint-config-next 16.x | Low |
| 8 | eslint-config-next | HIGH | 14.2.35 | 16.1.6 (major) | Low |

---

## 2. Cargo (Rust) Dependency Analysis

### 2.1 Crate Versions of Interest

| Crate | Locked Version | Latest Stable | Advisory |
|-------|---------------|---------------|----------|
| curve25519-dalek | 3.2.1 | 4.1.x | RUSTSEC-2024-0344 (timing side-channel) |
| ed25519-dalek | 1.0.1 | 2.1.x | RUSTSEC-2022-0093 (double public key signing, severity varies) |
| anchor-lang | 0.29.0 | 0.30.x | Pins ed25519-dalek 1.x |
| solana-program | 1.18.26 | 2.x | Pins curve25519-dalek 3.x |
| borsh | 0.9.3 / 0.10.4 / 1.6.0 | 1.6.x | No known advisories for these versions |

### 2.2 Known Advisories

#### RUSTSEC-2022-0093 -- ed25519-dalek: Double Public Key Signing Function Oracle

- **Crate:** `ed25519-dalek` 1.0.1
- **Severity:** Moderate (context-dependent)
- **Impact:** The `sign_prehashed` and `verify_prehashed` functions in ed25519-dalek <= 1.0.1 can be exploited if an attacker can submit signatures with two different public keys. In the context of Solana on-chain programs using Anchor, the Solana runtime handles Ed25519 verification natively and does not use the Rust crate's sign/verify at runtime. **Low practical risk for this project.**
- **Fix:** Requires upgrade to `ed25519-dalek 2.x`, which requires `anchor-lang 0.30+`.

#### RUSTSEC-2024-0344 -- curve25519-dalek: Timing Side-Channel

- **Crate:** `curve25519-dalek` 3.2.1
- **Severity:** High (in theory), Low (in Solana context)
- **Impact:** Potential timing side-channel in scalar multiplication. On-chain Solana programs execute in a deterministic BPF VM where timing attacks are not practical. **Low practical risk for on-chain code.**
- **Fix:** Requires `curve25519-dalek 4.x`, blocked by `solana-program` and `anchor-lang` version constraints.

### 2.3 Assessment

Both Rust advisories are pinned by upstream dependencies (Anchor 0.29.0, Solana Program 1.18). Upgrading requires moving to Anchor 0.30+ and Solana Program 2.x, which is a significant migration. The practical risk is low because:

1. Solana's BPF runtime handles Ed25519 verification natively, not through the Rust crate
2. Timing side-channels are not exploitable in the deterministic BPF execution environment
3. The `sign_prehashed` API is not used in typical Anchor programs

---

## 3. Outdated Dependencies with Security Implications

The following outdated packages warrant attention from a security perspective:

| Package | Current | Latest | Security Concern |
|---------|---------|--------|-----------------|
| next | 14.2.35 | 16.1.6 | 2 active advisories (see section 1.2) |
| next-auth | 4.24.13 | 5.x (Auth.js) | v4 is in maintenance mode; v5 rewrites auth handling |
| eslint-config-next | 14.2.35 | 16.1.6 | Transitive glob CLI injection |
| @prisma/client | 5.22.0 | 7.4.2 | No known CVEs but multiple major versions behind |
| bcryptjs | 2.4.3 | 3.0.3 | No known CVEs but major version bump may include fixes |
| zod | 3.22.3 | 4.3.6 | No known CVEs, but 3.22.3 is far behind wanted (3.25.76) |

Other outdated packages (react, tailwindcss, framer-motion, etc.) are behind on major versions but do not have known security advisories.

---

## 4. npm Overrides Correctness Analysis

The `package.json` defines the following overrides:

```json
"overrides": {
    "lodash": "^4.17.23",
    "elliptic": "file:./lib/elliptic-shim",
    "lucide-react": "file:./lib/lucide-shim",
    "serialize-javascript": "^7.0.4",
    "axios": "^1.7.8",
    "hono": "^4.12.0"
}
```

### Assessment of Each Override

| Override | Installed Version | Purpose | Status |
|----------|------------------|---------|--------|
| lodash ^4.17.23 | 4.17.23 | Fix prototype pollution (CVE-2021-23337, CVE-2020-28500) | CORRECT -- 4.17.21+ patches these CVEs |
| elliptic -> shim | Shim active | Fix CVE-2024-48949 and CVE-2024-21483 | CORRECT -- shim replaces vulnerable elliptic with @noble/curves |
| lucide-react -> shim | Shim active | Compatibility shim for CloudUpload icon rename | CORRECT -- not security-related, compatibility fix |
| serialize-javascript ^7.0.4 | 7.0.4 | Fix CVE-2024-11831 (XSS via crafted input) | CORRECT -- 7.0.4 patches the vulnerability |
| axios ^1.7.8 | 1.13.6 | Fix CVE-2024-39338 (SSRF) and others | CORRECT -- 1.7.8+ patches SSRF; installed 1.13.6 exceeds minimum |
| hono ^4.12.0 | 4.12.4 | Fix security issues in earlier Hono versions | CORRECT -- 4.12.0+ resolves known issues |

**All overrides are correctly configured and the installed versions satisfy the override constraints.**

The `elliptic` override is confirmed effective: no `elliptic` package directory exists anywhere in `node_modules/`. All consumers that previously depended on `elliptic` (including `@toruslabs/eccrypto`, `@toruslabs/metadata-helpers`, `browserify-sign`, `create-ecdh`, `tiny-secp256k1`, and `@walletconnect/utils`) now resolve to the local shim. npm reports these as "invalid" (expected with file: overrides) but this is cosmetic.

---

## 5. Local Shim Package Analysis

### 5.1 elliptic-shim (`lib/elliptic-shim/`)

**Files:** `package.json`, `index.js`
**Declared version:** 6.6.1 (masquerades as elliptic for compatibility)
**Dependency:** `@noble/curves ^1.8.0` (installed: 1.9.7)

**Security assessment: SAFE**

- The shim does NOT re-export or import the original `elliptic` package anywhere
- It is built entirely on `@noble/curves` (by Paul Miller), which is audited and considered the gold standard for JavaScript elliptic curve cryptography
- The shim provides API-compatible wrappers (EC, KeyPair, Point, Signature, BN classes) that delegate all cryptographic operations to `@noble/curves`
- Supported curves: secp256k1, p256/prime256v1, ed25519
- The `@noble/curves` 1.9.7 has no known vulnerabilities
- The shim correctly handles signature verification by delegating to `@noble/curves`' `verify()`, which is not vulnerable to the original elliptic CVEs (CVE-2024-48949: signature verification bypass, CVE-2024-21483: side-channel)

**One minor note:** The shim's BN class uses JavaScript's native `BigInt`, which is appropriate for non-cryptographic big number handling (key serialization, point coordinate extraction). All actual cryptographic scalar operations go through `@noble/curves` internals.

### 5.2 lucide-shim (`lib/lucide-shim/`)

**Files:** `package.json`, `index.js`, `index.mjs`, `index.d.ts`
**Declared version:** 0.294.0
**Dependency:** `lucide-react-original` (npm alias for `lucide-react@0.294.0`)

**Security assessment: SAFE**

- The shim re-exports all icons from the real `lucide-react` (installed as `lucide-react-original`)
- It adds a single alias: `CloudUpload` mapped to `Upload` (renamed in lucide-react v0.300+)
- This is a compatibility shim for `@privy-io/react-auth`, not a security fix
- `lucide-react@0.294.0` is an icon library with no known security advisories
- The shim does not introduce any cryptographic code or network operations

---

## 6. Recommendations

### Priority 1 -- Address When Feasible

1. **Upgrade Next.js to 15.x+** to resolve GHSA-h25m-26qc-wcjf (RSC deserialization DoS, CVSS 7.5) and GHSA-9g9p-9gw9-jx7f (Image Optimizer DoS). This is a semver major upgrade requiring testing of App Router changes and React 19 compatibility.

2. **Monitor `@solana/spl-token` for bigint-buffer fix.** The Solana team is expected to drop the `@solana/buffer-layout-utils` dependency in a future version. No action possible now.

### Priority 2 -- Plan for Next Development Cycle

3. **Upgrade Anchor to 0.30+** to resolve the `ed25519-dalek` 1.x and `curve25519-dalek` 3.x advisories in Rust dependencies. This requires Solana CLI and program compatibility testing.

4. **Upgrade `eslint-config-next` to 16.x** to resolve the glob CLI command injection advisory. Low practical risk since the glob CLI is never invoked with user-controlled arguments during linting.

5. **Consider upgrading `next-auth` from 4.x to 5.x (Auth.js).** While there are no active CVEs, version 4 is in maintenance mode and will stop receiving security patches.

### Priority 3 -- Low Risk / Monitoring

6. **Keep npm overrides in place.** All six overrides are correctly configured and serving their intended purpose. Review periodically as upstream packages release fixes.

7. **Run `npm audit` on each release** to catch newly disclosed advisories.

8. **Consider adding `cargo-audit` to CI** for automated Rust dependency vulnerability scanning.

---

## Appendix: Raw Data

### npm Audit Metadata

- Total dependencies scanned: 2,278 (1,831 prod, 346 dev, 124 optional)
- Audit report version: 2
- Vulnerabilities: 8 high, 0 critical, 0 moderate, 0 low

### Key Installed Versions

| Package | Installed |
|---------|-----------|
| next | 14.2.35 |
| next-auth | 4.24.13 |
| react | 18.3.1 |
| lodash | 4.17.23 |
| axios | 1.13.6 |
| serialize-javascript | 7.0.4 |
| hono | 4.12.4 |
| @noble/curves | 1.9.7 |
| @solana/web3.js | 1.91.x |
| @solana/spl-token | 0.4.x |

### Rust Crate Versions (from Cargo.lock)

| Crate | Version |
|-------|---------|
| anchor-lang | 0.29.0 |
| anchor-spl | 0.29.0 |
| solana-program | 1.18.26 |
| ed25519-dalek | 1.0.1 |
| curve25519-dalek | 3.2.1 |
| borsh | 0.9.3 / 0.10.4 / 1.6.0 |
