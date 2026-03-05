# Semgrep Static Analysis Report

**Date**: 2026-03-05
**Target**: /home/user/App-Market
**Engine**: Semgrep OSS 1.153.0
**Mode**: Run All
**Rules**: 41 custom security rules (registry unavailable due to proxy restrictions)
**Files Scanned**: 264
**Total Findings**: 1167

---

## Note on Registry Availability

The Semgrep registry (semgrep.dev) was blocked by proxy in this environment. This scan used 41 local custom rules from `security-reports/semgrep-scan/rules/`. For full coverage with `p/security-audit`, `p/secrets`, `p/typescript`, `p/nextjs`, `p/owasp-top-ten`, `p/cwe-top-25`, and third-party rules, run Semgrep in an unrestricted environment.

---

## Findings by Rule

### missing-nosniff-header (759 findings) - WARNING

- `app/api/admin/audit-logs/route.ts:21`
- `app/api/admin/audit-logs/route.ts:31`
- `app/api/admin/audit-logs/route.ts:61`
- `app/api/admin/audit-logs/route.ts:72`
- `app/api/admin/reset-listings/route.ts:48`
- ... and 754 more

### env-variable-direct-access (94 findings) - WARNING

- `app/api/admin/reset-listings/route.ts:9`
- `app/api/auth/twitter/callback/route.ts:8`
- `app/api/auth/twitter/callback/route.ts:9`
- `app/api/auth/twitter/callback/route.ts:11`
- `app/api/auth/twitter/callback/route.ts:11`
- ... and 89 more

### unsafe-type-assertion-any (69 findings) - WARNING

- `app/api/agent/offers/[id]/accept/route.ts:102`
- `app/api/agent/transactions/[id]/confirm/route.ts:120`
- `app/api/cron/check-graduations/route.ts:55`
- `app/api/cron/escrow-auto-release/route.ts:105`
- `app/api/cron/escrow-auto-release/route.ts:134`
- ... and 64 more

### ssrf-dynamic-fetch (68 findings) - WARNING

- `app/api/cron/webhook-retries/route.ts:72`
- `app/api/github/verify/route.ts:47`
- `app/api/github/verify/route.ts:82`
- `app/api/github/verify/route.ts:101`
- `app/api/health/route.ts:39`
- ... and 63 more

### object-keys-no-hasownproperty (56 findings) - WARNING

- `app/api/admin/similarity-scan/route.ts:74`
- `app/api/cron/buyer-info-deadline/route.ts:114`
- `app/api/cron/buyer-info-deadline/route.ts:194`
- `app/api/cron/check-graduations/route.ts:45`
- `app/api/cron/escrow-auto-release/route.ts:97`
- ... and 51 more

### debug-console-log (41 findings) - WARNING

- `scripts/initialize-marketplace.ts:38`
- `scripts/initialize-marketplace.ts:42`
- `scripts/initialize-marketplace.ts:63`
- `scripts/initialize-marketplace.ts:67`
- `scripts/initialize-marketplace.ts:70`
- ... and 36 more

### solana-unvalidated-pubkey (25 findings) - WARNING

- `app/api/cron/check-graduations/route.ts:47`
- `app/api/cron/expire-withdrawals/route.ts:142`
- `app/api/cron/expire-withdrawals/route.ts:143`
- `app/api/token-launch/[id]/route.ts:77`
- `app/api/token-launch/claim-fees/route.ts:77`
- ... and 20 more

### timing-attack-token-comparison (14 findings) - WARNING

- `app/api/admin/reset-listings/route.ts:35`
- `app/api/token-launch/[id]/route.ts:61`
- `app/api/token-launch/[id]/route.ts:62`
- `app/create/page.tsx:552`
- `app/dashboard/messages/page.tsx:172`
- ... and 9 more

### open-redirect-nextresponse (13 findings) - WARNING

