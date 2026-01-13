# Emergency Procedures

This document outlines emergency response procedures for security incidents, critical bugs, and platform issues.

---

## Emergency Contact Information

### Primary Contacts

**Security Team:**
- Email: security@yourplatform.com
- PGP Key: [Insert PGP Public Key]
- Response Time: < 1 hour for critical issues

**On-Call Admin:**
- Emergency Discord: [Admin Channel]
- Phone: [Emergency Number] (Critical security issues only)
- Available: 24/7

### Public Communication Channels

**Status Updates:**
- Status Page: status.yourplatform.com
- Twitter: @YourPlatform
- Discord: [Announcements Channel]

**Community Support:**
- Discord: [Support Channel]
- Email: support@yourplatform.com

---

## Emergency Types

### 🔴 Critical (Severity 1)

**Definition:** Immediate threat to user funds or platform security

**Examples:**
- Smart contract vulnerability allowing fund theft
- Unauthorized access to admin keys
- Exploit being actively used
- Database breach exposing user data

**Response Time:** < 15 minutes
**Actions:** Immediate contract pause, incident response activated

---

### 🟠 High (Severity 2)

**Definition:** Significant impact on platform operations

**Examples:**
- Backend service outage
- Payment processing failure
- Asset verification system down
- Major frontend bug blocking transactions

**Response Time:** < 1 hour
**Actions:** Investigate and fix, status page update

---

### 🟡 Medium (Severity 3)

**Definition:** Degraded functionality, workarounds available

**Examples:**
- Image upload failures
- Notification delays
- Slow page load times
- Non-critical API errors

**Response Time:** < 4 hours
**Actions:** Fix during business hours, monitor for escalation

---

### 🟢 Low (Severity 4)

**Definition:** Minor issues, no operational impact

**Examples:**
- UI display glitches
- Typos in text
- Non-critical feature requests

**Response Time:** Next sprint
**Actions:** Add to backlog, fix in next release

---

## Contract Pause System

### What is Contract Pause?

The smart contract includes an emergency pause mechanism controlled by the platform admin.

**When Activated:**
- No new listings can be created
- No new bids can be placed
- No new transactions can start
- No new offers can be made

**Still Works:**
- Claiming existing withdrawals ✅
- Completing in-progress transactions ✅
- Resolving existing disputes ✅
- Emergency refunds ✅

### When We Pause

**Automatic Triggers:**
- Critical security vulnerability discovered
- Exploit being actively used
- Smart contract bug affecting funds

**Manual Triggers:**
- Coordinated attack detected
- Regulatory requirement
- Emergency maintenance

### Pause Procedure

**Step 1: Immediate Action (< 5 minutes)**
```
1. Admin calls pause_contract() on smart contract
2. All new transactions blocked
3. Status page updated: "Emergency Maintenance"
4. Public announcement on Twitter/Discord
```

**Step 2: Investigation (< 30 minutes)**
```
1. Security team investigates issue
2. Assess scope and impact
3. Identify affected users
4. Develop fix plan
```

**Step 3: Communication (< 1 hour)**
```
1. Detailed incident report published
2. User notification emails sent
3. Discord/Twitter updates every hour
4. FAQ document created
```

**Step 4: Resolution**
```
1. Deploy fix to smart contract (if needed)
2. Test on devnet
3. Deploy to mainnet
4. Unpause contract
5. Monitor for 24 hours
```

**Step 5: Post-Mortem (< 1 week)**
```
1. Full incident report published
2. Root cause analysis
3. Prevention measures documented
4. User compensation (if applicable)
```

### How Users Are Notified

**Immediate (< 5 minutes):**
- Red banner on website
- Status page updated
- Twitter announcement

**Within 1 Hour:**
- Email to all users
- Discord announcement
- Detailed status page update

**Ongoing:**
- Hourly updates on Twitter
- Discord updates every 2 hours
- Status page real-time updates

---

## Emergency Refund Process

### When Available

Emergency refunds can be initiated by buyers in these situations:

**Eligible Scenarios:**
1. Seller hasn't confirmed transfer
2. Grace period not yet started
3. Transaction in escrow status

