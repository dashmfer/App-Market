# Security Policy

## Security Audits

This smart contract has undergone comprehensive security reviews to ensure the safety of user funds and platform operations.

### Audit History

**January 2026 - AI-Assisted Security Review**
- ✅ Three independent AI-assisted security analyses completed
- ✅ 7 critical vulnerabilities identified and fixed
- ✅ Manual code review conducted
- ✅ All findings addressed and verified

### Vulnerabilities Fixed

1. **Escrow Theft Protection** - Added balance checks to prevent theft of unclaimed withdrawals
2. **Rent Optimization** - Fixed wasteful account creation to save user rent costs
3. **Deprecated Account Removal** - Removed unused accounts that wasted rent
4. **Upload Verification** - Required upload verification before funds release
5. **Dispute Fee Refund** - Implemented refund mechanism for buyers who win disputes
6. **Input Validation** - Added GitHub username format validation
7. **Rent Distribution** - Fixed rent to go to account initializers (fundamental Solana principle)

### Audit Reports

Detailed security analysis reports are available in the repository:
- [Security Analysis Report](./SECURITY_ANALYSIS_REPORT.md)
- [Security Review Phase 2](./SECURITY_REVIEW_PHASE2.md)
- [Final Security Status](./FINAL_SECURITY_STATUS.md)

---

## Known Limitations

Users should be aware of the following technical limitations:

### 1. Solana Validator Clock Drift

**What it is:** Solana validators can have timestamp differences of 2-5 seconds.

