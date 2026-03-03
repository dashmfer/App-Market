# Supply Chain Risk Audit Report

**Project:** App-Market
**Audit Date:** 2026-03-01
**Total Direct Dependencies:** 52 (41 production, 11 dev)
**npm audit findings:** 20 vulnerable dependency paths (6 high, 2 moderate, rest transitive)

---

## Executive Summary

This audit evaluates supply chain risk for all direct dependencies in the App-Market project, with
particular focus on Solana/blockchain packages, authentication libraries, cryptographic packages,
and less well-known utilities. The project maintains a generally healthy dependency profile with
several notable mitigations already in place (e.g., the elliptic shim replacing a known-vulnerable
library). However, several areas require attention.

### Risk Rating Scale

| Rating | Meaning |
|--------|---------|
| **CRITICAL** | Immediate action required -- active CVE, compromised package, or deprecated with known exploits |
| **HIGH** | Significant risk -- single maintainer on security-sensitive code, unfixable audit findings, stale crypto libraries |
| **MEDIUM** | Moderate risk -- single maintainer on non-security code, stale but stable packages, transitive vulnerabilities |
| **LOW** | Minor concern -- worth monitoring but not immediately actionable |

---

## CRITICAL Risk Findings

### 1. Next.js 14.x -- Active High-Severity CVEs (CRITICAL)

- **Package:** `next` @ 14.2.35
- **Issue:** CVE-2025-29927 (CVSS 9.1) -- Middleware Authorization Bypass via `x-middleware-subrequest` header. Affects all Next.js versions < 14.2.25. The installed version 14.2.35 should include the fix, but verification is needed.
- **Issue:** CVE-2025-66478 / CVE-2025-55182 (CVSS 10.0) -- React Server Components RCE. Requires Next.js 15.x+ with React 19.x to be exploitable. This project uses React 18, so RSC-based attacks are **not directly applicable**.
- **Issue:** npm audit flags `next` with high severity for DoS via Image Optimizer (GHSA-9g9p-9gw9-jx7f) and HTTP request deserialization DoS (GHSA-h25m-26qc-wcjf).
- **Maintainers:** Vercel (well-resourced organization)
- **Recommendation:** Verify that the installed Next.js 14.2.35 includes the CVE-2025-29927 patch (patched versions are >= 14.2.25). Ensure middleware is not the sole authorization layer. Plan migration to Next.js 15.x for ongoing security support.

### 2. @solana/web3.js -- Prior Supply Chain Compromise (CRITICAL -- RESOLVED)

- **Package:** `@solana/web3.js` @ ^1.91.1 (installed: 1.98.4)
- **Issue:** CVE-2024-54134 (CVSS 8.3) -- In December 2024, versions 1.95.6 and 1.95.7 were backdoored via a phishing attack against an npm maintainer. The backdoor exfiltrated private keys through fake CloudFlare headers, leading to $190,000+ in stolen cryptocurrency.
- **Current status:** The installed version 1.98.4 is safe and post-dates the incident. However, this demonstrates the ongoing supply chain risk inherent to the Solana ecosystem.
- **Maintainers:** Solana Labs (solana-devs)
- **Recommendation:** Pin exact versions in lockfile (already done). Monitor for future supply chain incidents. Consider using `npm ci` exclusively in CI/CD. Ensure no private keys are handled in client-side code using this library.

---

## HIGH Risk Findings

### 3. tweetnacl -- Stale Cryptographic Library, Single Maintainer (HIGH)

