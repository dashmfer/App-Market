# App Market Setup Guide

This guide will help you set up and deploy App Market with all features including profile pictures, escrow, and more.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- GitHub OAuth App credentials
- Vercel account (for Blob storage)
- Stripe account (for payments)
- Solana wallet

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd App-Market
npm install
```

### 2. Database Setup

Create a PostgreSQL database and set up the schema:

```bash
# Copy environment file
cp .env.example .env.local

# Edit .env.local with your DATABASE_URL
# Example: DATABASE_URL="postgresql://user:password@localhost:5432/appmarket"

# Generate Prisma client and run migrations
npx prisma generate
npx prisma db push
```

### 3. Environment Variables

Edit `.env.local` with your credentials:

#### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/appmarket?schema=public"

# NextAuth (generate with: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production"

# GitHub OAuth (create at: https://github.com/settings/developers)
GITHUB_ID="your-github-oauth-client-id"
GITHUB_SECRET="your-github-oauth-client-secret"

# Vercel Blob (get from: https://vercel.com/dashboard/stores)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_XXXXXXXXXXXX"

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
NEXT_PUBLIC_SOLANA_NETWORK="devnet"
```

#### Optional Variables

```bash
# Stripe (for fiat payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Google OAuth (optional)
GOOGLE_ID="your-google-oauth-client-id"
GOOGLE_SECRET="your-google-oauth-client-secret"
```

### 4. Set Up Vercel Blob Storage

Profile pictures require Vercel Blob storage. Here's how to set it up:

1. Go to https://vercel.com/dashboard/stores
2. Click "Create Database" → "Blob"
3. Name it (e.g., "app-market-uploads")
4. Copy the `BLOB_READ_WRITE_TOKEN` to your `.env.local`

**Important:** Without this token, profile picture uploads will fail!

### 5. Set Up GitHub OAuth

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** App Market (or your name)
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Client Secret to `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Feature Checklist

After setup, verify these features work:

### ✅ Profile Picture Upload
1. Sign in with GitHub
2. Go to Settings → Profile
3. Click "Upload Photo"
4. Select an image (max 5MB)
5. Verify it uploads and displays

**Troubleshooting:**
- If upload fails with "Failed to upload": Check `BLOB_READ_WRITE_TOKEN` is set
- If you see 401 errors: Verify you're signed in
- Check browser console and terminal logs for errors

### ✅ Footer Pages
All footer links should now work:
- /guides/sellers
- /guides/buyers
- /guides/due-diligence
- /pricing
- /escrow
- /about
- /contact
- /terms
- /privacy

### ✅ Authentication
- GitHub login works
- Session persists
- User data saves to database

## Production Deployment

### Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial setup"
   git push origin main
   ```

2. **Deploy on Vercel:**
   - Go to https://vercel.com
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables:**
   - In Vercel dashboard → Settings → Environment Variables
   - Add all variables from `.env.local`
   - **Update these for production:**
     - `NEXTAUTH_URL` → your production domain
     - `NEXTAUTH_SECRET` → generate new secure secret
     - `GITHUB_ID` & `GITHUB_SECRET` → create new OAuth app for production domain
     - `NEXT_PUBLIC_SOLANA_NETWORK` → `mainnet-beta` (when ready)
     - Stripe keys → use live keys instead of test

4. **Set up Production Database:**
   - Use Vercel Postgres or external PostgreSQL
   - Update `DATABASE_URL` in Vercel environment variables
   - Run migrations: `npx prisma db push`

5. **Update GitHub OAuth:**
   - Add production callback URL: `https://yourdomain.com/api/auth/callback/github`

## Database Management

### View Database
```bash
npx prisma studio
```

### Reset Database (CAUTION: Deletes all data)
```bash
npx prisma db push --force-reset
```

### Generate Client After Schema Changes
```bash
npx prisma generate
```

## Common Issues

### Profile Pictures Not Uploading

**Problem:** Upload fails or shows error
**Solution:**
1. Verify `BLOB_READ_WRITE_TOKEN` is set in `.env.local`
2. Check you're using the token from Vercel Blob (not Vercel KV or other storage)
3. Ensure user is authenticated (check session)
4. Check browser console and server logs for specific error

### Database Connection Errors

**Problem:** Cannot connect to database
**Solution:**
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format is correct
3. Ensure database exists: `createdb appmarket`
4. Test connection: `npx prisma db pull`

### GitHub Login Not Working

**Problem:** GitHub OAuth fails
**Solution:**
1. Verify callback URL matches exactly in GitHub OAuth app settings
2. Check `GITHUB_ID` and `GITHUB_SECRET` are correct
3. Ensure `NEXTAUTH_URL` matches your current domain
4. Check `NEXTAUTH_SECRET` is set

### 404 Errors on Footer Links

**Problem:** Footer links show 404
**Solution:**
- This has been fixed! All 9 missing pages have been created
- If still seeing 404s, verify files exist in `/app/` directory
- Clear Next.js cache: `rm -rf .next && npm run dev`

## Security Checklist

Before going to production:

- [ ] Change `NEXTAUTH_SECRET` to a strong, random value
- [ ] Use production credentials for GitHub OAuth
- [ ] Use Stripe live keys (not test keys)
- [ ] Use mainnet-beta for Solana (not devnet)
- [ ] Set up proper CORS policies
- [ ] Enable HTTPS (Vercel does this automatically)
- [ ] Review and update Terms of Service and Privacy Policy
- [ ] Set up monitoring and error tracking
- [ ] Regular database backups
- [ ] Audit smart contracts before mainnet deployment

## Smart Contract Deployment

The marketplace smart contract needs to be deployed to Solana:

1. Review contract code in `/contracts/` directory
2. Test thoroughly on devnet
3. Get professional security audit
4. Deploy to mainnet-beta
5. Update `NEXT_PUBLIC_SOLANA_NETWORK` and contract addresses

## Getting Help

- **Documentation Issues:** Open an issue on GitHub
- **Feature Requests:** Email support@appmarket.xyz
- **Security Issues:** Email security@appmarket.xyz
- **General Questions:** Check `/how-it-works` page or contact support

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test all features locally
3. ✅ Review security checklist
4. ✅ Deploy to Vercel
5. ✅ Test production deployment
6. ✅ Configure monitoring
7. ✅ Announce launch!

---

**Note:** This is a complex marketplace application. Take time to understand each component before deploying to production.
