# Supply Chain Risk Audit Report

**Project:** App-Market
**Date:** 2026-03-06
**Total direct dependencies:** 55 (41 runtime, 14 dev)
**Unique GitHub repositories evaluated:** 37

---

## Executive Summary

This audit evaluated all direct dependencies of the App-Market project against six supply chain risk criteria: single maintainer, unmaintained status, low popularity, high-risk features, past CVEs, and missing security contact.

**Key findings:**

- **4 direct dependencies** have active high/critical CVE advisories (plus transitive paths).
- **1 dependency** (`@solana/spl-token`) sources from an **archived** GitHub repository.
- **13 dependencies** are maintained by a **single individual** (User-owned repos with >85% contributions from one person).
- **19 dependencies** lack a **SECURITY.md** or published security policy.
- **4 dependencies** show signs of **staleness** (no commits in 6+ months).
- **4 dependencies** involve **high-risk features** (native FFI, cryptographic primitives, deserialization).
- The `@privy-io/*` packages have **no public GitHub source repository**, limiting auditability.

Overall supply chain risk is **moderate-to-high**, primarily due to active CVEs in `next` and the `@solana/spl-token` dependency chain, reliance on several single-maintainer cryptographic and utility libraries, and the closed-source nature of the Privy SDKs.

---

## High-Risk Dependencies

| Dependency | GitHub Repo | Risk Factors | Suggested Action |
|---|---|---|---|
| `next` (^14.2.35) | vercel/next.js (138k stars) | **2 High CVEs**: DoS via Image Optimizer (GHSA-9g9p), HTTP deserialization DoS (GHSA-h25m). No SECURITY.md. | Upgrade to `next >=15.5.10` to resolve both CVEs. |
| `@solana/spl-token` (^0.4.1) | solana-labs/solana-program-library (4.2k stars) | **Archived repository**. Transitive high CVE via `bigint-buffer` (buffer overflow GHSA-3gc7). | Migrate to `@solana-program/token` from the active `solana-program` org. |
| `@meteora-ag/dynamic-bonding-curve-sdk` (^1.5.2) | MeteoraAg/dynamic-bonding-curve-sdk (37 stars) | **Low popularity**. **Single dominant maintainer** (95.8% commits). Inherits high CVE from `@solana/spl-token`. No security policy. | Pin version carefully; monitor for updates. Evaluate if SDK can be replaced with direct RPC calls. |
| `sharp` (^0.33.2) | lovell/sharp (32k stars) | **Single maintainer** (96% commits). **High-risk feature**: native FFI binding to libvips C library. No SECURITY.md. | Acceptable given popularity and active maintenance. Ensure libvips is kept updated in deployment. |
| `jose` (^5.2.2) | panva/jose (7.4k stars) | **Single maintainer** (94.7% commits). **High-risk feature**: cryptographic operations (JWT/JWS/JWE). Has SECURITY.md. | Acceptable risk given active maintenance and security policy. Monitor closely. |
| `tweetnacl` (^1.0.3) | dchest/tweetnacl-js (1.9k stars) | **Single maintainer** (97% commits). **High-risk feature**: cryptographic library (NaCl port). No SECURITY.md. Last pushed Aug 2025 (7 months stale). | Replace with `@noble/ed25519` or `@stablelib/nacl` -- more actively maintained with audits. |
| `bcryptjs` (^2.4.3) | dcodeIO/bcrypt.js (3.8k stars) | **Single maintainer** (96% commits). **High-risk feature**: password hashing implementation. No SECURITY.md. | Consider `argon2` (OWASP recommended) or native `bcrypt`. Pin version. |
| `@privy-io/react-auth` (^3.13.0) | No public repo | **No public source code** on GitHub. Cannot audit for vulnerabilities or verify maintainer count. | Accept vendor risk or evaluate alternatives like `@dynamic-labs/sdk-react` or `@web3auth/web3auth`. |
| `@privy-io/server-auth` (^1.32.5) | No public repo | **No public source code**. Same vendor risk as above. | Same as above. |
| `tailwindcss-animate` (^1.0.7) | jamiebuilds/tailwindcss-animate (3k stars) | **Single maintainer** (84.8% commits). **Stale**: last commit Jul 2024 (20 months). No SECURITY.md. | Consider `tw-animate-css` or inline Tailwind animation utilities. |
| `clsx` (^2.1.0) | lukeed/clsx (9.7k stars) | **Single maintainer** (94.5% commits). **Stale**: last commit Jun 2024 (21 months). No SECURITY.md. | Low risk (239-byte codebase). Acceptable, but `tailwind-merge` already covers this use case. |
| `class-variance-authority` (^0.7.0) | joe-bell/cva (6.8k stars) | **Single maintainer** (95.2% commits). Last pushed Dec 2025. No SECURITY.md. | Acceptable given UI-only scope. Monitor for staleness. |
| `next-intl` (^4.7.0) | amannn/next-intl (4.2k stars) | **Single maintainer** (99.1% commits). No SECURITY.md. | Actively maintained. Acceptable risk but extreme bus-factor concern. |
| `next-themes` (^0.2.1) | pacocoursey/next-themes (6.2k stars) | **Single maintainer** (76.3% commits). No SECURITY.md. | Acceptable given narrow scope. |
| `sonner` (^1.4.3) | emilkowalski/sonner (12k stars) | **Single maintainer** (91.9% commits). Last pushed Dec 2025. No SECURITY.md. | Acceptable given UI-only scope. |
| `qrcode.react` (^4.2.0) | zpao/qrcode.react (4.2k stars) | **Single maintainer** (87.4% commits). **Stale**: last pushed Sep 2025 (6 months). No SECURITY.md. | Acceptable given narrow scope. |
| `react-countdown` (^2.3.5) | ndresx/react-countdown (790 stars) | **Single maintainer**. **Low popularity**. **Stale**: last pushed Oct 2024 (17 months). No SECURITY.md. | Replace with a custom countdown hook (trivial to implement). |
| `tailwind-merge` (^2.2.1) | dcastil/tailwind-merge (5.6k stars) | **Single maintainer** (88.3% commits). No SECURITY.md. | Actively maintained. Acceptable risk. |
| `zod` (^3.22.3) | colinhacks/zod (42k stars) | **Single maintainer** (85.2% commits). No SECURITY.md. | Very popular, actively maintained. Acceptable risk. |
| `@solana-program/memo` (^0.10.0) | solana-program/memo (19 stars) | **Low popularity**. Has SECURITY.md. | Org-maintained (Solana Foundation). Acceptable. |
| `@metaplex-foundation/mpl-token-metadata` (^3.2.1) | metaplex-foundation/mpl-token-metadata (244 stars) | **Low popularity**. No SECURITY.md. | Org-maintained. Acceptable for Solana NFT use cases. |

