# Supply Chain Risk Audit Report

**Project:** App-Market
**Date:** 2026-02-27
**Auditor:** Trail of Bits supply-chain-risk-auditor (automated)
**Scope:** 60 production dependencies, 17 dev dependencies

---

## Executive Summary

The App-Market project has **60 production dependencies** and **17 dev dependencies** spanning the React/Next.js frontend stack, Solana blockchain SDKs, authentication (Privy, NextAuth), UI components (Radix UI, shadcn/ui primitives), and video generation (Remotion). The `npm audit` scan reports **17 known vulnerabilities** (10 high, 2 moderate, 5 low) in the resolved dependency tree.

### Critical Findings

1. **Next.js (^14.2.35)** has been the target of multiple critical CVEs in 2025, including CVE-2025-29927 (middleware authorization bypass, CVSS 9.1) and the React2Shell RCE vulnerability (CVE-2025-55182/CVE-2025-66478, CVSS 10.0). The pinned range `^14.2.35` resolves to a version patched for the middleware bypass and the React2Shell RCE in the 14.x line; however, continuous monitoring is essential as the Next.js 14.x branch is approaching end-of-life.

2. **@solana/web3.js (^1.91.1)** was the subject of a confirmed supply chain attack in December 2024 (CVE-2024-54134, CVSS 8.3) where versions 1.95.6-1.95.7 had a backdoor injected via maintainer credential phishing. The broader Solana npm ecosystem was also targeted in the September 2025 npm supply chain attack. While the current pinned range should resolve to safe versions, the Solana dependency cluster represents the highest supply-chain attack surface in this project.

3. **sharp (^0.33.2)** downloads pre-built native binaries (libvips) at install time via HTTPS. This introduces FFI/native code execution risk and a trust dependency on binary hosting infrastructure. Processing untrusted images through sharp's libvips bindings carries inherent memory-safety risks.

4. **tweetnacl (^1.0.3)** has not been updated in ~6 years (last release: 2020). While it has a perfect safety score and was audited by Cure53 in 2017, its maintenance score is critically low (19/100), and it has a single individual maintainer (dchest).

5. **Dependency overrides** for `lodash`, `elliptic`, and `lucide-react` in `package.json` indicate prior supply-chain or compatibility mitigations but may mask upstream issues if not regularly reviewed.

### Overall Risk Rating: **MODERATE-HIGH**

The combination of blockchain/crypto SDKs (high-value targets for supply chain attacks), a framework with recent critical CVEs (Next.js), native binary downloads (sharp), and several low-maintenance dependencies elevates the overall supply chain risk profile.

---

## High-Risk Dependencies

