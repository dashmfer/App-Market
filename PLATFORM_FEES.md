# Platform Fees & Economics

Complete transparency on all platform costs and how funds flow through the system.

---

## Fee Structure

### Platform Transaction Fee

**Rate:** 5% of final sale price

**When charged:**
- Only on successful transactions
- Deducted from escrow before releasing funds to seller

**How it works:**
```
Sale Price: 100 SOL
Platform Fee (5%): 5 SOL
Seller Receives: 95 SOL
```

**Fee Lock-In:**
- Fee rate is locked when listing is created
- If platform changes fees later, your listing keeps the original rate
- Protects sellers from unexpected fee changes

**What you pay for:**
- Smart contract infrastructure
- Backend asset verification
- Dispute resolution services
- Platform maintenance and development
- Customer support

---

### Dispute Fee

**Rate:** 2% of sale price

**Who pays:**
- The person who opens the dispute (buyer or seller)

**When charged:**
- Immediately when dispute is opened
- Held in Dispute PDA (not sent to platform)

**Refund Policy:**
- **Buyer wins:** Fee refunded to buyer
- **Seller wins:** Fee sent to platform treasury
- **Partial refund:** Fee sent to platform treasury

**Why this fee exists:**
- Discourages frivolous disputes
- Ensures both parties have "skin in the game"
- Covers cost of manual dispute review

**Example:**
```
Sale Price: 100 SOL
Dispute Fee (2%): 2 SOL

If buyer wins: Buyer gets 100 SOL + 2 SOL refund = 102 SOL total
If seller wins: Seller gets 95 SOL (after platform fee), platform keeps 2 SOL dispute fee
```

---

### No Hidden Fees

**Free Actions:**
- Creating a listing ✅
- Placing bids ✅
- Making offers ✅
- Cancelling listings (no bids) ✅
- Claiming withdrawals ✅
- Viewing listings ✅
- Browsing marketplace ✅

**You only pay when you sell.**

---

## Solana Network Costs

These are **not** platform fees - they go to the Solana blockchain network.

### Rent (Refundable Deposits)

**What is rent?**
- Small SOL deposit to keep accounts active on Solana
- Required by Solana blockchain, not by the platform
- **Fully refundable** when account is closed

**Typical Rent Amounts:**
- Escrow account: ~0.002 SOL
- Withdrawal account: ~0.002 SOL
- Transaction account: ~0.003 SOL
- Offer account: ~0.002 SOL
- Dispute account: ~0.003 SOL

**Who Pays What:**