---

## Counts by Risk Factor

| Risk Factor | Count | Notable Dependencies |
|---|---|---|
| **Single maintainer** | 13 | sharp, jose, tweetnacl, bcryptjs, clsx, class-variance-authority, next-intl, next-themes, sonner, qrcode.react, react-countdown, tailwind-merge, zod |
| **No security policy** | 19 | next, @privy-io/*, bcryptjs, tweetnacl, sharp, clsx, class-variance-authority, next-intl, next-themes, sonner, tailwind-merge, tailwindcss-animate, qrcode.react, react-countdown, @meteora-ag/dynamic-bonding-curve-sdk, @upstash/ratelimit, @upstash/redis, @vercel/blob, framer-motion |
| **Active CVEs (high/critical)** | 4 | next (2 CVEs), @solana/spl-token (via bigint-buffer), @meteora-ag/dynamic-bonding-curve-sdk (transitive), eslint-config-next (via glob) |
| **Archived/Deprecated** | 1 | @solana/spl-token (solana-labs/solana-program-library) |
| **Low popularity (<500 stars)** | 3 | @meteora-ag/dynamic-bonding-curve-sdk (37), @solana-program/memo (19), @metaplex-foundation/mpl-token-metadata (244) |
| **Stale (no commits >6 months)** | 4 | clsx (21 months), tailwindcss-animate (20 months), react-countdown (17 months), qrcode.react (6 months) |
| **High-risk features (crypto/FFI)** | 4 | sharp (native FFI), jose (crypto), tweetnacl (crypto), bcryptjs (crypto/hashing) |
| **No public source** | 2 | @privy-io/react-auth, @privy-io/server-auth |

---

## Recommendations

### Critical (Address Immediately)

1. **Upgrade `next` to v15.5.10+** to resolve both active high-severity CVEs (deserialization DoS and Image Optimizer DoS). The current pinned version `^14.2.35` is within the affected range for both advisories.

2. **Migrate away from `@solana/spl-token`** (archived upstream repo). The Solana ecosystem has moved to `@solana-program/token`. The transitive `bigint-buffer` vulnerability (buffer overflow, CVSS 7.5) is a concrete exploit risk with no fix available for the current package.

### High Priority

3. **Audit `@privy-io/*` vendor risk.** These closed-source SDKs cannot be inspected. Request a SOC 2 report or security assessment from Privy. Ensure you have a fallback authentication strategy.

4. **Replace `tweetnacl`** with `@noble/ed25519` or `@stablelib/ed25519`. The current package is single-maintainer, has no security policy, and has been dormant for 7 months. For a cryptographic library handling signing operations, this is elevated risk.

5. **Pin `bcryptjs` version precisely** and monitor for advisories. Single-maintainer cryptographic hashing library with no security policy. Consider migrating to `argon2` (OWASP recommended) if the deployment environment supports it.

### Medium Priority

6. **Replace `react-countdown`** with a lightweight custom hook. The package is low-popularity, single-maintainer, and has been inactive for 17 months.

7. **Replace `tailwindcss-animate`** with `tw-animate-css` or inline Tailwind animation classes. The package has been inactive for 20 months.

8. **Upgrade `eslint-config-next`** to resolve the transitive `glob` command injection CVE (GHSA-5j98).

9. **Add `SECURITY.md` to your own repository** and adopt a dependency update policy using Dependabot or Renovate to automatically flag new CVEs.

### Low Priority

10. **Monitor single-maintainer UI dependencies** (sonner, clsx, class-variance-authority, next-themes, qrcode.react, tailwind-merge). These have low blast radius due to their UI-only scope but high bus-factor risk.

11. **Consider consolidating `clsx` usage** into `tailwind-merge`, reducing the number of single-maintainer utility dependencies.

---

## Suggested Alternatives

| Current | Alternative | Justification |
|---------|-------------|---------------|
| `next@^14.2.35` | `next@>=15.5.10` | Resolves 2 HIGH CVEs |
| `@solana/spl-token` | `@solana-program/token` | Upstream repo archived; successor package available |
| `bcryptjs` | `argon2` | Modern password hashing, actively maintained, OWASP recommended |
| `tweetnacl` | `@noble/ed25519` | Actively maintained, audited, same cryptographic scope |
| `react-countdown` | Custom hook | Trivial to implement, removes single-maintainer dependency |
| `tailwindcss-animate` | `tw-animate-css` | Actively maintained alternative |
| `eslint-config-next@^14` | `eslint-config-next@>=16` | Resolves glob command injection CVE |

---

*Report generated by Supply Chain Risk Auditor -- 2026-03-06*
