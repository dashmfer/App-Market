# Semgrep Security Scan Report

**Scan Date:** 2026-02-27
**Tool:** Semgrep v1.153.0 (OSS Engine)
**Target:** /home/user/App-Market
**Rulesets:** Custom Next.js/TypeScript/Prisma/Solana security rules (41 rules)
**Severity Filter:** WARNING (MEDIUM) and ERROR (HIGH) only

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 1 |
| MEDIUM   | 1201 |
| **Total** | **1202** |

### Findings by Rule

| Rule ID | Severity | Count | CWE |
|---------|----------|-------|-----|
| prisma-raw-query-injection | HIGH | 1 | CWE-89 |
| missing-nosniff-header | MEDIUM | 748 | CWE-693 |
| env-variable-direct-access | MEDIUM | 72 | CWE-20 |
| ssrf-dynamic-fetch | MEDIUM | 68 | CWE-918 |
| unsafe-type-assertion-any | MEDIUM | 67 | CWE-704 |
| debug-console-log | MEDIUM | 67 | CWE-532 |
| object-keys-no-hasownproperty | MEDIUM | 51 | CWE-1321 |
| insecure-url-construction | MEDIUM | 31 | CWE-918 |
| solana-unvalidated-pubkey | MEDIUM | 25 | CWE-20 |
| parseInt-without-radix | MEDIUM | 24 | CWE-20 |
| open-redirect-nextresponse | MEDIUM | 12 | CWE-601 |
| timing-attack-token-comparison | MEDIUM | 12 | CWE-208 |
| empty-catch-block | MEDIUM | 9 | CWE-390 |
| unsafe-json-parse | MEDIUM | 7 | CWE-502 |
| insecure-random | MEDIUM | 4 | CWE-338 |
| file-upload-no-type-check | MEDIUM | 2 | CWE-434 |
| session-no-secure-cookie | MEDIUM | 1 | CWE-614 |
| buffer-from-string | MEDIUM | 1 | CWE-20 |

---

## HIGH Severity Findings

### 1. `prisma-raw-query-injection`

- **File:** `app/api/health/route.ts:20`
- **CWE:** CWE-89
- **Message:** Raw SQL query detected via Prisma. If user input is interpolated into the query string, this can lead to SQL injection. Use parameterized queries with Prisma.sql tagged template literals instead.

```typescript
      18 |   const dbStart = Date.now();
      19 |   try {
>>>   20 |     await prisma.$queryRaw`SELECT 1`;
      21 |     checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
      22 |   } catch (error) {
```

---

## MEDIUM Severity Findings

### Aggregate Findings (Informational)

The following rules produced a high volume of findings. They are listed in aggregate:

#### `missing-nosniff-header` (748 findings)
- **Message:** API response may be missing X-Content-Type-Options header. Set 'nosniff' to prevent MIME type sniffing.
- **Affected files (90):** app/api/admin/audit-logs/route.ts, app/api/admin/reset-listings/route.ts, app/api/admin/similarity-scan/route.ts, app/api/auth/[...nextauth]/route.ts, app/api/auth/register/route.ts, app/api/auth/twitter/connect/route.ts, app/api/auth/twitter/disconnect/route.ts, app/api/auth/wallet/verify/route.ts, app/api/bids/route.ts, app/api/categories/route.ts
  ...and 80 more files

#### `env-variable-direct-access` (72 findings)
- **Message:** Direct access to process.env.ADMIN_SECRET without validation. Environment variables can be undefined at runtime. Use validated configuration or check for undefined values.
- **Affected files (25):** app/api/admin/reset-listings/route.ts, app/api/auth/twitter/callback/route.ts, app/api/auth/twitter/connect/route.ts, app/api/cron/expire-withdrawals/route.ts, app/api/github/verify/route.ts, app/api/health/route.ts, app/api/purchases/route.ts, app/api/transactions/[id]/uploads/route.ts, app/api/webhooks/pool-graduation/route.ts, app/dashboard/page.tsx
  ...and 15 more files

#### `unsafe-type-assertion-any` (67 findings)
- **Message:** Type assertion to 'any' bypasses TypeScript type checking. This can hide type errors that lead to runtime vulnerabilities.
- **Affected files (28):** app/api/agent/offers/[id]/accept/route.ts, app/api/agent/transactions/[id]/confirm/route.ts, app/api/cron/check-graduations/route.ts, app/api/cron/escrow-auto-release/route.ts, app/api/cron/expired-offers/route.ts, app/api/cron/partner-deposit-deadline/route.ts, app/api/cron/seller-transfer-deadline/route.ts, app/api/listings/[slug]/reserve/route.ts, app/api/listings/[slug]/route.ts, app/api/listings/reserved/route.ts
  ...and 18 more files

#### `debug-console-log` (67 findings)
- **Message:** console.log() found in production code. Excessive logging may leak sensitive information. Use a proper logging framework with appropriate log levels.
- **Affected files (18):** app/api/cron/buyer-info-deadline/route.ts, app/api/cron/escrow-auto-release/route.ts, app/api/cron/expire-withdrawals/route.ts, app/api/cron/expired-offers/route.ts, app/api/cron/partner-deposit-deadline/route.ts, app/api/cron/seller-transfer-deadline/route.ts, app/api/cron/super-badge-qualification/route.ts, app/api/transfers/[id]/complete/route.ts, app/dashboard/settings/page.tsx, components/profile/ProfilePictureUpload.tsx
  ...and 8 more files

### Detailed MEDIUM Findings

#### Rule: `ssrf-dynamic-fetch` (68 findings)

- **Message:** Server-side fetch with potentially user-controlled URL. This may lead to SSRF attacks. Validate and allowlist the URL.
- **CWE:** CWE-918