**Not Eligible:**
- Seller already confirmed transfer (must use dispute)
- Grace period already started (must wait)
- Transaction already completed

### How to Request

**Step 1: Verify Eligibility**
```
- Check transaction status
- Confirm seller hasn't confirmed transfer
- Verify grace period not started
```

**Step 2: Initiate Refund**
```
- Go to transaction page
- Click "Request Emergency Refund"
- Sign transaction with wallet
- Pay Solana transaction fee (~0.000005 SOL)
```

**Step 3: Confirmation**
```
- Full sale price refunded to buyer
- Escrow rent refunded to seller
- Transaction marked as refunded
- Email confirmation sent
```

### What Gets Refunded

| Recipient | Amount | Why |
|-----------|--------|-----|
| Buyer | Full sale price | Transaction cancelled |
| Seller | Escrow rent (~0.002 SOL) | Seller paid this rent |
| Platform | Nothing | No fee on cancelled transaction |

---

## Dispute Escalation

### Standard Dispute Timeline

**Day 0:** Dispute opened
**Day 0-3:** Both parties submit evidence
**Day 3-7:** Admin reviews and decides
**Day 7:** Resolution implemented

### Emergency Escalation

**When to Escalate:**
- Large amount at stake (> 1000 SOL)
- Time-sensitive asset (domain expiring, etc.)
- Security concern involved
- Evidence of fraud

**How to Escalate:**
Email: escalations@yourplatform.com
Subject: "URGENT DISPUTE ESCALATION - [Transaction ID]"
Include:
- Transaction ID
- Reason for escalation
- Supporting evidence
- Time sensitivity explanation

**Escalation Response:**
- Acknowledged within 1 hour
- Senior admin reviews immediately
- Resolution within 24 hours (vs standard 7 days)

---

## Security Incident Response

### Incident Classification

**Type A: Smart Contract Vulnerability**
- Immediate contract pause
- Security team notified
- External audit firm engaged
- Fix developed and tested
- Audit of fix completed
- Deploy and unpause

**Type B: Backend Compromise**
- Affected services isolated
- Change all credentials
- Database backup restored (if needed)
- Security audit of systems
- Implement additional safeguards

**Type C: User Account Compromise**
- Suspend affected accounts
- Force password reset
- Notify affected users
- Investigate breach source
- Implement additional security

### User Actions During Incidents

**If Smart Contract Paused:**
✅ You can still claim withdrawals
✅ You can still complete in-progress transactions
❌ Cannot start new listings or bids
⏳ Wait for resolution announcement

**If Backend Compromised:**
✅ Your funds are safe (in smart contract)
✅ On-chain transactions still work
❌ Frontend may be unavailable
⏳ Check status page for updates

**If Your Account Compromised:**
✅ Immediately change password
✅ Disconnect wallet if connected
✅ Report to security@yourplatform.com
✅ Monitor your wallet for unauthorized transactions

---

## Communication Protocol

### Internal Communication

**Severity 1 (Critical):**
1. Security team notified via SMS + email
2. All hands on deck (all team members)
3. War room opened (Discord private channel)
4. Incident commander assigned
5. Updates every 15 minutes

**Severity 2 (High):**
1. On-call engineer notified
2. Relevant team members paged
3. Slack channel created
4. Updates every hour

**Severity 3 (Medium):**
1. Ticket created
2. Assigned to relevant team
3. Updates daily

### External Communication

**Template: Critical Incident**
```
🚨 EMERGENCY MAINTENANCE

We've temporarily paused the platform due to [brief description].

Your funds are safe and secured in smart contract escrow.

Current Status:
- New transactions: Paused ⏸️
- Existing withdrawals: Available ✅
- In-progress transactions: Continuing ✅

ETA: [Estimated time]
Updates: Every hour on this channel

More info: status.yourplatform.com
```

**Template: Resolved**
```
✅ ISSUE RESOLVED

The platform has been unpaused and is operating normally.

What happened: [Brief explanation]
What we did: [Actions taken]
Prevention: [Steps to prevent recurrence]

Full report: [Link to post-mortem]

Thank you for your patience.
```

---

## Rollback Procedures