- **Package:** `tweetnacl` @ ^1.0.3
- **Last published:** 2020-02-10 (over 5 years ago)
- **Maintainer:** Single maintainer (dchest)
- **No known CVEs**, but the library has had no updates in 5+ years
- **Past audit:** Cure53 audit in 2017 found zero issues (exceptionally rare)
- **Cryptographic caveats:** Ed25519 signature malleability, XSalsa20-Poly1305 not key-committing, no guarantee of constant-time execution in JavaScript
- **Risk factors:** Single maintainer on a cryptographic library with no activity. If a vulnerability is discovered, there may be no one to patch it. The library handles Ed25519 operations critical to Solana wallet verification.
- **Recommendation:** Consider migrating to `@noble/ed25519` or `@noble/curves` (actively maintained by paulmillr, audited, used by the project's own elliptic shim). The project already depends on `@noble/curves` via the elliptic shim, making this a natural transition.

### 4. bcryptjs -- Single Maintainer, Security-Sensitive (HIGH)

- **Package:** `bcryptjs` @ ^2.4.3
- **Last published:** 2025-11-02 (v3.0.3, recently active)
- **Maintainer:** Single maintainer (dcode)
- **No known CVEs** for bcryptjs itself (CVE-2020-7689 was for the native `bcrypt` package)
- **Risk factors:** Single maintainer for a password hashing library. Pure JavaScript implementation means no native code risk, but also potentially slower constant-time guarantees than native implementations. The package is a "key ecosystem project" with ~4.7M weekly downloads.
- **Recommendation:** Monitor for maintainer activity. The package was recently updated (Nov 2025), so it is currently active. Consider having a fallback plan to migrate to the native `bcrypt` package or Node.js built-in `crypto.scrypt` if this package becomes unmaintained.

### 5. jose -- Single Maintainer, JWT/JWE Security-Critical (HIGH)

- **Package:** `jose` @ ^5.2.2
- **Last published:** Active (latest 6.1.3)
- **Maintainer:** Single maintainer (panva)
- **Past CVE:** CVE-2022-36083 -- PBKDF2 CPU exhaustion via high p2c count in JWE (fixed in later versions)
- **Weekly downloads:** ~35.8M (key ecosystem project)
- **Risk factors:** Single maintainer for a cryptographic JWT library that handles token verification and encryption. This is a high-value target for supply chain attacks. The maintainer (panva) is prolific and also maintains `openid-client` and `oauth4webapi`, but bus factor remains 1.
- **Recommendation:** Ensure version >= 4.11.4 to include CVE-2022-36083 fix (the installed ^5.2.2 range is safe). Monitor for maintainer continuity. Consider organizational backup plans if maintainer becomes inactive.

### 6. @solana/spl-token -- Unfixable Transitive Vulnerability (HIGH)

- **Package:** `@solana/spl-token` @ ^0.4.1
- **npm audit:** HIGH severity -- transitive dependency on `bigint-buffer` which has a Buffer Overflow vulnerability (GHSA-3gc7-fjrx-p6mg) via `toBigIntLE()` function
- **Fix available:** No (the fix requires changes upstream in `@solana/buffer-layout-utils`)
- **Risk factors:** Buffer overflow in a package that handles financial transaction data on Solana. The vulnerability chain is: `@solana/spl-token` -> `@solana/buffer-layout-utils` -> `bigint-buffer`.
- **Recommendation:** Monitor the Solana SDK team for an updated `@solana/spl-token` that removes the `bigint-buffer` dependency. Consider whether the specific `toBigIntLE()` function is called in your usage paths.

### 7. @meteora-ag/dynamic-bonding-curve-sdk -- Niche Solana DeFi Package (HIGH)

- **Package:** `@meteora-ag/dynamic-bonding-curve-sdk` @ ^1.5.2
- **Maintainers:** 10 maintainers (mostly personal email addresses from Raccoons Labs)
- **npm audit:** HIGH severity (inherits from `@solana/spl-token` -> `bigint-buffer`)
- **No known CVEs** specific to this package
- **Risk factors:**
  - Niche DeFi SDK for Meteora's bonding curve protocol
  - Multiple maintainers with personal email addresses (not organizational emails) increases phishing surface
  - No public security audit documentation found
  - Handles financial transaction construction for token bonding curves
  - The large number of maintainers (10) on a relatively niche package increases the attack surface -- any compromised account could push malicious code
- **Recommendation:** Pin to exact versions. Audit the package code before upgrades. Consider whether you can reduce the dependency surface by extracting only the needed transaction-building logic.

---

## MEDIUM Risk Findings

### 8. next-auth v4 -- Approaching End of Life (MEDIUM)

- **Package:** `next-auth` @ ^4.24.6 (installed: 4.24.13)
- **Status:** NextAuth v4 is effectively superseded by Auth.js v5. Some v4 versions are marked as "bad releases."
- **Maintainers:** Active team (nextauthjs organization)
- **Risk factors:** While still receiving patch updates, the project's focus has shifted to Auth.js v5. The `@auth/prisma-adapter` dependency (^2.11.1) is designed for v5, creating a potential version mismatch risk.
- **CVE exposure:** If middleware-based auth is used, CVE-2025-29927 (Next.js middleware bypass) could allow authorization bypass. This is a Next.js issue, not next-auth, but the integration point is critical.
- **Recommendation:** Plan migration to Auth.js v5 (`next-auth@5`). Ensure authorization checks are not solely in Next.js middleware. Verify `@auth/prisma-adapter` compatibility with next-auth v4.

### 9. @metaplex-foundation/mpl-token-metadata -- Stale Release (MEDIUM)

- **Package:** `@metaplex-foundation/mpl-token-metadata` @ ^3.2.1
- **Last published:** Over 1 year ago (latest 3.4.0)
- **Maintainers:** 5 (Metaplex Foundation team)
- **No known CVEs** (0 active CVE issues per Cloudsmith Navigator)
- **Risk factors:** Not a healthy release cadence. The package handles Solana NFT/token metadata operations. Metaplex has been known to deprecate and restructure their SDK packages. Has a bug bounty program.
- **Recommendation:** Monitor for deprecation notices. The Metaplex ecosystem has undergone several SDK restructurings -- ensure this package version remains compatible with current on-chain programs.

### 10. sonner -- Single Maintainer (MEDIUM)

- **Package:** `sonner` @ ^1.4.3
- **Maintainer:** Single maintainer (emilkowalski)
- **Risk factors:** Single maintainer, UI toast library. Low security impact since it only renders notifications, but supply chain compromise could inject malicious UI elements.
- **Recommendation:** Low priority. Monitor for ownership changes.

### 11. class-variance-authority -- Single Maintainer (MEDIUM)

- **Package:** `class-variance-authority` @ ^0.7.0
- **Last published:** 2024-11-26 (v0.7.1)
- **Maintainer:** Single maintainer (joebell93)
- **Risk factors:** Single maintainer on a CSS utility library. Low direct security impact.
- **Recommendation:** Low priority. The package is widely used in shadcn/ui projects.

### 12. tailwindcss-animate -- Single Maintainer, Stale (MEDIUM)

- **Package:** `tailwindcss-animate` @ ^1.0.7
- **Last published:** 2023-08-28 (over 2 years ago)
- **Maintainer:** Single maintainer (thejameskyle -- James Kyle)
- **Risk factors:** Stale package with single maintainer. James Kyle is a well-known developer (creator of Babel, Yarn, etc.), reducing impersonation risk, but the package has not been updated in over 2 years.
- **Recommendation:** Low priority. The package is a simple Tailwind plugin with minimal attack surface.

### 13. react-countdown -- Single Maintainer, Infrequent Updates (MEDIUM)

- **Package:** `react-countdown` @ ^2.3.5
- **Last published:** 2024-08-10 (v2.3.6)
- **Maintainer:** Single maintainer (ndresx)
- **Risk factors:** Single maintainer, infrequent updates (12 versions over 9 years). Low security impact -- renders countdown timers only.
- **Recommendation:** Low priority. Monitor for abandonment.

### 14. qrcode.react -- Single Maintainer (MEDIUM)

- **Package:** `qrcode.react` @ ^4.2.0
- **Maintainer:** Single maintainer (zpao -- Paul O'Shannessy, former React team member at Facebook)
- **Risk factors:** Single maintainer. QR code generation could theoretically be exploited if the library were compromised to generate malicious QR codes (e.g., redirecting to phishing URLs). However, the maintainer has a strong reputation.
- **Recommendation:** Low priority. The maintainer's identity and background reduce impersonation risk.

### 15. sharp -- Native Binary, Past CVEs (MEDIUM)

- **Package:** `sharp` @ ^0.33.2
- **Past CVEs:**
  - CVE-2022-29256: Install-time command injection via PKG_CONFIG_PATH (fixed in 0.30.5)
  - CVE-2023-4863: libwebp buffer overflow (fixed in 0.32.6)
  - Shai-Hulud supply chain attack (Sep 2025) -- sharp was among compromised packages
- **Risk factors:** Native binary package with prebuilt binaries downloaded at install time. This is an inherent supply chain risk point. The installed version ^0.33.2 post-dates all known CVEs.
- **Recommendation:** Ensure version >= 0.33.2 (already satisfied). Consider using `--ignore-scripts` and validating binary checksums in CI/CD.

### 16. remotion / @remotion/* -- Single Maintainer, Code Execution (MEDIUM)

- **Package:** `remotion` @ ^4.0.417, `@remotion/bundler`, `@remotion/cli`
- **Maintainer:** Single maintainer (jonny -- Jonny Burger)
- **npm audit:** LOW severity (transitive webpack SSRF and serialize-javascript RCE issues)
- **Risk factors:** Remotion bundles and executes code for video rendering. The `@remotion/bundler` uses webpack which has transitive vulnerabilities. Single maintainer on a package that inherently involves code execution (video rendering via headless browser).
- **Recommendation:** Update to latest Remotion version to pick up webpack fixes. Ensure video rendering runs in a sandboxed environment. Remotion is a well-known, funded project (Remotion GmbH), reducing abandonment risk.

---

## LOW Risk Findings

### 17. next-intl -- Single Maintainer (LOW)

- **Package:** `next-intl` @ ^4.7.0
- **Maintainer:** Single maintainer (amann -- Jan Amann)
- **Risk:** Single maintainer on an i18n library. Low security impact.

### 18. next-themes -- Two Maintainers (LOW)

- **Package:** `next-themes` @ ^0.2.1
- **Maintainers:** 2 (paco, trm217)
- **Last published:** 2025-03-11 (v0.4.6, actively maintained)
- **Risk:** Small maintainer team. Low security impact -- CSS theme toggling only.

### 19. bs58 -- Crypto Utility, Multiple Maintainers (LOW)

- **Package:** `bs58` @ ^5.0.0
- **Maintainers:** 7 (cryptocoinjs organization)
- **Risk:** Multiple maintainers reduces bus factor. Base58 encoding is a simple, well-understood algorithm. Used for Solana address encoding.

### 20. @privy-io/react-auth & @privy-io/server-auth (LOW)

- **Packages:** `@privy-io/react-auth` @ ^3.13.0, `@privy-io/server-auth` @ ^1.32.5
- **Maintainers:** 8-9 (Privy team with organizational emails)
- **Security posture:** Strong -- 6 completed third-party audits (Cure53, Zellic, SwordBytes, Doyensec, Borg Security), SOC 2 Type II certification (Dec 2024), active HackerOne bug bounty, open-source cryptographic libraries.
- **No known CVEs**
- **Risk:** Low. Well-funded company with strong security practices. The main residual risk is vendor lock-in and dependency on a third-party authentication service.

---

## Positive Security Measures Already in Place

### Elliptic Shim (Commendable)

The project replaces the vulnerable `elliptic` npm package with a local shim (`lib/elliptic-shim/`) backed by `@noble/curves`. This addresses:
- **CVE-2024-48949**: Signature verification bypass in elliptic
- **CVE-2024-21483**: Additional elliptic vulnerability

The shim correctly delegates all cryptographic operations to the audited `@noble/curves` library while maintaining API compatibility. This is an excellent supply chain risk mitigation.

### Lucide Shim

The lucide-react override (`lib/lucide-shim/`) provides a compatibility layer, reducing exposure to breaking changes from upstream.

### Lodash Override

The `lodash` override to `^4.17.23` ensures the latest patched version is used, addressing the well-known prototype pollution vulnerabilities in older lodash versions.

---

## Summary of Actionable Recommendations

### Immediate (CRITICAL/HIGH)

1. **Verify Next.js patch level** -- Confirm 14.2.35 includes the CVE-2025-29927 middleware bypass fix
2. **Migrate tweetnacl to @noble/ed25519** -- Eliminate stale single-maintainer cryptographic dependency
3. **Monitor @solana/spl-token** for bigint-buffer fix -- Buffer overflow in financial transaction code
4. **Pin @meteora-ag/dynamic-bonding-curve-sdk** to exact version -- Reduce exposure to compromised maintainer accounts

### Short-term (MEDIUM)

5. **Plan next-auth v4 to Auth.js v5 migration** -- v4 is approaching end of life
6. **Update Remotion packages** to latest to resolve transitive webpack/serialize-javascript vulnerabilities
7. **Run npm audit fix** to resolve the 12 fixable vulnerabilities
8. **Ensure sharp runs in CI with checksum verification** for native binaries

### Ongoing Monitoring

9. **Subscribe to GitHub Security Advisories** for all Solana ecosystem packages
10. **Enable npm provenance checking** when available for critical packages
11. **Consider using Socket.dev or Snyk** for continuous dependency monitoring
12. **Implement lockfile-only installs** (`npm ci`) in all CI/CD pipelines to prevent supply chain injection

---

## Appendix: Full npm audit Summary

| Package | Severity | Issue | Fix Available |
|---------|----------|-------|---------------|
| next | High | DoS via Image Optimizer, HTTP deserialization DoS | Yes (major upgrade to 16.x) |
| bigint-buffer (via @solana/spl-token) | High | Buffer Overflow in toBigIntLE() | No |
| axios (transitive) | High | DoS via __proto__ in mergeConfig | Yes |
| glob (transitive) | High | Command injection via --cmd | Yes (major upgrade) |
| serialize-javascript (transitive) | High | RCE via RegExp.flags | Yes (major mocha upgrade) |
| minimatch (transitive) | High | Multiple ReDoS patterns | Yes |
| ajv (transitive) | Moderate | ReDoS with $data option | Yes |
| bn.js (transitive) | Moderate | Infinite loop | Yes |
| webpack (via @remotion/bundler) | Low | SSRF via buildHttp | Yes |
| hono (transitive) | Low | Timing comparison in basicAuth | Yes |

---

## Appendix: Dependency Maintainer Count

| Package | Maintainer Count | Security Sensitivity |
|---------|-----------------|---------------------|
| tweetnacl | 1 | Cryptographic (Ed25519) |
| bcryptjs | 1 | Password hashing |
| jose | 1 | JWT/JWE operations |
| sonner | 1 | UI only |
| class-variance-authority | 1 | CSS utility |
| tailwindcss-animate | 1 | CSS utility |
| react-countdown | 1 | UI only |
| qrcode.react | 1 | QR generation |
| remotion | 1 | Code execution (video) |
| next-intl | 1 | i18n |
| next-themes | 2 | CSS theming |
| @coral-xyz/anchor | 2 | Solana framework |
| @metaplex-foundation/mpl-token-metadata | 5 | Solana NFT metadata |
| bs58 | 7 | Base58 encoding |
| @privy-io/react-auth | 9 | Authentication |
| @meteora-ag/dynamic-bonding-curve-sdk | 10 | DeFi transactions |
| @solana/web3.js | Solana Labs | Blockchain core |
| next | Vercel | Web framework |

---

*Report generated by supply chain risk auditor. Findings are based on publicly available information
from npm registry, GitHub Advisory Database, Snyk, Socket.dev, NVD, and web research as of 2026-03-01.*