| Dependency | Version | Risk Factors | Suggested Alternative / Mitigation |
|---|---|---|---|
| **next** | ^14.2.35 | Past CVEs (CVE-2025-29927 CVSS 9.1, CVE-2025-55182 CVSS 10.0, CVE-2025-55184 CVSS 7.5); High-value attack target | Upgrade to latest 14.2.35+ (currently pinned correctly); plan migration to Next.js 15.x LTS; add WAF rules to strip `x-middleware-subrequest` header |
| **@solana/web3.js** | ^1.91.1 | Past supply chain attack (CVE-2024-54134 CVSS 8.3); targeted in Sep 2025 npm attack; high-value crypto target | Pin exact versions; enable npm lockfile integrity checks; monitor Socket.dev alerts |
| **@solana/spl-token** | ^0.4.1 | Depends on vulnerable `bigint-buffer` (buffer overflow, CVSS 7.5) via `@solana/buffer-layout-utils`; no fix available | Monitor upstream for resolution; consider @solana/spl-token v0.5+ if available |
| **sharp** | ^0.33.2 | Native binary download at install (FFI risk); libvips attack surface for untrusted images; pre-built binary trust dependency | Sandbox image processing; use global libvips in production; consider `squoosh` for simpler use cases |
| **tweetnacl** | ^1.0.3 | Single maintainer (dchest); unmaintained (no updates in 6 years); low maintenance score (19/100) | Consider `@noble/ed25519` or `@stablelib/ed25519` for active maintenance |
| **next-auth** | ^4.24.6 | Past CVEs (CVE-2023-27490 session hijack); v4 is in maintenance mode; relies on Next.js middleware (affected by CVE-2025-29927) | Migrate to `@auth/nextjs` (Auth.js v5) for active development and security patches |
| **@remotion/bundler** | ^4.0.417 | Depends on vulnerable webpack versions (SSRF via buildHttp); low-severity but exploitable in build pipeline | Update to @remotion >=4.0.421 when available |
| **@remotion/cli** | ^4.0.417 | Inherits webpack vulnerabilities from @remotion/bundler | Update alongside @remotion/bundler |
| **next-themes** | ^0.2.1 | Single maintainer (pacocoursey); stale (last release ~1 year ago); no v1.0 stable; many unaddressed issues in 2025 | No direct alternative; monitor for abandonment; consider forking if needed |
| **qrcode.react** | ^4.2.0 | Single maintainer (zpao); inactive (no new versions in 12+ months); dependency `qr.js` had repo hijacking incident | Consider `react-qr-code` as an alternative |
| **tailwindcss-animate** | ^1.0.7 | Single maintainer; last published 2+ years ago; no security contact | Consider `tailwindcss-animated` for more active maintenance |
| **react-countdown** | ^2.3.5 | Inactive project per Snyk; last published 2 years ago | Consider `react-timer-hook` or custom implementation |
| **bcryptjs** | ^2.4.3 | Version ^2.4.3 is outdated (v3.0.3 is current with ESM support); single maintainer (dcodeIO) | Upgrade to `bcryptjs@^3.0.3` or use native `bcrypt` for better performance |
| **lucide-react-original** | npm:lucide-react@0.294.0 | Pinned to very old version (0.294.0); current is 0.400+; aliased package name obscures provenance | Update to current lucide-react; remove alias if possible |

---

## Medium-Risk Dependencies

| Dependency | Version | Risk Factors | Notes |
|---|---|---|---|
| **@coral-xyz/anchor** | ^0.29.0 | Part of Solana ecosystem (targeted supply chain); 2 maintainers | Actively maintained; monitor for ecosystem-wide attacks |
| **@metaplex-foundation/mpl-token-metadata** | ^3.2.1 | Solana ecosystem dependency; relies on @solana/web3.js | 5 maintainers; has bug bounty program; healthy release cadence |
| **@meteora-ag/dynamic-bonding-curve-sdk** | ^1.5.2 | Depends on vulnerable @solana/spl-token; niche DeFi SDK | 10 maintainers; healthy releases; monitor for spl-token fix |
| **class-variance-authority** | ^0.7.0 | Single maintainer (joe-bell); pre-1.0 release | v1.0 in beta; widely adopted via shadcn/ui; low risk |
| **remotion** | ^4.0.417 | Single primary maintainer (JonnyBurger); complex build pipeline | High security score (89%); active development; commercial backing |
| **eslint-config-next** (dev) | ^14.2.35 | Depends on vulnerable glob (command injection, CVSS 7.5) | Fix available via upgrade to eslint-config-next@16.x (breaking) |

---

## Low-Risk Dependencies (Well-Maintained)

The following dependencies were assessed as low supply-chain risk due to strong organizational backing, active maintenance, high popularity, and no known vulnerabilities:

