# Full-Stack Security Review -- Final Report

**Project:** App-Market (Solana DeFi Marketplace)  
**Date:** 2026-03-05  
**Branch:** `claude/security-scan-all-plugins-5oEGh`  
**Reviewer:** Automated multi-tool security analysis  

---

## Executive Summary

A comprehensive end-to-end security review was performed using 12 parallel analysis tools covering static analysis, dependency scanning, configuration review, cryptographic analysis, entry point mapping, differential review, and architectural assessment.

**Overall assessment: The codebase has strong security fundamentals but the differential review identified 2 critical and 4 high-severity issues introduced by the security fix commits themselves.**

### Critical Findings Requiring Immediate Action

| # | Severity | Finding | Location | Tool |
|---|----------|---------|----------|------|
| 1 | **CRITICAL** | CSP `unsafe-eval` added to production | `next.config.js:78` | Differential Review |
| 2 | **CRITICAL** | (Verify) Client compatibility after mint keypair removal | `api/token-launch/deploy/route.ts` | Differential Review |
| 3 | **HIGH** | Operator precedence bug -- offer accept auth always passes | `api/offers/[offerId]/accept/route.ts:79` | Differential Review |
| 4 | **HIGH** | Operator precedence bug -- self-offer check always blocks | `api/offers/route.ts:82` | Differential Review |
| 5 | **HIGH** | Null guard removed in db-middleware.ts | `lib/db-middleware.ts:36` | Differential Review |
| 6 | **HIGH** | Encryption format change without migration for rotate-tokens | `lib/encryption.ts`, `scripts/rotate-tokens.ts` | Differential Review |
| 7 | **HIGH** | CI workflows pin `snyk/actions` and `trivy-action` to `@master` | `.github/workflows/snyk.yml`, `trivy.yml` | CI Audit |

---

## Scan Results Summary

### 1. Semgrep Static Analysis
- **Engine:** Semgrep OSS 1.153.0 (registry blocked by proxy -- 41 local rules used)
- **Files scanned:** 264
- **Total findings:** 1,167
- **Actionable findings:** ~39 (after filtering false positives from `missing-nosniff-header`, `env-variable-direct-access`, etc.)
- **Key findings:** 1 Prisma raw query potential, 14 timing comparisons (mostly FP), 13 open redirect patterns, 68 SSRF patterns (most validated upstream), 25 unvalidated Solana pubkeys
- **Full report:** `semgrep-scan.md`

### 2. Supply Chain Risk Audit
- **Total dependencies:** 81 npm direct + 257 Rust crates
- **High-risk dependencies:** 10 flagged (2+ risk factors each)
- **Critical:** `bigint-buffer` (archived, CVE, no fix), `next@14` (2 HIGH CVEs), `bcryptjs` (unmaintained crypto)
- **npm audit:** 8 HIGH (5 from bigint-buffer chain, 2 from Next.js, 1 from glob)
- **Overrides:** All 6 correctly configured and effective
- **Shims:** `elliptic-shim` safely replaces vulnerable `elliptic` with `@noble/curves`; `lucide-shim` is safe compatibility wrapper
- **Full report:** `.supply-chain-risk-auditor/results.md`, `dependency-scan.md`

### 3. Insecure Defaults Analysis
- **CRITICAL:** 0
- **MEDIUM:** 2 (CSP `unsafe-inline`/`unsafe-eval`, encryption fallback to plaintext)
- **LOW:** 2 (CSRF secret reuse, Solana address fallbacks)
- **Positive:** All critical secrets fail-closed (NEXTAUTH_SECRET, ENCRYPTION_SECRET, CRON_SECRET, Redis in production)
- **Full report:** `insecure-defaults.md`

### 4. Sharp Edges Analysis
- **CRITICAL:** 0
- **MEDIUM:** 2 (encryption degradation, webhook secret env validation)
- **LOW:** 4 (wallet prefix check, CSRF key reuse, stringly-typed states, keypair JSON parsing)
- **Positive patterns:** Integer arithmetic for finances, timing-safe comparisons, nonce replay protection, admin double-gate, on-chain fee caps
- **Full report:** `sharp-edges.md`

### 5. Differential Review (Security Fix Commits)
- **CRITICAL:** 2 (CSP unsafe-eval, mint keypair client compat)
- **HIGH:** 4 (offer auth bypass, null guard removal, encryption format inconsistency, wallet prefix bypass)
- **MEDIUM:** 6 (removed PUBLIC_API_ROUTES docs, dispute resolution money calc removed, nonce Redis inconsistency, GIF upload, unused retry function, disabled validation logic)
- **LOW:** 4
- **Positive changes:** 15+ security improvements verified (Privy auth hardening, CSRF, BigInt finances, constant-time, open redirect fix, etc.)
- **Full report:** `differential-review.md`