| Account Type | Who Pays | When Refunded | Who Gets Refund |
|-------------|----------|---------------|-----------------|
| Escrow | Seller | Transaction ends | Seller |
| Withdrawal | Platform (from buyer's bid) | User claims | User |
| Transaction | Buyer | Transaction complete | Buyer |
| Offer | Buyer | Offer cancelled/accepted/expired | Buyer |
| Dispute | Dispute opener | Dispute resolved | Admin (tiny cost of resolution) |

**Example:**
```
Seller creates listing: Pays ~0.002 SOL escrow rent
Auction ends: Seller gets ~0.002 SOL rent back
```

### Transaction Fees (Gas)

**What are these?**
- Fees paid to Solana validators to process transactions
- Standard Solana network cost
- **Not** collected by the platform

**Typical Costs:**
- Place bid: ~0.000005 SOL
- Confirm receipt: ~0.000005 SOL
- Claim withdrawal: ~0.000005 SOL
- Open dispute: ~0.000005 SOL

**Very cheap:** Even 100 transactions = ~0.0005 SOL (< $0.10)

---

## Where Does the Money Go?

### Breakdown of 5% Platform Fee

**Smart Contract Infrastructure (30%):**
- Solana program deployment and upgrades
- Security audits and bug fixes
- On-chain storage and compute costs

**Backend Services (25%):**
- Asset verification APIs
- GitHub integration
- Domain ownership verification
- Database hosting
- CDN and file storage

**Operations & Support (20%):**
- Customer support team
- Dispute resolution
- Platform moderation
- Community management

**Development & Improvement (15%):**
- New features
- Performance optimization
- Security enhancements
- User experience improvements

**Marketing & Growth (10%):**
- User acquisition
- Platform awareness
- Partnership development
- Community events

---

## Fee Calculation Examples

### Example 1: Simple Auction

```
Starting Price: 10 SOL
Winning Bid: 50 SOL

Buyer pays: 50 SOL
Platform fee (5%): 2.5 SOL
Seller receives: 47.5 SOL

Network costs:
- Seller escrow rent: 0.002 SOL (refunded)
- Buyer transaction fee: 0.000005 SOL
- Seller transaction fee: 0.000005 SOL

Total cost to seller: 2.5 SOL + 0.000005 SOL = 2.50001 SOL
Net to seller: 47.5 SOL + 0.002 SOL (rent refund) = 47.502 SOL
```

### Example 2: Auction with Outbid User

```
Starting Price: 10 SOL
User A bids: 20 SOL (outbid)
User B bids: 30 SOL (wins)

User A: Gets withdrawal of 20 SOL + 0.002 SOL rent
User B: Pays 30 SOL
Platform fee (5%): 1.5 SOL
Seller receives: 28.5 SOL + 0.002 SOL rent refund

User A pays: 0.000005 SOL (bid transaction)
User A receives: 20 SOL (refund) + 0.002 SOL (rent)
User A net: -0.000005 SOL (essentially free to try)
```

### Example 3: Dispute (Buyer Wins)

```
Sale Price: 100 SOL
Platform fee: 5 SOL (held in escrow)
Seller would get: 95 SOL (held in escrow)

Buyer opens dispute: Pays 2 SOL dispute fee (held in Dispute PDA)

Admin resolves: Full refund to buyer
Buyer receives: 100 SOL + 2 SOL dispute fee = 102 SOL
Seller receives: 0 SOL + 0.002 SOL escrow rent refund
Platform receives: 0 SOL (no fee collected on refunded transaction)
```

### Example 4: Dispute (Seller Wins)

```
Sale Price: 100 SOL
Platform fee: 5 SOL (held in escrow)
Seller would get: 95 SOL (held in escrow)

Buyer opens dispute: Pays 2 SOL dispute fee (held in Dispute PDA)

Admin resolves: Release to seller
Seller receives: 95 SOL + 0.002 SOL escrow rent
Buyer receives: 0 SOL
Platform receives: 5 SOL + 2 SOL dispute fee = 7 SOL total
```

---

## Refund Policy

### Full Refund Scenarios

**Before Transaction Created:**
- Listing cancelled (no bids): No fees
- Auction ends with no reserve met: No fees

**After Transaction Created:**
- Emergency refund (seller didn't transfer): Full refund, no platform fee
- Dispute resolved in buyer's favor: Full refund + dispute fee refund

### No Refund Scenarios

**Transaction completed:**
- Platform fee is non-refundable once assets are transferred
- Dispute fee kept if seller wins

---

## Fee Changes

### How Fee Changes Work

**Current fee:** 5% (locked at listing creation)

**If we change fees in the future:**
1. New fee only applies to NEW listings
2. Existing listings keep their original fee rate
3. Changes announced 30 days in advance
4. Cap: Platform fee will NEVER exceed 10%

### Historical Fees

| Period | Platform Fee | Dispute Fee |
|--------|-------------|-------------|
| Launch - Present | 5% | 2% |

---

## Referral Program

**Coming Soon**

Earn 2% of platform fees from users you refer:

```
Friend sells project for 100 SOL
Platform earns 5 SOL
You earn 2% of 5 SOL = 0.1 SOL
```

**Eligible for:**
- Sales made by referred users
- Purchases made by referred users
- Lifetime earnings (passive income)

**Sign up:** [Referral page]

---

## Enterprise & High Volume

### Volume Discounts

For high-volume sellers:

| Monthly Volume | Standard Fee | Discounted Fee | Savings |
|----------------|-------------|----------------|---------|
| < 1000 SOL | 5% | 5% | - |
| 1000-5000 SOL | 5% | 4.5% | 10% |
| 5000-10000 SOL | 5% | 4% | 20% |
| > 10000 SOL | 5% | 3.5% | 30% |

**Contact us:** enterprise@yourplatform.com

---

## Tax Reporting

### What We Provide

**For US users:**
- 1099 forms for earnings > $600/year
- Transaction history export (CSV)
- Fee breakdown for tax deductions

**For International users:**
- Transaction history export
- Fee documentation
- Support for local tax requirements

**Important:** Consult a tax professional. Cryptocurrency transactions may be taxable in your jurisdiction.

---

## Fee FAQs

**Q: Can I negotiate the platform fee?**
A: Standard fee is 5%. Volume discounts available for > 1000 SOL/month.

**Q: Do I pay fees on cancelled listings?**
A: No, only on successful sales.

**Q: What if a buyer doesn't pay?**
A: Smart contract ensures payment before transaction starts. No "non-payment" risk.

**Q: Can fees increase without notice?**
A: No. Changes announced 30 days in advance and only apply to new listings.

**Q: Are Solana network fees refundable?**
A: Rent yes, transaction fees no. Rent is refunded when accounts close.

**Q: What if I win a dispute?**
A: Seller keeps proceeds minus platform fee. Buyer gets dispute fee sent to treasury.

**Q: What if I lose a dispute as a buyer?**
A: You lose the sale price AND the dispute fee (2%). Only dispute if you have strong evidence.

**Q: How do I claim my withdrawals?**
A: Visit your dashboard, click "Claim Withdrawals". You get your bid + rent refund back.

---

## Contact

Questions about fees? Contact us:
- **Email:** billing@yourplatform.com
- **Discord:** [Support Channel]
- **Twitter:** @YourPlatform

---

**Last Updated:** January 13, 2026
