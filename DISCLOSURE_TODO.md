# Things to Disclose - TODO List

## 🔴 CRITICAL - Must Disclose Before Launch

### 1. Security Audits
**Status:** Pending disclosure
**What:** AI-assisted security reviews that found vulnerabilities
**Where to disclose:**
- [ ] Security page on website
- [ ] Smart contract documentation (README.md)
- [ ] Public audit report page

**Disclosure text (draft):**
```
Security Audits

This smart contract has undergone:
✅ AI-assisted security review (January 2026)
✅ Manual code review
✅ Third-party audit [link to report]

All identified vulnerabilities have been addressed. See SECURITY.md for details.
```

---

### 2. Known Limitations
**What:** Technical limitations users should know
**Examples:**
- Solana validator clock drift (anti-sniping)
- Off-chain asset transfer (can't verify automatically)
- Admin dispute resolution (centralized)

---

### 3. Smart Contract Risks
**What:** Inherent risks of using the platform
**Where:** Terms of Service, Transaction warnings
**Examples:**
- Smart contracts are immutable after deployment
- Transactions are final (no chargebacks)
- User responsible for verifying assets before confirming receipt
- 7-day window to dispute or funds auto-release

---

### 4. Data Collection & Privacy
**What:** What data we collect, how it's used
**Status:** ❓ Needs review
**Where:** Privacy Policy page
**Examples:**
- Wallet addresses (public blockchain data)
- GitHub OAuth data (if user verifies)
- Discord OAuth data (if user verifies)
- Upload metadata (for transactions)

---

### 5. Platform Fees & Economics
**What:** Clear disclosure of all fees
**Where:** FAQ, Listing creation flow, Transaction flow
**Current fees:**
- Platform fee: 5% of sale price
- Dispute fee: 2% of sale price (paid by initiator)

---

### 6. Jurisdiction & Legal
**What:** Where platform operates, applicable laws
**Status:** ❓ Needs legal review
**Where:** Terms of Service

---

## 🟡 IMPORTANT - Should Disclose

### 7. Open Source Status
**What:** Is the smart contract open source?
**Decision needed:**
- [ ] Open source (publish on GitHub)
- [ ] Closed source (only audited by security firms)

---

### 8. Bug Bounty Program
**What:** Incentive for security researchers to find bugs
**Status:** Not yet launched
**TODO:** Consider launching post-mainnet

---

### 9. Emergency Procedures
**What:** What happens if critical bug found
**Examples:**
- Contract pause capability (admin can pause)
- Emergency refund process
- Communication channels for incidents

---

## 🟢 NICE TO HAVE - Optional Disclosures

### 10. Technology Stack
**What:** What technologies power the platform
**Examples:**
- Solana blockchain
- Anchor framework
- Next.js frontend
- Supabase/PostgreSQL database

---

## 📝 UNRESOLVED - User Mentioned

### ❓ Mystery Disclosure Item
**User said:** "when you changed it from disclaimed to security disclosure? what was that for? was that for what we deleted from git?"

**Action:** Need clarification from user
- What file or text was changed?
- What was deleted from git?
- What specifically needs to be disclosed?

**Add details here when clarified:**
- [User to provide context]

---

## ✅ Completed Disclosures

### Security Fixes
**Status:** ✅ Disclosed in git commits
**Where:** Git commit messages document all security vulnerabilities and fixes

---

**Last Updated:** 2026-01-13
**Owner:** @dashmfer
**Review Frequency:** Before each major release
