# Known Limitations & Technical Constraints

This document provides detailed technical information about platform limitations and design trade-offs.

---

## Blockchain Limitations

### 1. Solana Clock Drift

**Technical Details:**
- Solana validators synchronize time via NTP (Network Time Protocol)
- Clock drift can vary by ±2-5 seconds between validators
- The on-chain Clock sysvar provides the current validator's timestamp

**Impact on Platform Operations:**

| Operation | Time Window | Clock Drift Impact | Significance |
|-----------|-------------|-------------------|--------------|
| Anti-snipe extension | 15 minutes | ±5 seconds | 0.06% variance - negligible |
| Grace period | 72 hours | ±5 seconds | 0.002% variance - negligible |
| Timelock | 48 hours | ±5 seconds | 0.003% variance - negligible |
| Transfer deadline | 7 days | ±5 seconds | 0.0001% variance - negligible |

**Why This Is Acceptable:**
- All time-sensitive operations use generous windows
- Drift is insignificant compared to operation duration
- Alternative (centralized timekeeper) would compromise decentralization

**User Impact:** None. All timing is designed to absorb clock variance.

---

### 2. Transaction Finality

**Technical Details:**
- Solana transactions are considered final after ~32 confirmed slots (~13 seconds)
- In rare cases, a slot can be skipped (validator offline)
- Transactions are eventually consistent, not immediately consistent

**Impact on Platform:**
- Bid placement may take 13-30 seconds to appear
- Auction end time checks occur at transaction time
- Race conditions possible in the last seconds of an auction

**Mitigation:**
- Don't bid in the final 1 minute of an auction
- Use the anti-snipe extension (auctions extend if bids placed near end)
- Frontend polls for updates every 5 seconds

**User Impact:** Bids may not appear instantly. Refresh if needed.

---

### 3. Network Congestion

**Technical Details:**
- Solana can process ~65,000 transactions per second
- During high demand, transactions may be dropped or delayed
- Priority fees can improve transaction success rate

**Impact on Platform:**
- Bid transactions may fail during congestion
- Users may need to retry transactions
- Transaction fees may increase temporarily

**Mitigation:**
- Frontend automatically retries failed transactions (up to 3 times)
- Uses recent blockhash to minimize expiration
- Implements exponential backoff for retries

**User Impact:** May need to wait or retry during network congestion.

---

## Smart Contract Design Limitations

### 1. Manual Asset Transfer

**Why Manual?**
Digital assets (GitHub repos, domains, credentials) exist off-chain and cannot be automatically transferred by smart contracts.

**What This Means:**
- Seller must manually transfer ownership
- Buyer must manually verify receipt
- No automatic verification possible

**Safeguards:**
- Backend verifies GitHub ownership via API
- 72-hour grace period for verification
- Dispute system with manual review
- Seller cannot release funds without upload verification

**Alternative Considered:** Requiring on-chain attestations
**Why Rejected:** Still requires off-chain verification; adds complexity without solving core issue

---

### 2. Admin-Based Dispute Resolution

**Why Admin?**
- Asset ownership cannot be cryptographically proven on-chain
- GitHub, domains, credentials are centralized services
- Requires human judgment of evidence

**Centralization Trade-Off:**

| Aspect | Centralized | Decentralized |
|--------|-------------|---------------|
| Dispute resolution | Admin reviews evidence | Not possible for off-chain assets |
| Transaction execution | Fully on-chain | ✅ Fully decentralized |
| Asset verification | Backend + manual | Not possible |
| Fund custody | Smart contract escrow | ✅ Fully decentralized |

**Safeguards:**
- Transparent dispute process
- Both parties submit evidence
- Admin cannot access escrow funds without dispute
- All disputes are logged on-chain

**Alternative Considered:** DAO voting, oracle network
**Why Rejected:** Too slow (7-day window), requires governance token, adds complexity

---

### 3. Infinite Auction Extensions (Anti-Snipe)

**Design Decision:**
Auctions extend by 15 minutes whenever a bid is placed in the final 15 minutes.

**Why?**
- Prevents last-second bid sniping
- Ensures all interested bidders have fair opportunity
- Common in traditional auctions (eBay, etc.)

**Theoretical Issue:**
Auctions could extend forever if bidding continues indefinitely.

**Practical Reality:**
- Bidders must outbid by at least 5% or 0.1 SOL (whichever is greater)
- Each extension requires a significantly higher bid
- Eventually becomes too expensive to continue
- No infinite auctions observed in testing or similar platforms

**Alternative Considered:** Hard cap on extensions (e.g., max 3)
**Why Rejected:** Encourages gaming the system ("wait for the 3rd extension")

---

### 4. Withdrawal Pattern (Pull vs Push)

**Design Decision:**
Outbid users must claim refunds manually instead of receiving automatic refunds.

**Why?**
- Prevents denial-of-service attacks
- If automatic refunds fail (recipient wallet rejecting), entire transaction would fail
- Smart contract cannot "retry" failed transfers

**Security Benefit:**
```
// Bad (Push Pattern):
Place bid → Send refund to previous bidder
If previous bidder's wallet rejects → Entire transaction fails → DoS

// Good (Pull Pattern):
Place bid → Create withdrawal account for previous bidder
Previous bidder claims whenever ready → Transaction always succeeds
```

**User Experience Trade-Off:**
- **Pro:** Transactions never fail due to recipient issues
- **Con:** Users must manually claim refunds

**Mitigation:**
- Frontend shows banner when withdrawals available
- Email notifications (if enabled)
- Withdrawals never expire