- `app/api/auth/twitter/callback/route.ts:50`
- `app/api/auth/twitter/callback/route.ts:56`
- `app/api/auth/twitter/callback/route.ts:64`
- `app/api/auth/twitter/callback/route.ts:75`
- `app/api/auth/twitter/callback/route.ts:93`
- ... and 8 more

### insecure-url-construction (11 findings) - WARNING

- `app/api/agent/webhooks/route.ts:133`
- `app/api/agent/webhooks/route.ts:313`
- `app/api/auth/twitter/callback/route.ts:24`
- `app/api/profile/upload-picture/route.ts:81`
- `app/api/user/profile/image/route.ts:73`
- ... and 6 more

### unsafe-json-parse (8 findings) - WARNING

- `app/api/auth/twitter/callback/route.ts:73`
- `app/api/cron/expire-withdrawals/route.ts:43`
- `app/api/listings/route.ts:487`
- `app/api/token-launch/[id]/route.ts:82`
- `app/api/transactions/[id]/uploads/route.ts:149`
- ... and 3 more

### buffer-from-string (3 findings) - WARNING

- `lib/encryption.ts:74`
- `scripts/rotate-tokens.js:60`
- `scripts/rotate-tokens.ts:61`

### file-upload-no-type-check (2 findings) - WARNING

- `app/api/profile/upload-picture/route.ts:29`
- `app/api/user/profile/image/route.ts:15`

### empty-catch-block (2 findings) - WARNING

- `app/api/profile/upload-picture/route.ts:83`
- `app/api/user/profile/image/route.ts:75`

### prisma-raw-query-injection (1 findings) - ERROR

- `app/api/health/route.ts:20`

### session-no-secure-cookie (1 findings) - WARNING

- `lib/auth.ts:442`

---

## Triage Summary

### True Positives Requiring Action

| Rule | Count | Severity | Notes |
|------|-------|----------|-------|
| prisma-raw-query-injection | 1 | ERROR | In health check route — verify no user input reaches query |
| session-no-secure-cookie | 1 | WARNING | In auth.ts — already conditionally secure (NODE_ENV check) |
| timing-attack-token-comparison | 14 | WARNING | Most are false positives — timingSafeEqual IS used in auth code. Check non-auth comparisons |
| open-redirect-nextresponse | 13 | WARNING | Twitter OAuth callback redirects — verify redirect URLs are validated |
| file-upload-no-type-check | 2 | WARNING | Profile picture uploads — verify MIME type validation |
| unsafe-json-parse | 8 | WARNING | JSON.parse of env vars and DB data — wrap in try/catch |

### Likely False Positives / Informational

| Rule | Count | Notes |
|------|-------|-------|
| missing-nosniff-header | 759 | Custom rule — X-Content-Type-Options IS set globally in next.config.js headers |
| env-variable-direct-access | 94 | Informational — env vars are validated at startup via env-validation.ts |
| unsafe-type-assertion-any | 69 | TypeScript style finding — not a security vulnerability |
| ssrf-dynamic-fetch | 68 | Many are internal API calls or use validated URLs |
| object-keys-no-hasownproperty | 56 | Low risk — code style finding |
| debug-console-log | 41 | Already converted to console.info in prior commit |
| solana-unvalidated-pubkey | 25 | Most pubkeys come from database or are validated upstream |
| buffer-from-string | 3 | Low risk — explicit encoding specified |
| empty-catch-block | 2 | Verify these are intentional |

---

## Recommendations

1. **Run with full registry in CI**: The GitHub Actions CodeQL/Semgrep workflows will have registry access
2. **Triage open-redirect findings**: Verify Twitter OAuth callback validates redirect_uri
3. **Triage SSRF findings**: Verify all dynamic fetch URLs are from trusted sources
4. **Validate file upload MIME types**: Ensure profile picture uploads check Content-Type
5. **Wrap JSON.parse calls**: Add try/catch around all JSON.parse of external data
