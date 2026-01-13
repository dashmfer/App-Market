# Future Features - Post-Launch

This document tracks features that are saved for post-launch implementation.

## 🔐 Verification Systems (Post-Launch)

### 1. Website Verification
**Status:** Saved for later
**Priority:** Low-Medium

**Implementation Methods:**
- **Option A - Meta Tag Verification:**
  - User adds: `<meta name="app-market-verification" content="abc123">`
  - Backend scrapes their website to verify the tag

- **Option B - DNS TXT Record:**
  - User adds TXT record to their domain
  - Backend queries DNS to verify ownership

- **Option C - File Upload Verification:**
  - User uploads `app-market-verify.txt` to their domain root
  - Backend checks: `https://example.com/app-market-verify.txt`

**Database Changes Needed:**
```prisma
model User {
  websiteUrl      String?
  websiteVerified Boolean   @default(false)  // ADD THIS
}
```

**API Routes Needed:**
- `POST /api/profile/verify-website` - Initiate verification
- `GET /api/profile/verify-website/check` - Check verification status

---

### 2. Twitter/X Verification
**Status:** Saved for later (too expensive for MVP)
**Priority:** Medium

**Why Delayed:**
- Twitter API costs $100+/month for OAuth access
- Will implement post-launch when we have revenue

**Implementation:**
- Twitter OAuth flow (similar to GitHub)
- Verify user owns the Twitter account
- Display verified badge on profile

**Database Changes Needed:**
```prisma
model User {
  twitterHandle   String?   // ADD THIS
  twitterId       String?   @unique  // ADD THIS
  twitterVerified Boolean   @default(false)  // ADD THIS
}
```

**API Routes Needed:**
- `POST /api/profile/verify-twitter` - Initiate Twitter OAuth
- `GET /api/auth/twitter/callback` - OAuth callback

---

### 3. Telegram Verification
**Status:** Saved for later
**Priority:** Low

**Implementation:**
- Telegram bot verification
- User sends verification code to bot
- Bot confirms ownership

**Database Changes Needed:**
```prisma
model User {
  telegramHandle   String?   // ADD THIS
  telegramId       String?   @unique  // ADD THIS
  telegramVerified Boolean   @default(false)  // ADD THIS
}
```

**Bot Needed:**
- Create Telegram bot via BotFather
- Implement webhook for verification messages
- Store bot token in environment variables

---

## ✅ Current Verification Systems (Implemented)

### GitHub Verification ✅
- OAuth flow implemented
- Free to use
- `githubVerified` field in User model

### Discord Verification ✅
- Schema ready: `discordVerified` field
- Needs OAuth implementation
- Discord OAuth is free

### Wallet Verification ✅
- Signature-based verification
- `walletVerified` field in User model

### Email Verification ✅
- Built-in with NextAuth
- `emailVerified` field in User model

---

## 📋 Implementation Checklist (When Ready)

**Website Verification:**
- [ ] Add `websiteVerified` to User model
- [ ] Create verification API routes
- [ ] Build verification UI component
- [ ] Choose verification method (meta tag / DNS / file)
- [ ] Implement backend verification logic

**Twitter Verification:**
- [ ] Purchase Twitter API access ($100+/month)
- [ ] Add Twitter fields to User model
- [ ] Set up Twitter OAuth app
- [ ] Create OAuth flow routes
- [ ] Build Twitter verification UI

**Telegram Verification:**
- [ ] Create Telegram bot
- [ ] Add Telegram fields to User model
- [ ] Implement bot webhook
- [ ] Create verification flow
- [ ] Build Telegram verification UI

---

## 💰 Cost Estimates

- **Website Verification:** Free (DIY implementation)
- **Telegram Verification:** Free (bot API is free)
- **Twitter/X Verification:** $100+/month (API access required)

**Total Monthly Cost for All 3:** ~$100/month

---

## 🎯 Implementation Priority Order

1. **Discord Verification** (schema ready, just needs OAuth) - FREE
2. **Website Verification** (good for legitimacy) - FREE
3. **Telegram Verification** (nice to have) - FREE
4. **Twitter Verification** (expensive, add when profitable) - $100+/month

---

**Last Updated:** 2026-01-13