**Alternative Considered:** Automatic refunds with retry mechanism
**Why Rejected:** Adds significant complexity, still has failure cases

---

## Frontend/Backend Limitations

### 1. GitHub API Rate Limits

**Technical Details:**
- GitHub API: 5,000 requests/hour (authenticated)
- Used for repository verification

**Impact:**
- High-volume sellers may hit rate limits
- Verification may be delayed during peak times

**Mitigation:**
- Backend caches repository data
- Spreads verifications over time
- Uses multiple API keys for redundancy

**User Impact:** Verification may take 5-10 minutes during high load.

---

### 2. Browser Wallet Limitations

**Technical Details:**
- Wallet extensions (Phantom, Solflare) required for transactions
- Mobile browsers have limited wallet support
- Some wallets don't support all transaction types

**Impact:**
- Users must install wallet extension
- Mobile experience may be limited
- Ledger hardware wallet support varies

**Mitigation:**
- Clear wallet installation instructions
- Support for multiple wallet providers
- Mobile wallet app integration (WalletConnect)

**User Impact:** Desktop Chrome/Firefox recommended for best experience.

---

### 3. IPFS/Decentralized Storage

**Current State:**
- Images/files stored on Vercel Blob (centralized)
- Metadata stored in PostgreSQL (centralized)

**Why Not IPFS?**
- Better performance (faster load times)
- Lower costs
- Easier maintenance
- Files don't "disappear" (common IPFS issue)

**Trade-Off:**
- Less censorship-resistant
- Platform controls file storage

**Future Plan:**
- Optional IPFS upload for users who want it
- Keep centralized storage as default

---

## Design Trade-Offs

### Security vs Convenience

| Feature | Security Approach | Convenience Approach | Our Choice |
|---------|-------------------|----------------------|------------|
| Withdrawals | Manual claim (pull) | Auto-refund (push) | **Manual** (security) |
| Asset transfer | Manual verification | Trust seller | **Manual** (security) |
| Dispute resolution | Admin review | Automatic/DAO | **Admin** (practical) |
| Grace period | 72 hours | 24 hours | **72 hours** (security) |

### Decentralization vs Usability

| Component | Fully Decentralized | Our Implementation |
|-----------|-------------------|-------------------|
| Smart contract | ✅ On-chain | ✅ On-chain |
| Fund custody | ✅ Escrow | ✅ Escrow |
| Asset verification | ❌ Not possible | Hybrid (backend API + manual) |
| Dispute resolution | ❌ Not practical | Admin with transparency |
| File storage | ❌ IPFS issues | Centralized (fast, reliable) |

**Philosophy:** Maximize decentralization where it matters (funds, transactions), accept centralization where it improves UX without compromising security.

---

## Future Improvements

### Planned Enhancements

**1. Decentralized Dispute Arbitration (Phase 2)**
- Community arbitrators stake tokens
- Multi-signature approval required
- Reduces admin centralization

**2. IPFS Integration (Optional)**
- Users can choose IPFS storage
- Pin to multiple providers
- Fallback to centralized storage

**3. Multi-Chain Support (Phase 3)**
- Ethereum smart contract
- Cross-chain escrow
- Unified marketplace

**4. Automated Asset Verification (Partial)**
- GitHub App integration (deeper access)
- Domain verification via DNS
- Credential testing (optional)

---

## Limitations We Accept

Some limitations are inherent to blockchain technology or digital asset nature:

### 1. Off-Chain Assets
**Reality:** Digital assets exist off-chain and always will.
**Acceptance:** Manual transfer is the only secure option.

### 2. Clock Drift
**Reality:** Blockchain time is not perfectly synchronized.
**Acceptance:** Design around generous time windows.

### 3. Human Judgment
**Reality:** Asset transfer disputes require subjective evaluation.
**Acceptance:** Admin review is necessary and appropriate.

### 4. Network Volatility
**Reality:** Blockchain networks have congestion and variability.
**Acceptance:** Retry logic and user patience required.

---

## User Mitigations

### What You Can Do

**To Minimize Issues:**
1. **Don't bid in final 1 minute** - Avoid race conditions
2. **Verify assets immediately** - Use full grace period
3. **Check for withdrawals** - Claim refunds promptly
4. **Use desktop browser** - Better wallet support
5. **Keep wallet funded** - Rent + transaction fees
6. **Document transfers** - Screenshots for disputes
7. **Test credentials** - Before confirming receipt
8. **Read notifications** - Stay informed

**Tools We Provide:**
- Withdrawal notifications
- Grace period countdowns
- Asset verification checklists
- Transaction status tracking
- Dispute evidence upload

---

## Technical Glossary

**Clock Drift:** Variance in time between different network validators

**Escrow:** Smart contract holding funds until conditions are met

**Grace Period:** Time window for buyer to verify assets (72 hours)

**PDA (Program Derived Address):** Deterministic account address controlled by smart contract

**Pull Pattern:** User-initiated action (vs automatic push)

**Rent:** Refundable deposit for storing accounts on Solana

**Timelock:** Required waiting period before action can be executed (48 hours)

**Withdrawal:** Pending refund that user must manually claim

---

## Questions?

**Technical Documentation:** See [README.md](./README.md)

**Security Information:** See [SECURITY.md](./SECURITY.md)

**Fee Information:** See [PLATFORM_FEES.md](./PLATFORM_FEES.md)

**Contact:** dev@yourplatform.com

---

**Last Updated:** January 13, 2026
**Version:** 1.0