### 6. Entry Point Analysis
- **Total API routes:** ~95 unique paths
- **PUBLIC (no auth):** ~22
- **AUTHENTICATED (session/JWT):** ~55
- **ADMIN (session + isAdmin):** 5
- **CRON (CRON_SECRET):** 9
- **WEBHOOK (WEBHOOK_SECRET):** 1
- **AGENT (API key/wallet sig):** ~22
- **Solana on-chain instructions:** 27 (9 admin with 48hr timelocks)
- **Full report:** `entry-points.md`

### 7. Constant-Time Cryptographic Analysis
- **PASS:** 10 out of 11 comparison sites use timing-safe patterns
- **FAIL (MEDIUM):** `lib/agent-auth.ts:verifyWebhookSignature` lacks length padding (length oracle)
- **Positive:** Consistent `Buffer.alloc` + `copy` padding pattern across all other secret comparisons
- **Full report:** `constant-time.md`

### 8. CI/CD Workflow Audit
- **FAIL:** 2 third-party actions pinned to mutable `@master` branch (supply chain risk)
- **PASS:** No expression injection, no secrets leakage, no pull_request_target, reasonable permissions
- **Observation:** `continue-on-error: true` on Snyk means scan failures don't block PRs
- **Full report:** `ci-workflow-audit.md`

### 9. Dependency Vulnerability Scan
- **npm:** 8 HIGH vulnerabilities (5 unfixable via bigint-buffer chain, 3 fixable with major upgrades)
- **Rust:** 2 advisories (ed25519-dalek, curve25519-dalek -- low practical risk in Solana BPF context)
- **Full report:** `dependency-scan.md`

### 10. Property-Based Testing Analysis
- **Areas identified:** Financial calculations, crypto roundtrips, input validation, state machine transitions, serialization
- **30+ concrete property definitions** with pseudocode for fast.check/fc implementation
- **Full report:** `property-based-testing.md`

### 11. TypeScript Compilation
- **Result:** PASS -- zero errors with `tsc --noEmit`

---

## Priority Remediation Plan

### Immediate (Before Merge)

1. **Fix offer accept auth bypass** (`api/offers/[offerId]/accept/route.ts:79`) -- Add parentheses: `(token.id as string)`
2. **Fix self-offer check** (`api/offers/route.ts:82`) -- Same parenthesization fix
3. **Restore null guard** in `lib/db-middleware.ts:36` -- Add `&& result !== null`
4. **Remove `unsafe-eval` from CSP** or conditionally gate on `NODE_ENV`

### Before Next Release

5. **Pin `snyk/actions/node` and `aquasecurity/trivy-action` to commit SHAs**
6. **Apply length padding to `verifyWebhookSignature`** in `lib/agent-auth.ts`
7. **Update `rotate-tokens.ts` to use `enc:v1:` prefix**
8. **Verify PATO launch modal handles removed `mintKeypairBytes`**
9. **Triage open redirect findings** in Twitter OAuth callback

### Planned (Next Cycle)

10. Upgrade Next.js to 15.x+ (resolves 2 HIGH CVEs)
11. Upgrade Anchor to 0.30+ (resolves Rust crypto advisories)
12. Replace `bcryptjs` with `argon2`
13. Implement nonce-based CSP to remove `unsafe-inline`
14. Add `WEBHOOK_SECRET` and `CSRF_SECRET` to `env-validation.ts`

---

## Reports Index

| Report | File | Size |
|--------|------|------|
| Semgrep Static Analysis | `semgrep-scan.md` | 181 lines |
| Supply Chain Risk Audit | `.supply-chain-risk-auditor/results.md` | comprehensive |
| Insecure Defaults | `insecure-defaults.md` | 130 lines |
| Sharp Edges | `sharp-edges.md` | 181 lines |
| Differential Review | `differential-review.md` | 265 lines |
| Entry Points | `entry-points.md` | 308 lines |
| Constant-Time Analysis | `constant-time.md` | 247 lines |
| CI Workflow Audit | `ci-workflow-audit.md` | 200 lines |
| Dependency Scan | `dependency-scan.md` | 256 lines |
| Property-Based Testing | `property-based-testing.md` | 748 lines |
| Semgrep SARIF | `static_analysis_semgrep_3/results/results.sarif` | 1,167 results |

---

## Tools Used

| Tool | Version | Scope |
|------|---------|-------|
| Semgrep OSS | 1.153.0 | Static analysis (41 custom rules) |
| npm audit | built-in | Dependency vulnerabilities |
| TypeScript compiler | 5.9.3 | Type checking |
| Trail of Bits Skills | 1.0.0-1.2.0 | Supply chain, insecure defaults, sharp edges, constant-time, entry points, property testing, differential review, CI audit |