**Impact on platform:**
- Anti-snipe extensions use 15-minute windows (clock drift is negligible)
- Grace periods are 72 hours (seconds don't matter)
- Timelocks are 48 hours (seconds don't matter)

**User action:** No action needed. The platform is designed with this limitation in mind.

### 2. Off-Chain Asset Transfer

**What it is:** Digital assets (GitHub repos, domains, credentials) cannot be verified automatically on the blockchain.

**Impact on platform:**
- Seller must manually transfer assets
- Backend verifies GitHub ownership via API
- Buyer must confirm receipt before funds are released
- 7-day dispute window after seller confirmation

**User action:**
- **Buyers:** Verify all assets before confirming receipt
- **Sellers:** Upload all assets immediately after sale

### 3. Admin Dispute Resolution

**What it is:** Disputes are resolved manually by platform administrators, not automatically by smart contracts.

**Why:** Off-chain assets cannot be verified on-chain, requiring human judgment.

**Safeguards:**
- 2% dispute fee discourages frivolous disputes
- Buyer receives fee refund if they win
- All evidence is reviewed before resolution
- Decisions are final and transparent

**User action:** Provide clear evidence when opening disputes.

### 4. Infinite Auction Extensions (Anti-Snipe)

**What it is:** Auctions extend by 15 minutes whenever a bid is placed in the final 15 minutes.

**Why:** Prevents last-second bid sniping.

**Impact:** Auctions can theoretically extend forever if bidding continues.

**User action:** Only bid if you're prepared to increase your bid if outbid.

### 5. Withdrawal Pattern

**What it is:** Outbid users must manually claim refunds instead of receiving automatic refunds.

**Why:** Prevents denial-of-service attacks where failed transfers block transactions.

**Impact:** Users must visit the platform to claim refunds (withdrawals never expire).

**User action:** Check for pending withdrawals after being outbid. Claim them when ready.

---

## Smart Contract Risks

### General Blockchain Risks

Users should understand these inherent risks of blockchain transactions:

#### 1. Immutability
- Smart contracts cannot be changed after deployment
- Transactions are final and cannot be reversed
- No chargebacks like traditional payment systems

#### 2. Self-Custody Responsibility
- You are responsible for your wallet security
- Lost private keys = lost funds (no recovery possible)
- No customer support can reverse transactions

#### 3. Network Risks
- Solana network congestion can delay transactions
- Transaction fees (gas) fluctuate based on network activity
- Network outages can temporarily prevent transactions

### Platform-Specific Risks

#### 1. Escrow System
**Risk:** Funds are held in smart contract escrow during transactions.

**Mitigation:**
- Escrow logic has been audited for security
- Balance checks prevent theft
- Rent is returned to payers
- Emergency refund mechanism exists

**User responsibility:** Only proceed with transactions you trust.

#### 2. Time-Based Operations

**Risk:** All time-based operations (auctions, grace periods, deadlines) rely on Solana's on-chain clock.

**Mitigation:**
- All time windows are generous (15 min, 72 hr, 7 days)
- Clock drift is negligible over these periods

**User responsibility:** Don't wait until the last second to take actions.

#### 3. Proof of Transfer

**Risk:** Digital assets cannot be verified on-chain automatically.

**Mitigation:**
- Backend validates GitHub repository ownership
- 72-hour grace period for buyer to verify assets
- Dispute system with manual review
- Upload verification required before release

**User responsibility:**
- **Buyers:** Thoroughly verify all assets before confirming receipt
- **Sellers:** Provide complete and accurate asset transfers

#### 4. Dispute Resolution

**Risk:** Disputes are resolved by admin (centralized).

**Why necessary:** Digital asset ownership cannot be verified on-chain.

**Mitigation:**
- Transparent evidence submission
- 2% dispute fee encourages honest behavior
- Fee refunded to buyer if they win
- Both parties can present evidence

**User responsibility:** Keep records of all transfers and communications.

---

## Emergency Procedures

### Contract Pause Capability

**Who:** Platform admin only

**When:** Critical bug discovered or security threat detected

**Effect:**
- No new listings can be created
- No new bids can be placed
- No new transactions can start
- **Existing transactions and withdrawals still work**

**User action during pause:**
- You can still claim pending withdrawals
- You can still complete in-progress transactions
- You cannot start new actions

### Emergency Refund Process

**Trigger:** Seller doesn't confirm transfer and buyer requests emergency refund before grace period.

**Conditions:**
- Transaction must be in escrow
- Seller has not confirmed transfer yet
- Buyer initiates emergency refund

**Result:**
- Full refund to buyer
- Escrow rent returned to seller (they paid it)
- Transaction marked as refunded

### Communication Channels

**During Emergencies:**
- Twitter/X: [@YourPlatformHandle]
- Discord: [Your Discord Server]
- Email: security@yourplatform.com

**Bug Bounty Program:**
Coming post-launch. Researchers will be rewarded for finding vulnerabilities.

---

## Platform Fees & Economics

### Transaction Fees

**Platform Fee: 5% of sale price**
- Deducted from escrow before release to seller
- Fee locked at listing creation (not affected by future changes)
- Charged on successful transactions only

**Dispute Fee: 2% of sale price**
- Paid by dispute initiator (buyer or seller)
- Held in Dispute PDA during review
- **Refunded to buyer if they win the dispute**
- Sent to treasury if seller wins

**No Hidden Fees:**
- No listing fees
- No cancellation fees
- No withdrawal fees
- Only pay when you sell

### Solana Network Fees

**Rent (Refundable):**
- ~0.002 SOL per account created
- Returned when account closes
- Seller pays escrow rent (gets it back)
- Bidders pay withdrawal rent if outbid (gets it back when claimed)

**Transaction Fees (Non-refundable):**
- ~0.000005 SOL per transaction
- Paid to Solana network (not the platform)
- Standard Solana network cost

---

## Best Practices

### For Buyers

1. **Before Bidding/Buying:**
   - Review seller's reputation and rating
   - Verify GitHub repository is real and active
   - Check demo links and screenshots
   - Understand what assets are included

2. **During Transaction:**
   - Verify ALL assets have been transferred
   - Test GitHub repository access
   - Check domain ownership transfer
   - Verify credentials work
   - Don't confirm receipt until everything is verified

3. **After Transaction:**
   - Change all passwords/credentials immediately
   - Transfer domain ownership to your account
   - Update GitHub repository settings
   - Leave honest review for seller

### For Sellers

1. **Before Listing:**
   - Ensure you own all assets you're selling
   - Prepare transfer documentation
   - Take screenshots of current state
   - Clean up repository (remove sensitive data)

2. **During Transaction:**
   - Transfer assets within 7 days of sale
   - Provide clear transfer instructions
   - Upload verification documents
   - Confirm transfer only when complete

3. **After Transaction:**
   - Remove your access to transferred assets
   - Respond to buyer questions promptly
   - Leave honest review for buyer
   - Claim your proceeds

---

## Reporting Security Issues

### How to Report

**For security vulnerabilities:**
Email: security@yourplatform.com

**PGP Key:** [Your PGP key for encrypted communication]

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### What to Expect

1. **Acknowledgment** within 24 hours
2. **Assessment** within 72 hours
3. **Fix timeline** communicated within 1 week
4. **Public disclosure** after fix is deployed

### Bug Bounty Program

**Coming Soon:** Post-mainnet launch

**Rewards based on severity:**
- Critical: $5,000 - $50,000
- High: $1,000 - $5,000
- Medium: $500 - $1,000
- Low: $100 - $500

---

## Legal Disclaimer

**Use at Your Own Risk:**
This platform and smart contract are provided "as is" without warranties of any kind. Users are responsible for their own due diligence.

**No Liability:**
The platform operators are not liable for:
- Lost funds due to user error
- Network failures or congestion
- Asset transfer disputes
- Third-party integrations (GitHub, domain registrars, etc.)

**Jurisdiction:**
This platform operates globally. Users are responsible for compliance with their local laws and regulations.

**Terms of Service:**
By using this platform, you agree to our [Terms of Service](./TERMS_OF_SERVICE.md).

---

## Version History

**v1.0 - January 2026**
- Initial security audit completed
- 7 critical vulnerabilities fixed
- Platform ready for mainnet deployment

---

## Contact

**Website:** https://yourplatform.com
**Email:** security@yourplatform.com
**Twitter:** @YourPlatform
**Discord:** [Discord Server Link]

**Last Updated:** January 13, 2026