### Smart Contract Rollback

**Reality:** Smart contracts are immutable - cannot be rolled back.

**Instead:**
1. Deploy new fixed version
2. Migrate users to new contract
3. Keep old contract paused

**User Impact:**
- May need to interact with new contract
- Frontend automatically uses new contract
- Old withdrawals still claimable on old contract

### Database Rollback

**When Needed:**
- Data corruption
- Unauthorized changes
- Major bug affecting data integrity

**Procedure:**
1. Stop all write operations
2. Restore from latest backup
3. Replay transactions since backup
4. Verify data integrity
5. Resume operations

**Data Loss:**
- Maximum: 15 minutes (backup frequency)
- On-chain data: Never lost (source of truth)

---

## User Compensation Policy

### When We Compensate

**Full Compensation:**
- Platform error caused financial loss
- Smart contract bug (we pay)
- Backend failure prevented transaction
- Incorrect dispute resolution

**Partial Compensation:**
- Prolonged downtime (> 24 hours)
- Asset verification delays (> 7 days)
- Significant inconvenience caused

**No Compensation:**
- User error
- Blockchain network issues (not our fault)
- External service failures (GitHub, domain registrars)
- Market price changes

### Compensation Process

**Step 1: Report Issue**
Email: compensation@yourplatform.com
Include:
- Transaction ID
- Description of loss
- Expected vs actual outcome
- Amount of loss

**Step 2: Investigation**
- Review transaction logs
- Check smart contract events
- Verify issue was platform fault
- Calculate appropriate compensation

**Step 3: Payment**
- Approved claims paid within 7 days
- Payment via SOL to your wallet
- Confirmation email sent

---

## Disaster Recovery

### Data Backup

**Smart Contract:**
- Immutable on blockchain ✅
- Never lost ✅

**Database:**
- Continuous replication
- Point-in-time recovery (15 min intervals)
- Backup to separate region
- Retained for 30 days

**File Storage:**
- Vercel Blob with redundancy
- Multi-region replication
- 99.9% availability SLA

### Infrastructure Failure

**Scenario: Vercel/Hosting Down**
- Static frontend mirrors deployed
- API endpoints can still be accessed
- Direct blockchain interaction still works
- ETA: Resume in < 4 hours

**Scenario: Database Outage**
- Read-only mode activated
- Browse listings still works
- Transactions continue on-chain
- Restore from replica

**Scenario: Complete AWS/Provider Outage**
- Fallback infrastructure in different cloud
- DNS update to backup
- ETA: Resume in < 8 hours

---

## Testing & Drills

### Regular Testing

**Monthly:**
- Contract pause drill
- Backup restore test
- Incident response simulation

**Quarterly:**
- Full disaster recovery test
- Security penetration testing
- User communication dry-run

**Annually:**
- External security audit
- Infrastructure stress test
- Team training refresh

---

## Historical Incidents

### Incident Log

**[Date] - [Title]**
- Severity: [Level]
- Cause: [Root cause]
- Impact: [Who/what affected]
- Resolution: [How fixed]
- Prevention: [Steps taken]

*No incidents to date (platform not yet launched)*

---

## Contacts Summary

| Emergency Type | Contact Method | Response Time |
|----------------|----------------|---------------|
| Critical Security | security@yourplatform.com | < 15 min |
| Platform Outage | status.yourplatform.com | Live updates |
| Dispute Escalation | escalations@yourplatform.com | < 1 hour |
| User Compensation | compensation@yourplatform.com | < 24 hours |
| General Support | support@yourplatform.com | < 4 hours |

**24/7 Emergency:** Use Discord @Admin mention for urgent issues

---

## User Checklist

**During Platform Emergency:**
- [ ] Check status.yourplatform.com for updates
- [ ] Join Discord for real-time communication
- [ ] Your funds are safe in smart contract escrow
- [ ] Don't panic - read official updates only
- [ ] Avoid scams (we'll never DM you first)
- [ ] Wait for "all clear" announcement
- [ ] Report issues to official channels only

---

**Last Updated:** January 13, 2026
**Version:** 1.0
**Review Schedule:** Quarterly
