# 🔴 LIVE SITE FIX GUIDE

## Problem: Upload button disabled + "Not Authorized" errors

### Root Cause
Your session/authentication is broken on production because environment variables are missing or incorrect.

---

## ✅ STEP 1: Check Vercel Environment Variables

Go to your Vercel dashboard:
1. Navigate to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**

### REQUIRED Variables (must all be set):

```env
# Database - CRITICAL
DATABASE_URL=postgresql://...your-postgres-url...

# NextAuth - CRITICAL
NEXTAUTH_URL=https://your-actual-domain.com
NEXTAUTH_SECRET=generate-a-long-random-string-here

# GitHub OAuth - CRITICAL
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret

# Vercel Blob Storage - CRITICAL (for uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx

# Optional but recommended
GOOGLE_ID=your_google_client_id
GOOGLE_SECRET=your_google_client_secret
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SITE_URL=https://your-actual-domain.com
```

---

## ✅ STEP 2: Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and paste it as the value for `NEXTAUTH_SECRET` in Vercel.

---

## ✅ STEP 3: Set up Vercel Blob Storage

1. Go to: https://vercel.com/dashboard/stores
2. Click **Create Database** → **Blob**
3. Connect it to your project
4. Copy the `BLOB_READ_WRITE_TOKEN` that appears
5. Add it to your Vercel environment variables

---

## ✅ STEP 4: Verify Database Connection

Your DATABASE_URL should look like:
```
postgresql://user:password@host:5432/database?sslmode=require
```

Make sure it includes `?sslmode=require` at the end for production databases.

---

## ✅ STEP 5: Fix NEXTAUTH_URL

CRITICAL: `NEXTAUTH_URL` must be your actual production domain:
- ✅ CORRECT: `https://app-market-tau.vercel.app`
- ✅ CORRECT: `https://yourdomain.com`
- ❌ WRONG: `http://localhost:3000`
- ❌ WRONG: Empty/not set

---

## ✅ STEP 6: Redeploy

After setting ALL environment variables:
1. Go to **Deployments** tab in Vercel
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. Select **Use existing Build Cache** → NO (force fresh build)
5. Click **Redeploy**

---

## ✅ STEP 7: Test the Live Site

After redeployment completes:

1. Visit: `https://your-domain.com/api/debug/db-test`
   - Should return JSON with `"success": true`
   - If 404, the deployment didn't include all files

2. Sign in to your site
   - Go to Settings page
   - Check browser console (F12) for errors
   - Look for session logs

3. Try uploading a profile picture
   - Button should be enabled
   - Upload should work

---

## 🔍 DEBUGGING: Check Vercel Logs

If still broken:
1. Go to Vercel dashboard → **Deployments**
2. Click on the latest deployment
3. Click **Functions** tab
4. Look for errors in the logs
5. Check for:
   - "Cannot connect to database"
   - "NEXTAUTH_SECRET not defined"
   - "BLOB_READ_WRITE_TOKEN not defined"

---

## 🚨 Common Issues

### Issue: Button still disabled
**Cause:** Session not establishing
**Fix:** Check NEXTAUTH_URL and NEXTAUTH_SECRET are set correctly

### Issue: "Not authorized" error
**Cause:** Session exists but user.id is missing
**Fix:** Check DATABASE_URL is correct and database has users table

### Issue: Upload fails with 500 error
**Cause:** BLOB_READ_WRITE_TOKEN missing or invalid
**Fix:** Create Vercel Blob storage and add token

### Issue: 404 on /api/debug/db-test
**Cause:** File not included in deployment
**Fix:** Make sure file exists, then force redeploy

---

## 📋 Quick Checklist

- [ ] All 5 critical env vars set in Vercel
- [ ] NEXTAUTH_URL = production domain (NOT localhost)
- [ ] NEXTAUTH_SECRET = long random string
- [ ] DATABASE_URL includes `?sslmode=require`
- [ ] Vercel Blob storage created and token added
- [ ] Force redeployed (no build cache)
- [ ] Tested /api/debug/db-test endpoint
- [ ] Tested sign in
- [ ] Tested profile picture upload

---

## 🆘 Still Not Working?

Run these commands to check your local code is up to date:

```bash
# Check what branch you're on
git branch

# Make sure you have the latest code
git pull origin claude/audit-solana-contract-lf2AT

# Push any local changes
git push origin claude/audit-solana-contract-lf2AT
```

Then check Vercel is deploying from the correct branch:
1. Vercel dashboard → Settings → Git
2. Make sure it's connected to the right branch