- **react** / **react-dom** (^18.2.0) -- Meta-backed; massive ecosystem; note: React 18 is not affected by CVE-2025-55182 (only React 19.x RSC)
- **@radix-ui/\*** (12 packages) -- Workos-backed organization; multiple maintainers; actively maintained
- **@prisma/client** / **prisma** -- Prisma Inc. backed; active development
- **@privy-io/react-auth** / **@privy-io/server-auth** -- Privy Inc. backed; 8 maintainers
- **@octokit/rest** -- GitHub-backed
- **@upstash/redis** / **@upstash/ratelimit** -- Upstash Inc. backed; active maintenance
- **@vercel/blob** -- Vercel Inc. backed
- **zod** -- Highly popular (100M+ weekly downloads); actively maintained
- **zustand** -- Maintained by pmndrs collective; very popular
- **framer-motion** -- Framer-backed; healthy maintenance; no known vulns
- **jose** -- panva-maintained; widely used; only historical CVE (2022, patched)
- **sonner** -- 12.5M weekly downloads; sustainable maintenance
- **date-fns** -- Popular utility; org-backed
- **tailwind-merge** -- Active maintenance; popular in shadcn/ui ecosystem
- **react-hook-form** / **@hookform/resolvers** -- Popular; actively maintained
- **clsx** -- Minimal utility; widely used
- **bs58** -- Healthy release cadence; popular in crypto ecosystem
- **next-intl** -- Actively maintained; good release cadence
- **@solana/wallet-adapter-\*** (4 packages) -- Anza/Solana Foundation-backed; actively maintained

---

## Counts by Risk Factor

| Risk Factor | Count | Affected Dependencies |
|---|---|---|
| **Past CVEs (High/Critical)** | 5 | next, @solana/web3.js, @solana/spl-token, next-auth, eslint-config-next (via glob) |
| **Unmaintained / Stale (12+ months)** | 5 | tweetnacl, next-themes, qrcode.react, tailwindcss-animate, react-countdown |
| **Single Maintainer** | 6 | tweetnacl, next-themes, qrcode.react, tailwindcss-animate, class-variance-authority, bcryptjs |
| **High-Risk Features (FFI/Native)** | 1 | sharp (native binary download, libvips FFI) |
| **No Security Contact / Policy** | 4 | tweetnacl, next-themes, tailwindcss-animate, react-countdown |
| **Outdated Pinned Version** | 2 | bcryptjs (^2.4.3 vs 3.0.3 current), lucide-react-original (0.294.0 vs 0.400+ current) |
| **Dependency Override / Shim** | 3 | lodash (override), elliptic (shimmed), lucide-react (shimmed) |
| **Supply Chain Attack History** | 2 | @solana/web3.js (CVE-2024-54134), broader npm ecosystem (Sep 2025 Shai-Hulud attack) |

---

## npm audit Summary

```
17 vulnerabilities (5 low, 2 moderate, 10 high)
```

| Vulnerability | Severity | Source Package | Direct Dep | Fix Available |
|---|---|---|---|---|
| webpack SSRF (buildHttp bypass) | Low | webpack | @remotion/bundler, @remotion/cli | Yes (update remotion) |
| hono timing comparison | Low | hono | (transitive) | Yes |
| ajv ReDoS ($data option) | Moderate | ajv | (transitive) | Yes |
| bn.js infinite loop | Moderate | bn.js | (transitive via Solana) | Yes |
| bigint-buffer overflow (CVSS 7.5) | High | bigint-buffer | @solana/spl-token | **No fix available** |
| axios DoS via __proto__ (CVSS 7.5) | High | axios | (transitive) | Yes |
| glob command injection (CVSS 7.5) | High | glob | eslint-config-next | Yes (breaking) |
| minimatch ReDoS (multiple CVEs) | High | minimatch | (transitive) | Yes |
| Next.js DoS via Image Optimizer | High | next | next | Yes (npm audit fix --force) |
| Next.js HTTP deserialization DoS | High | next | next | Yes (npm audit fix --force) |

---

## Recommendations

### Immediate Actions (P0)

1. **Verify Next.js version is patched.** Ensure the resolved version of `next` is `>=14.2.35` which includes patches for CVE-2025-29927 and React2Shell (CVE-2025-55182). Run `npm ls next` to confirm. If using self-hosted deployment, add WAF rules to block external `x-middleware-subrequest` headers.

2. **Pin @solana/web3.js to exact known-safe version.** Replace `^1.91.1` with an exact version like `1.98.0` in package-lock.json and enable `npm ci` in CI/CD to prevent version drift. Monitor Socket.dev for real-time supply chain alerts on Solana packages.

3. **Run `npm audit fix`** to resolve the 8 vulnerabilities with available fixes (webpack, hono, ajv, bn.js, axios, minimatch).