**app/api/cron/webhook-retries/route.ts:72**
```typescript
      70 |         const signature = signWebhookPayload(payloadString, secret);
      71 | 
>>>   72 |         const response = await fetch(delivery.webhook.url, {
>>>   73 |           method: "POST",
>>>   74 |           headers: {
>>>   75 |             "Content-Type": "application/json",
>>>   76 |             "X-Webhook-Signature": signature,
>>>   77 |             "X-Webhook-Timestamp": Date.now().toString(),
>>>   78 |             "User-Agent": "AppMarket-Webhooks/1.0",
>>>   79 |           },
>>>   80 |           body: payloadString,
>>>   81 |           signal: AbortSignal.timeout(10000),
>>>   82 |         });
      83 | 
      84 |         if (response.ok) {
```

**app/api/github/verify/route.ts:37**
```typescript
      35 |     // Use public GitHub API to check if repo exists and is accessible
      36 |     // This doesn't require OAuth - works for public repos
>>>   37 |     const repoResponse = await fetch(
>>>   38 |       `https://api.github.com/repos/${owner}/${repo}`,
>>>   39 |       {
>>>   40 |         headers: {
>>>   41 |           Accept: "application/vnd.github.v3+json",
>>>   42 |           // Use GitHub token from env if available for higher rate limits
>>>   43 |           ...(process.env.GITHUB_TOKEN && {
>>>   44 |             Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
>>>   45 |           }),
>>>   46 |         },
>>>   47 |       }
>>>   48 |     );
      49 | 
      50 |     if (!repoResponse.ok) {
```

**app/api/github/verify/route.ts:72**
```typescript
      70 | 
      71 |     // Get repository contents for file count
>>>   72 |     const contentsResponse = await fetch(
>>>   73 |       `https://api.github.com/repos/${owner}/${repo}/contents`,
>>>   74 |       {
>>>   75 |         headers: {
>>>   76 |           Accept: "application/vnd.github.v3+json",
>>>   77 |           ...(process.env.GITHUB_TOKEN && {
>>>   78 |             Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
>>>   79 |           }),
>>>   80 |         },
>>>   81 |       }
>>>   82 |     );
      83 | 
      84 |     let fileCount = 0;
```

**app/api/github/verify/route.ts:91**
```typescript
      89 | 
      90 |     // Get last commit for update time
>>>   91 |     const commitsResponse = await fetch(
>>>   92 |       `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
>>>   93 |       {
>>>   94 |         headers: {
>>>   95 |           Accept: "application/vnd.github.v3+json",
>>>   96 |           ...(process.env.GITHUB_TOKEN && {
>>>   97 |             Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
>>>   98 |           }),
>>>   99 |         },
>>>  100 |       }
>>>  101 |     );
     102 | 
     103 |     let lastUpdated = "Unknown";
```

**app/api/health/route.ts:39**
```typescript
      37 |       checks.redis = { status: "not_configured" };
      38 |     } else {
>>>   39 |       const resp = await fetch(`${url}/ping`, {
>>>   40 |         headers: { Authorization: `Bearer ${token}` },
>>>   41 |       });
      42 |       if (resp.ok) {
      43 |         checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
```

*...and 63 more occurrences in:*
- `app/api/health/route.ts:64`
- `app/dashboard/collaborations/page.tsx:98`
- `app/dashboard/developer/page.tsx:209`
- `app/dashboard/developer/page.tsx:227`
- `app/dashboard/developer/page.tsx:279`
- `app/dashboard/developer/page.tsx:297`
- `app/dashboard/listings/page.tsx:42`
- `app/dashboard/offers/page.tsx:110`
- `app/dashboard/offers/page.tsx:135`
- `app/dashboard/offers/page.tsx:85`
- `app/dashboard/page.tsx:69`
- `app/dashboard/purchase-partners/page.tsx:154`
- `app/dashboard/transfers/[id]/buyer-info/page.tsx:109`
- `app/dashboard/transfers/[id]/buyer-info/page.tsx:153`
- `app/dashboard/transfers/[id]/page.tsx:255`
- `app/dashboard/transfers/[id]/page.tsx:286`
- `app/dashboard/transfers/[id]/page.tsx:349`
- `app/dashboard/transfers/[id]/page.tsx:393`
- `app/dashboard/transfers/[id]/page.tsx:420`
- `app/dashboard/transfers/[id]/page.tsx:449`
- ...and 43 more

---

#### Rule: `object-keys-no-hasownproperty` (51 findings)

- **Message:** for...in loop iterates over inherited properties. Use Object.keys(), Object.hasOwn(), or hasOwnProperty() check.
- **CWE:** CWE-1321

**app/api/admin/similarity-scan/route.ts:74**
```typescript
      72 |     // Store results in database
      73 |     const storedResults = [];
>>>   74 |     for (const sim of similarities) {
>>>   75 |       // Check if this pair already exists
>>>   76 |       const existing = await prisma.listingSimilarity.findFirst({
>>>   77 |         where: {
>>>   78 |           OR: [
>>>   79 |             { listingId: sim.listingId, similarListingId: sim.similarListingId },
>>>   80 |             { listingId: sim.similarListingId, similarListingId: sim.listingId },
>>>   81 |           ],
>>>   82 |         },
>>>   83 |       });
>>>   84 | 
>>>   85 |       // Map flagLevel to flagType enum
>>>   86 |       const flagType = sim.result.flagLevel === "hard" ? "HARD" : sim.result.flagLevel === "soft" ? "SOFT" : "INFO";
>>>   87 | 
>>>   88 |       if (existing) {
>>>   89 |         // Update existing
>>>   90 |         const updated = await prisma.listingSimilarity.update({
>>>   91 |           where: { id: existing.id },
>>>   92 |           data: {
>>>   93 |             overallSimilarity: sim.result.overallSimilarity,
>>>   94 |             titleSimilarity: sim.result.titleSimilarity,
>>>   95 |             descriptionSimilarity: sim.result.descriptionSimilarity,
>>>   96 |             screenshotSimilarity: sim.result.imageSimilarity,
>>>   97 |             flagType,
>>>   98 |             analyzedAt: new Date(),
>>>   99 |           },
>>>  100 |         });
>>>  101 |         storedResults.push(updated);
>>>  102 |       } else {
>>>  103 |         // Create new
>>>  104 |         const created = await prisma.listingSimilarity.create({
>>>  105 |           data: {
>>>  106 |             listingId: sim.listingId,
>>>  107 |             similarListingId: sim.similarListingId,
>>>  108 |             overallSimilarity: sim.result.overallSimilarity,
>>>  109 |             titleSimilarity: sim.result.titleSimilarity,
>>>  110 |             descriptionSimilarity: sim.result.descriptionSimilarity,
>>>  111 |             screenshotSimilarity: sim.result.imageSimilarity,
>>>  112 |             flagType,
>>>  113 |           },
>>>  114 |         });
>>>  115 |         storedResults.push(created);
>>>  116 |       }
>>>  117 |     }
     118 | 
     119 |     // Get summary
```

**app/api/cron/buyer-info-deadline/route.ts:114**
```typescript
     112 |     };
     113 | 
>>>  114 |     for (const transaction of expiredTransactions) {
>>>  115 |       try {
>>>  116 |         // Idempotency guard: only claim if still PENDING
>>>  117 |         const claimed = await prisma.transaction.updateMany({
>>>  118 |           where: { id: transaction.id, buyerInfoStatus: "PENDING" },
>>>  119 |           data: {
>>>  120 |             fallbackTransferUsed: true,
>>>  121 |             transferMethods: {
>>>  122 |               ...(transaction.transferMethods as object || {}),
>>>  123 |               fallbackReason: "Buyer info deadline passed",
>>>  124 |               fallbackActivatedAt: now.toISOString(),
>>>  125 |             },
>>>  126 |           },
>>>  127 |         });
>>>  128 | 
>>>  129 |         if (claimed.count === 0) continue; // Already processed by concurrent run
>>>  130 | 
>>>  131 |         // Notify buyer that deadline passed
>>>  132 |         await prisma.notification.create({
>>>  133 |           data: {
>>>  134 |             type: "BUYER_INFO_DEADLINE",
>>>  135 |             title: "Buyer Info Deadline Passed",
>>>  136 |             message: `The 48-hour deadline to submit your information for "${transaction.listing.title}" has passed. The seller will use an alternative transfer method.`,
>>>  137 |             data: {
>>>  138 |               transactionId: transaction.id,
>>>  139 |               listingSlug: transaction.listing.slug,
>>>  140 |             },
>>>  141 |             userId: transaction.buyerId,
>>>  142 |           },
>>>  143 |         });
>>>  144 | 
>>>  145 |         // Notify seller that fallback process is active
>>>  146 |         await prisma.notification.create({
>>>  147 |           data: {
>>>  148 |             type: "FALLBACK_TRANSFER_ACTIVE",
>>>  149 |             title: "Fallback Transfer Process Active",
>>>  150 |             message: `The buyer did not submit required information for "${transaction.listing.title}" within 48 hours. Please proceed with the fallback transfer process.`,
>>>  151 |             data: {
>>>  152 |               transactionId: transaction.id,
>>>  153 |               listingSlug: transaction.listing.slug,
>>>  154 |             },
>>>  155 |             userId: transaction.sellerId,
>>>  156 |           },
>>>  157 |         });
>>>  158 | 
>>>  159 |         results.processed++;
>>>  160 |         results.fallbackActivated++;
>>>  161 |         console.log(`[Cron] Buyer info deadline passed for transaction ${transaction.id}`);
>>>  162 |       } catch (error) {
>>>  163 |         results.failed++;
>>>  164 |         const errorMsg = `Failed to process transaction ${transaction.id}: ${error}`;
>>>  165 |         results.errors.push(errorMsg);
>>>  166 |         console.error(`[Cron] ${errorMsg}`);
>>>  167 |       }
>>>  168 |     }
     169 | 
     170 |     // Also send reminders for transactions approaching deadline (6 hours remaining)
```

**app/api/cron/buyer-info-deadline/route.ts:194**
```typescript
     192 | 
     193 |     let remindersSent = 0;
>>>  194 |     for (const transaction of upcomingDeadlines) {
>>>  195 |       // Check if we already sent a 6-hour reminder
>>>  196 |       const existingReminder = await prisma.notification.findFirst({
>>>  197 |         where: {
>>>  198 |           userId: transaction.buyerId,
>>>  199 |           type: "BUYER_INFO_REMINDER",
>>>  200 |           data: {
>>>  201 |             path: ["transactionId"],
>>>  202 |             equals: transaction.id,
>>>  203 |           },
>>>  204 |           createdAt: {
>>>  205 |             gte: new Date(now.getTime() - 7 * 60 * 60 * 1000), // Within last 7 hours
>>>  206 |           },
>>>  207 |         },
>>>  208 |       });
>>>  209 | 
>>>  210 |       if (!existingReminder) {
>>>  211 |         await prisma.notification.create({
>>>  212 |           data: {
>>>  213 |             type: "BUYER_INFO_REMINDER",
>>>  214 |             title: "Reminder: Submit Your Information",
>>>  215 |             message: `You have less than 6 hours to submit required information for "${transaction.listing.title}". After the deadline, the seller will use a fallback transfer method.`,
>>>  216 |             data: {
>>>  217 |               transactionId: transaction.id,
>>>  218 |               listingSlug: transaction.listing.slug,
>>>  219 |               hoursRemaining: 6,
>>>  220 |             },
>>>  221 |             userId: transaction.buyerId,
>>>  222 |           },
>>>  223 |         });
>>>  224 |         remindersSent++;
>>>  225 |       }
>>>  226 |     }
     227 | 
     228 |     return NextResponse.json({
```

**app/api/cron/check-graduations/route.ts:45**
```typescript
      43 |     let graduatedCount = 0;
      44 | 
>>>   45 |     for (const launch of activeLaunches) {
>>>   46 |       try {
>>>   47 |         const poolAddress = new PublicKey(launch.dbcPoolAddress!);
>>>   48 |         const graduated = await hasPoolGraduated(poolAddress);
>>>   49 | 
>>>   50 |         if (graduated) {
>>>   51 |           // Try to get the DAMM pool address from pool state
>>>   52 |           let dammPoolAddress: string | null = null;
>>>   53 |           try {
>>>   54 |             const poolState = await getPoolState(poolAddress);
>>>   55 |             const stateAny = poolState as any;
>>>   56 |             if (stateAny?.migrationDammPool) {
>>>   57 |               dammPoolAddress = stateAny.migrationDammPool.toBase58();
>>>   58 |             } else if (stateAny?.dammPool) {
>>>   59 |               dammPoolAddress = stateAny.dammPool.toBase58();
>>>   60 |             }
>>>   61 |           } catch {
>>>   62 |             // Pool state may not expose DAMM address directly
>>>   63 |           }
>>>   64 | 
>>>   65 |           // Update DB
>>>   66 |           await prisma.tokenLaunch.update({
>>>   67 |             where: { id: launch.id },
>>>   68 |             data: {
>>>   69 |               bondingCurveStatus: "GRADUATED",
>>>   70 |               status: "GRADUATED",
>>>   71 |               graduatedAt: new Date(),
>>>   72 |               dammPoolAddress,
>>>   73 |             },
>>>   74 |           });
>>>   75 | 
>>>   76 |           // Notify the creator
>>>   77 |           if (launch.transaction?.buyerId) {
>>>   78 |             await prisma.notification.create({
>>>   79 |               data: {
>>>   80 |                 userId: launch.transaction.buyerId,
>>>   81 |                 type: "PATO_GRADUATED",
>>>   82 |                 title: "Token Graduated!",
>>>   83 |                 message: `${launch.tokenName} ($${launch.tokenSymbol}) has graduated to the DAMM v2 AMM. Your locked LP is now earning trading fees.`,
>>>   84 |                 data: {
>>>   85 |                   tokenLaunchId: launch.id,
>>>   86 |                   dammPoolAddress,
>>>   87 |                 },
>>>   88 |               },
>>>   89 |             });
>>>   90 |           }
>>>   91 | 
>>>   92 |           graduatedCount++;
>>>   93 |         }
>>>   94 |       } catch (err: any) {
>>>   95 |         console.error(`[Cron] Error checking pool ${launch.dbcPoolAddress}:`, err);
>>>   96 |       }
>>>   97 |     }
      98 | 
      99 |     return NextResponse.json({
```

**app/api/cron/escrow-auto-release/route.ts:97**
```typescript
      95 |     };
      96 | 
>>>   97 |     for (const transaction of eligibleTransactions) {
>>>   98 |       try {
>>>   99 |         // IDEMPOTENCY: Atomically claim this transaction — only succeeds if status is still eligible
>>>  100 |         const claimed = await prisma.transaction.updateMany({
>>>  101 |           where: {
>>>  102 |             id: transaction.id,
>>>  103 |             status: { in: ["TRANSFER_IN_PROGRESS", "AWAITING_CONFIRMATION"] },
>>>  104 |           },
>>>  105 |           data: { status: "COMPLETING" as any },
>>>  106 |         });
>>>  107 | 
>>>  108 |         if (claimed.count === 0) {
>>>  109 |           continue; // Already processed by another cron instance
>>>  110 |         }
>>>  111 | 
>>>  112 |         // Execute on-chain escrow release if we have the authority and listing has on-chain data
>>>  113 |         let onChainTxSig: string | null = null;
>>>  114 |         if (
>>>  115 |           authority &&
>>>  116 |           connection &&
>>>  117 |           transaction.listing.onChainId &&
>>>  118 |           transaction.seller.walletAddress &&
>>>  119 |           transaction.buyer.walletAddress
>>>  120 |         ) {
>>>  121 |           onChainTxSig = await executeOnChainRelease(
>>>  122 |             connection,
>>>  123 |             authority,
>>>  124 |             transaction.listing.onChainId,
>>>  125 |             transaction.seller.walletAddress,
>>>  126 |             transaction.buyer.walletAddress
>>>  127 |           );
>>>  128 | 
>>>  129 |           if (onChainTxSig) {
>>>  130 |             results.onChainSuccess++;
>>>  131 |           } else {
>>>  132 |             // On-chain release failed — revert the status claim so it can retry next run
>>>  133 |             await prisma.transaction.updateMany({
>>>  134 |               where: { id: transaction.id, status: "COMPLETING" as any },
>>>  135 |               data: { status: "AWAITING_CONFIRMATION" },
>>>  136 |             });
>>>  137 |             results.failed++;
>>>  138 |             results.errors.push(
>>>  139 |               `On-chain release failed for ${transaction.id} — will retry next run`
>>>  140 |             );
>>>  141 |             continue;
>>>  142 |           }
>>>  143 |         } else {
>>>  144 |           results.onChainSkipped++;
>>>  145 |         }
>>>  146 | 
>>>  147 |         // Validate salePrice — don't complete transactions with bad financial data
>>>  148 |         const salePrice = Number(transaction.salePrice);
>>>  149 |         if (isNaN(salePrice) || salePrice <= 0) {
>>>  150 |           await prisma.transaction.updateMany({
>>>  151 |             where: { id: transaction.id, status: "COMPLETING" as any },
>>>  152 |             data: { status: "AWAITING_CONFIRMATION" },
>>>  153 |           });
>>>  154 |           results.failed++;
>>>  155 |           results.errors.push(
>>>  156 |             `Invalid salePrice for transaction ${transaction.id}: ${transaction.salePrice} — reverted`
>>>  157 |           );
>>>  158 |           continue;
>>>  159 |         }
>>>  160 | 
>>>  161 |         // Wrap all DB mutations in a transaction for consistency
>>>  162 |         await prisma.$transaction([
>>>  163 |           prisma.transaction.update({
>>>  164 |             where: { id: transaction.id },
>>>  165 |             data: {
>>>  166 |               status: "COMPLETED",
>>>  167 |               transferCompletedAt: now,
>>>  168 |               releasedAt: now,
>>>  169 |               onChainTx: onChainTxSig || undefined,
>>>  170 |             },
>>>  171 |           }),
>>>  172 |           ...(salePrice > 0
>>>  173 |             ? [
>>>  174 |                 prisma.user.update({
>>>  175 |                   where: { id: transaction.sellerId },
>>>  176 |                   data: {
>>>  177 |                     totalSales: { increment: 1 },
>>>  178 |                     totalVolume: { increment: salePrice },
>>>  179 |                   },
>>>  180 |                 }),
>>>  181 |               ]
>>>  182 |             : []),
>>>  183 |           prisma.user.update({
>>>  184 |             where: { id: transaction.buyerId },
>>>  185 |             data: { totalPurchases: { increment: 1 } },
>>>  186 |           }),
>>>  187 |           prisma.notification.create({
>>>  188 |             data: {
>>>  189 |               type: "PAYMENT_RECEIVED",
>>>  190 |               title: "Funds Auto-Released",
>>>  191 |               message: `The transfer for "${transaction.listing.title}" has been automatically confirmed after the confirmation period expired.${onChainTxSig ? " Funds released on-chain." : ""}`,
>>>  192 |               data: {
>>>  193 |                 transactionId: transaction.id,
>>>  194 |                 autoRelease: true,
>>>  195 |                 amount: Number(transaction.sellerProceeds),
>>>  196 |                 onChainTx: onChainTxSig,
>>>  197 |               },
>>>  198 |               userId: transaction.sellerId,
>>>  199 |             },
>>>  200 |           }),
>>>  201 |           prisma.notification.create({
>>>  202 |             data: {
>>>  203 |               type: "TRANSFER_COMPLETED",
>>>  204 |               title: "Transfer Confirmed (Auto)",
>>>  205 |               message: `The transfer for "${transaction.listing.title}" has been automatically confirmed. Funds have been released to the seller.`,
>>>  206 |               data: {
>>>  207 |                 transactionId: transaction.id,
>>>  208 |                 autoRelease: true,
>>>  209 |                 onChainTx: onChainTxSig,
>>>  210 |               },
>>>  211 |               userId: transaction.buyerId,
>>>  212 |             },
>>>  213 |           }),
>>>  214 |         ]);
>>>  215 | 
>>>  216 |         results.released++;
>>>  217 |         console.log(
>>>  218 |           `[Cron:escrow-auto-release] Released transaction ${transaction.id}${onChainTxSig ? ` (on-chain: ${onChainTxSig})` : ""}`
>>>  219 |         );
>>>  220 |       } catch (error) {
>>>  221 |         results.failed++;
>>>  222 |         const errorMsg = `Failed to release transaction ${transaction.id}: ${error}`;
>>>  223 |         results.errors.push(errorMsg);
>>>  224 |         console.error(`[Cron:escrow-auto-release] ${errorMsg}`);
>>>  225 |       }
>>>  226 |     }
     227 | 
     228 |     return NextResponse.json({
```

*...and 46 more occurrences in:*
- `app/api/cron/expire-withdrawals/route.ts:131`
- `app/api/cron/expired-offers/route.ts:60`
- `app/api/cron/partner-deposit-deadline/route.ts:139`
- `app/api/cron/partner-deposit-deadline/route.ts:167`
- `app/api/cron/partner-deposit-deadline/route.ts:80`
- `app/api/cron/seller-transfer-deadline/route.ts:84`
- `app/api/cron/super-badge-qualification/route.ts:110`
- `app/api/cron/super-badge-qualification/route.ts:172`
- `app/api/cron/super-badge-qualification/route.ts:244`
- `app/api/cron/super-badge-qualification/route.ts:303`
- `app/api/cron/webhook-retries/route.ts:39`
- `app/api/listings/[slug]/route.ts:214`
- `app/api/listings/check-similarity/route.ts:82`
- `app/api/listings/route.ts:105`
- `app/api/listings/route.ts:390`
- `app/api/purchases/route.ts:202`
- `app/api/purchases/route.ts:242`
- `app/api/reviews/can-review/route.ts:108`
- `app/api/reviews/can-review/route.ts:83`
- `app/api/reviews/route.ts:179`
- ...and 26 more

---

#### Rule: `insecure-url-construction` (31 findings)

- **Message:** URL constructed from potentially user-controlled input. Validate and sanitize the input to prevent SSRF or open redirect.
- **CWE:** CWE-918

**app/api/admin/audit-logs/route.ts:34**
```typescript
      32 |     }
      33 | 
>>>   34 |     const { searchParams } = new URL(request.url);
      35 |     const action = searchParams.get("action");
      36 |     const severity = searchParams.get("severity");
```

**app/api/admin/reset-listings/route.ts:51**
```typescript
      49 |     }
      50 | 
>>>   51 |     const { searchParams } = new URL(request.url);
      52 |     const listingId = searchParams.get("id");
      53 |     const deleteAll = searchParams.get("all") === "true";
```

**app/api/admin/similarity-scan/route.ts:164**
```typescript
     162 |     }
     163 | 
>>>  164 |     const { searchParams } = new URL(request.url);
     165 |     const flagType = searchParams.get("flagType") || searchParams.get("flagLevel");
     166 |     const page = parseInt(searchParams.get("page") || "1");
```

**app/api/agent/keys/route.ts:185**
```typescript
     183 |     }
     184 | 
>>>  185 |     const { searchParams } = new URL(request.url);
     186 |     const keyId = searchParams.get("id");
     187 | 
```

**app/api/agent/listings/route.ts:27**
```typescript
      25 |     }
      26 | 
>>>   27 |     const { searchParams } = new URL(request.url);
      28 | 
      29 |     const category = searchParams.get("category");
```

*...and 26 more occurrences in:*
- `app/api/agent/transactions/route.ts:27`
- `app/api/agent/watchlist/check/route.ts:26`
- `app/api/agent/watchlist/route.ts:133`
- `app/api/agent/webhooks/[id]/deliveries/route.ts:43`
- `app/api/agent/webhooks/route.ts:133`
- `app/api/agent/webhooks/route.ts:227`
- `app/api/agent/webhooks/route.ts:313`
- `app/api/auth/twitter/callback/route.ts:22`
- `app/api/bids/route.ts:13`
- `app/api/leaderboard/route.ts:6`
- `app/api/listings/[slug]/collaborators/route.ts:302`
- `app/api/listings/[slug]/purchase-partners/route.ts:10`
- `app/api/listings/route.ts:13`
- `app/api/messages/[conversationId]/route.ts:36`
- `app/api/notifications/route.ts:18`
- `app/api/offers/route.ts:194`
- `app/api/reviews/can-review/route.ts:20`
- `app/api/reviews/route.ts:12`
- `app/api/token-launch/route.ts:240`
- `app/api/transactions/[id]/partners/route.ts:214`
- ...and 6 more

---

#### Rule: `solana-unvalidated-pubkey` (25 findings)

- **Message:** Solana PublicKey created from potentially user-controlled input. Validate the input is a proper base58 string and handle errors.
- **CWE:** CWE-20

**app/api/cron/check-graduations/route.ts:47**
```typescript
      45 |     for (const launch of activeLaunches) {
      46 |       try {
>>>   47 |         const poolAddress = new PublicKey(launch.dbcPoolAddress!);
      48 |         const graduated = await hasPoolGraduated(poolAddress);
      49 | 
```

**app/api/cron/expire-withdrawals/route.ts:142**
```typescript
     140 |         ) {
     141 |           try {
>>>  142 |             const listingPubkey = new PublicKey(withdrawal.listing.onChainId);
     143 |             const recipientPubkey = new PublicKey(withdrawal.user.walletAddress);
     144 |             const withdrawalId = parseInt(withdrawal.onChainId);
```

**app/api/cron/expire-withdrawals/route.ts:143**
```typescript
     141 |           try {
     142 |             const listingPubkey = new PublicKey(withdrawal.listing.onChainId);
>>>  143 |             const recipientPubkey = new PublicKey(withdrawal.user.walletAddress);
     144 |             const withdrawalId = parseInt(withdrawal.onChainId);
     145 | 
```

**app/api/token-launch/[id]/route.ts:78**
```typescript
      76 |       try {
      77 |         const poolState = await getPoolState(
>>>   78 |           new PublicKey(tokenLaunch.dbcPoolAddress)
      79 |         );
      80 |         onChainState = {
```

**app/api/token-launch/claim-fees/route.ts:77**
```typescript
      75 |     }
      76 | 
>>>   77 |     const poolAddress = new PublicKey(tokenLaunch.dbcPoolAddress);
      78 | 
      79 |     if (claimType === "creator") {
```

*...and 20 more occurrences in:*
- `app/api/token-launch/claim-fees/route.ts:95`
- `app/api/token-launch/deploy/route.ts:86`
- `app/api/transactions/[id]/uploads/route.ts:181`
- `app/api/webhooks/pool-graduation/route.ts:26`
- `components/listings/bid-modal.tsx:126`
- `lib/cron-helpers.ts:120`
- `lib/cron-helpers.ts:121`
- `lib/cron-helpers.ts:122`
- `lib/cron-helpers.ts:177`
- `lib/cron-helpers.ts:178`
- `lib/cron-helpers.ts:232`
- `lib/cron-helpers.ts:233`
- `lib/meteora-dbc.ts:103`
- `lib/meteora-dbc.ts:116`
- `lib/solana.ts:13`
- `lib/solana.ts:18`
- `lib/solana.ts:23`
- `lib/solana.ts:8`
- `lib/wallet-verification.ts:105`
- `lib/wallet-verification.ts:38`

---

#### Rule: `parseInt-without-radix` (24 findings)

- **Message:** parseInt() called without explicit radix. Always specify radix (e.g., parseInt(input, 10)) to avoid unexpected octal/hex parsing.
- **CWE:** CWE-20

**app/api/admin/audit-logs/route.ts:39**
```typescript
      37 |     const userId = searchParams.get("userId");
      38 |     const targetType = searchParams.get("targetType");
>>>   39 |     const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      40 |     const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
      41 | 
```

**app/api/admin/audit-logs/route.ts:40**
```typescript
      38 |     const targetType = searchParams.get("targetType");
      39 |     const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
>>>   40 |     const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
      41 | 
      42 |     const where: Record<string, unknown> = {};
```

**app/api/admin/similarity-scan/route.ts:166**
```typescript
     164 |     const { searchParams } = new URL(request.url);
     165 |     const flagType = searchParams.get("flagType") || searchParams.get("flagLevel");
>>>  166 |     const page = parseInt(searchParams.get("page") || "1");
     167 |     const limit = parseInt(searchParams.get("limit") || "20");
     168 | 
```

**app/api/admin/similarity-scan/route.ts:167**
```typescript
     165 |     const flagType = searchParams.get("flagType") || searchParams.get("flagLevel");
     166 |     const page = parseInt(searchParams.get("page") || "1");
>>>  167 |     const limit = parseInt(searchParams.get("limit") || "20");
     168 | 
     169 |     const where: any = {};
```

**app/api/cron/expire-withdrawals/route.ts:144**
```typescript
     142 |             const listingPubkey = new PublicKey(withdrawal.listing.onChainId);
     143 |             const recipientPubkey = new PublicKey(withdrawal.user.walletAddress);
>>>  144 |             const withdrawalId = parseInt(withdrawal.onChainId);
     145 | 
     146 |             const instruction = buildExpireWithdrawalInstruction(
```

*...and 19 more occurrences in:*
- `app/api/cron/expired-offers/route.ts:79`
- `app/api/leaderboard/route.ts:8`
- `app/api/listings/route.ts:426`
- `app/api/listings/route.ts:504`
- `app/api/listings/route.ts:506`
- `app/api/notifications/route.ts:20`
- `app/api/reviews/route.ts:16`
- `app/api/reviews/route.ts:17`
- `app/dashboard/developer/page.tsx:544`
- `components/listings/collaborator-input.tsx:586`
- `components/listings/collaborator-input.tsx:602`
- `components/transactions/purchase-partner-input.tsx:229`
- `components/transactions/purchase-partner-input.tsx:239`
- `components/transactions/purchase-partner-input.tsx:295`
- `components/transactions/purchase-partner-input.tsx:396`
- `components/transactions/purchase-partner-input.tsx:403`
- `lib/config.ts:42`
- `lib/validation.ts:123`
- `lib/validation.ts:124`

---

#### Rule: `open-redirect-nextresponse` (12 findings)

- **Message:** Redirect with potentially user-controlled URL. Validate the redirect destination to prevent open redirect attacks.
- **CWE:** CWE-601

**app/api/auth/twitter/callback/route.ts:30**
```typescript
      28 |     if (error) {
      29 |       console.error("Twitter OAuth error:", error);
>>>   30 |       return NextResponse.redirect(
>>>   31 |         `${SITE_URL}/dashboard/settings?twitter_error=${encodeURIComponent(error)}`
>>>   32 |       );
      33 |     }
      34 | 
```

**app/api/auth/twitter/callback/route.ts:36**
```typescript
      34 | 
      35 |     if (!code || !state) {
>>>   36 |       return NextResponse.redirect(
>>>   37 |         `${SITE_URL}/dashboard/settings?twitter_error=missing_params`
>>>   38 |       );
      39 |     }
      40 | 
```

**app/api/auth/twitter/callback/route.ts:44**
```typescript
      42 |     const oauthCookie = request.cookies.get("twitter_oauth_data");
      43 |     if (!oauthCookie) {
>>>   44 |       return NextResponse.redirect(
>>>   45 |         `${SITE_URL}/dashboard/settings?twitter_error=session_expired`
>>>   46 |       );
      47 |     }
      48 | 
```

**app/api/auth/twitter/callback/route.ts:55**
```typescript
      53 |       oauthData = JSON.parse(decryptedData);
      54 |     } catch {
>>>   55 |       return NextResponse.redirect(
>>>   56 |         `${SITE_URL}/dashboard/settings?twitter_error=invalid_session`
>>>   57 |       );
      58 |     }
      59 | 
```

**app/api/auth/twitter/callback/route.ts:62**
```typescript
      60 |     // Verify state matches
      61 |     if (state !== oauthData.state) {
>>>   62 |       return NextResponse.redirect(
>>>   63 |         `${SITE_URL}/dashboard/settings?twitter_error=state_mismatch`
>>>   64 |       );
      65 |     }
      66 | 
```

*...and 7 more occurrences in:*
- `app/api/auth/twitter/callback/route.ts:111`
- `app/api/auth/twitter/callback/route.ts:126`
- `app/api/auth/twitter/callback/route.ts:143`
- `app/api/auth/twitter/callback/route.ts:153`
- `app/api/auth/twitter/callback/route.ts:68`
- `app/api/auth/twitter/callback/route.ts:94`
- `app/api/auth/twitter/connect/route.ts:66`

---

#### Rule: `timing-attack-token-comparison` (12 findings)

- **Message:** String comparison of secret value may be vulnerable to timing attacks. Use crypto.timingSafeEqual() for constant-time comparison.
- **CWE:** CWE-208

**app/api/token-launch/[id]/route.ts:62**
```typescript
      60 |     });
      61 | 
>>>   62 |     const isBuyer = tokenLaunch.transaction.buyerId === session.user.id;
      63 |     const isCreator = tokenLaunch.creatorWallet === user?.walletAddress;
      64 |     const isAdmin = user?.isAdmin;
```

**app/api/token-launch/[id]/route.ts:63**
```typescript
      61 | 
      62 |     const isBuyer = tokenLaunch.transaction.buyerId === session.user.id;
>>>   63 |     const isCreator = tokenLaunch.creatorWallet === user?.walletAddress;
      64 |     const isAdmin = user?.isAdmin;
      65 | 
```

**app/create/page.tsx:560**
```typescript
     558 | 
     559 |     setErrors(newErrors);
>>>  560 |     return Object.keys(newErrors).length === 0;
     561 |   };
     562 | 
```

**app/dashboard/messages/page.tsx:172**
```typescript
     170 | 
     171 |   const handleKeyDown = (e: React.KeyboardEvent) => {
>>>  172 |     if (e.key === "Enter" && !e.shiftKey) {
     173 |       e.preventDefault();
     174 |       handleSend();
```

**app/dashboard/messages/page.tsx:459**
```typescript
     457 |                         value={newMessage}
     458 |                         onChange={(e) => setNewMessage(e.target.value)}
>>>  459 |                         onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendNewMessage()}
     460 |                         placeholder="Write your message..."
     461 |                         className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500"
```

*...and 7 more occurrences in:*
- `app/dashboard/transfers/[id]/buyer-info/page.tsx:323`
- `app/dashboard/transfers/[id]/buyer-info/page.tsx:333`
- `lib/elliptic-shim/index.js:105`
- `lib/elliptic-shim/index.js:118`
- `lib/elliptic-shim/index.js:123`
- `lib/elliptic-shim/index.js:124`
- `lib/similarity-detection.ts:29`

---

#### Rule: `empty-catch-block` (9 findings)

- **Message:** Empty catch block swallows errors silently. At minimum, log the error for debugging purposes.
- **CWE:** CWE-390

**app/api/cron/check-graduations/route.ts:61**
```typescript
      59 |               dammPoolAddress = stateAny.dammPool.toBase58();
      60 |             }
>>>   61 |           } catch {
>>>   62 |             // Pool state may not expose DAMM address directly
>>>   63 |           }
      64 | 
      65 |           // Update DB
```

**app/api/webhooks/pool-graduation/route.ts:61**
```typescript
      59 |       dammPoolAddress = stateAny.dammPool.toBase58();
      60 |     }
>>>   61 |   } catch {
>>>   62 |     // Pool state may not expose DAMM address directly
>>>   63 |   }
      64 | 
      65 |   // Update DB
```

**app/explore/page.tsx:110**
```typescript
     108 |           setWatchlistedIds(ids);
     109 |         }
>>>  110 |       } catch (err) {
>>>  111 |         // Silently fail - user might not be logged in
>>>  112 |       }
     113 |     };
     114 |     fetchWatchlist();
```

**app/featured/page.tsx:37**
```typescript
      35 |           setWatchlistedIds(ids);
      36 |         }
>>>   37 |       } catch (error) {
>>>   38 |         // Silently fail - user might not be logged in
>>>   39 |       }
      40 |     }
      41 | 
```

**app/page.tsx:138**
```typescript
     136 |           setWatchlistedIds(ids);
     137 |         }
>>>  138 |       } catch (error) {
>>>  139 |         // Silently fail - user might not be logged in
>>>  140 |       }
     141 |     }
     142 | 
```

*...and 4 more occurrences in:*
- `components/pato/PATOLaunchModal.tsx:99`
- `components/wallet/ExportKeyModal.tsx:52`
- `lib/domain-transfer.ts:382`
- `lib/sol-price.ts:26`

---

#### Rule: `unsafe-json-parse` (7 findings)

- **Message:** JSON.parse() with external input. Ensure the input is validated and that the parsed result is type-checked before use.
- **CWE:** CWE-502

**app/api/auth/twitter/callback/route.ts:53**
```typescript
      51 |       // SECURITY: Decrypt OAuth data with AES-256-GCM
      52 |       const decryptedData = decrypt(oauthCookie.value);
>>>   53 |       oauthData = JSON.parse(decryptedData);
      54 |     } catch {
      55 |       return NextResponse.redirect(
```

**app/api/cron/expire-withdrawals/route.ts:43**
```typescript
      41 | 
      42 |   try {
>>>   43 |     const keypairBytes = JSON.parse(secretKeyJson);
      44 |     return Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
      45 |   } catch (error) {
```

**app/api/listings/route.ts:487**
```typescript
     485 |           if (typeof socialAccounts === 'string' && socialAccounts.trim()) {
     486 |             try {
>>>  487 |               return JSON.parse(socialAccounts);
     488 |             } catch {
     489 |               // Invalid JSON, ignore
```

**app/api/token-launch/[id]/route.ts:83**
```typescript
      81 |           pool: tokenLaunch.dbcPoolAddress,
      82 |           // Serialize BN fields to strings
>>>   83 |           ...(poolState ? JSON.parse(JSON.stringify(poolState, (_, v) =>
>>>   84 |             typeof v === "bigint" ? v.toString() : v
>>>   85 |           )) : {}),
      86 |         };
      87 |       } catch {
```

**app/api/transactions/[id]/uploads/route.ts:148**
```typescript
     146 |           // Continue without on-chain verification - will need manual verification
     147 |         } else {
>>>  148 |           const keypairBytes = JSON.parse(backendSecretKey);
     149 |           const backendKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
     150 |           const connection = getConnection();
```

*...and 2 more occurrences in:*
- `app/dashboard/transfers/[id]/page.tsx:196`
- `lib/cron-helpers.ts:48`

---

#### Rule: `insecure-random` (4 findings)

- **Message:** Math.random() is not cryptographically secure. For security-sensitive operations (tokens, keys, nonces), use crypto.randomBytes() or crypto.getRandomValues() instead.
- **CWE:** CWE-338

**app/api/auth/register/route.ts:69**
```typescript
      67 | 
      68 |     const username = existingUsername
>>>   69 |       ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
      70 |       : baseUsername;
      71 | 
```

**lib/store.ts:78**
```typescript
      76 |           const newNotification = {
      77 |             ...notification,
>>>   78 |             id: Math.random().toString(36).substring(7),
      79 |             createdAt: new Date(),
      80 |           };
```

**lib/wallet-verification.ts:143**
```typescript
     141 | 
     142 |       const username = existingUser
>>>  143 |         ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
     144 |         : baseUsername;
     145 | 
```

**lib/webhooks.ts:221**
```typescript
     219 |  */
     220 | function generateEventId(): string {
>>>  221 |   return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     222 | }
     223 | 
```

---

#### Rule: `file-upload-no-type-check` (2 findings)

- **Message:** File upload via formData without apparent content type validation. Validate file type, size, and content before processing.
- **CWE:** CWE-434

**app/api/profile/upload-picture/route.ts:22**
```typescript
      20 |     }
      21 | 
>>>   22 |     const formData = await req.formData();
      23 |     const file = formData.get('file') as File;
      24 | 
```

**app/api/user/profile/image/route.ts:15**
```typescript
      13 |     }
      14 | 
>>>   15 |     const formData = await req.formData();
      16 |     const file = formData.get("file") as File;
      17 | 
```

---

#### Rule: `session-no-secure-cookie` (1 findings)

- **Message:** Session configuration found. Ensure cookies have secure, httpOnly, and sameSite flags set appropriately.
- **CWE:** CWE-614

**lib/auth.ts:413**
```typescript
     411 |     }),
     412 |   ],
>>>  413 |   session: {
>>>  414 |     strategy: "jwt",
>>>  415 |     maxAge: 7 * 24 * 60 * 60, // SECURITY: 7 days instead of 30
>>>  416 |   },
     417 |   cookies: {
     418 |     sessionToken: {
```

---

#### Rule: `buffer-from-string` (1 findings)

- **Message:** Buffer.from with hex encoding. Ensure input is validated as proper hex to prevent unexpected behavior.
- **CWE:** CWE-20

**lib/encryption.ts:69**
```typescript
      67 |     iv,
      68 |     authTag,
>>>   69 |     Buffer.from(encrypted, "hex"),
      70 |   ]);
      71 | 
```

---