4. **Upgrade bcryptjs from ^2.4.3 to ^3.0.3** to get the latest security and ESM improvements.

### Short-Term Actions (P1)

5. **Replace tweetnacl with @noble/ed25519.** The `tweetnacl` package has not been updated since 2020 and has a single maintainer. The `@noble` family of cryptographic libraries are actively maintained, audited, and have become the ecosystem standard for Solana/crypto projects.

6. **Plan migration from next-auth v4 to Auth.js v5** (`@auth/nextjs`). NextAuth v4 is in maintenance mode and its middleware-based auth pattern was directly impacted by CVE-2025-29927. Auth.js v5 has an actively maintained security posture.

7. **Evaluate sharp sandboxing.** If processing user-uploaded images, run sharp in a sandboxed environment (container with seccomp profiles, or a separate microservice) to limit the blast radius of any libvips vulnerability.

8. **Upgrade lucide-react-original** from the pinned `0.294.0` to a current version, or consolidate with the shimmed `lucide-react` to reduce version confusion.

### Long-Term Actions (P2)

9. **Audit dependency overrides quarterly.** The overrides for `lodash`, `elliptic`, and `lucide-react` should be reviewed each quarter to determine if upstream fixes have been released and the overrides can be removed.

10. **Consider replacing stale dependencies:**
    - `qrcode.react` -> `react-qr-code` (more maintainers, active development)
    - `tailwindcss-animate` -> `tailwindcss-animated` (2 maintainers, recent releases)
    - `react-countdown` -> `react-timer-hook` or custom implementation
    - `next-themes` -> monitor; consider forking if it becomes abandoned

11. **Enable npm provenance verification.** Use `npm audit signatures` to verify that packages were built and published via trusted CI/CD pipelines. This would have detected the @solana/web3.js compromise (CVE-2024-54134).

12. **Adopt lockfile-lint or Socket.dev CI integration** to automatically flag new dependencies with supply chain risk indicators (single maintainer, native binaries, install scripts, obfuscated code).

13. **Plan Next.js 15.x migration.** Next.js 14.x will eventually leave the active security support window. The 15.x line receives the most timely patches and has the broadest coverage for the React2Shell family of vulnerabilities.

---

## Dependency Override Analysis

The project uses three dependency overrides that warrant specific attention:

| Override | Value | Risk Assessment |
|---|---|---|
| `lodash` | `^4.17.23` | Forces lodash to >=4.17.23 across all transitive deps. This is a well-known mitigation for prototype pollution CVEs in lodash <4.17.21. **Low risk; keep in place.** |
| `elliptic` | `file:./lib/elliptic-shim` | Replaces the `elliptic` package with a local shim. This is likely a mitigation for the numerous CVEs in the `elliptic` npm package (ECDSA signature malleability, timing attacks). **Requires review: ensure the shim adequately covers all security-relevant functionality.** |
| `lucide-react` | `file:./lib/lucide-shim` | Replaces lucide-react with a local shim, alongside `lucide-react-original` aliased to an old version (0.294.0). **Low security risk but creates maintenance burden; consolidate when feasible.** |

---

## Methodology

This audit evaluated each direct dependency against six risk criteria:

1. **Single maintainer** -- Is the package maintained by a sole individual (not organization-backed)? Is the identity anonymous?
2. **Unmaintained** -- No updates in 12+ months? Deprecated or archived? Unresponsive to issues?
3. **Low popularity** -- Low GitHub stars or npm weekly downloads relative to peers?
4. **High-risk features** -- FFI, deserialization, native code execution, eval, or install scripts?
5. **Past CVEs** -- Known high or critical vulnerabilities?
6. **No security contact** -- Missing SECURITY.md, no responsible disclosure process?

Data sources included: npm registry metadata, `npm audit` output, Socket.dev package analysis, Snyk vulnerability database, NVD/CVE databases, GitHub repository activity, and web search results for recent security incidents.

---

*Report generated by Trail of Bits supply-chain-risk-auditor skill.*
*For questions about this report, contact your security team.*
