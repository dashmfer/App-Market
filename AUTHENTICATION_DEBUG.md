# Authentication Debugging Guide

## Issue: "Unauthorized - No active session found" on Profile Upload

This comprehensive guide will help you debug and fix the authentication issues.

## Quick Diagnosis Steps

### Step 1: Check Browser Console (MOST IMPORTANT)

Open the browser console (F12 or Command+Option+J) and look for these logs:

```
[Settings] Session status: authenticated  ← Should say "authenticated"
[Settings] Session data: {user: {…}}      ← Should have user object
[Settings] Has session: true              ← Should be true
[Settings] Has user: true                 ← Should be true
[Settings] User ID: clxxxxx               ← Should show an ID
```

**If session status is "unauthenticated" or "loading":**
- You are NOT actually signed in
- Sign out and sign in again
- Check if authentication is working at all

### Step 2: Check Network Tab

1. Open browser DevTools → Network tab
2. Try to upload a profile picture
3. Find the request to `/api/profile/upload-picture`
4. Click on it and check the "Headers" tab

**Look for these headers in the request:**
```
Cookie: next-auth.session-token=xxxxx  (or __Secure-next-auth.session-token in production)
```

**If Cookie header is missing:**
- The credentials: "include" setting isn't working
- Check if you're on HTTPS in production (HTTP won't send secure cookies)
- Check the code changes were deployed

### Step 3: Check Server Logs (Vercel)

Go to Vercel Dashboard → Your Project → Logs

Look for these console logs:
```
[Upload Picture - Session Debug]
```

**If session is null on server:**
- Environment variables are NOT set correctly on Vercel
- Go to Step 4

### Step 4: Verify Vercel Environment Variables

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

**REQUIRED Environment Variables:**

```bash
NEXTAUTH_URL=https://appmrkt.xyz
NEXTAUTH_SECRET=<your-secret-from-openssl>
DATABASE_URL=<your-postgres-url>
BLOB_READ_WRITE_TOKEN=<your-blob-token>
```

**CRITICAL:**
- `NEXTAUTH_URL` MUST match your production domain EXACTLY
- Must be `https://` (not `http://`)
- NO trailing slash
- After adding/changing variables, you MUST redeploy (variables only apply to new deployments)

## Common Issues & Solutions

### Issue 1: Session Shows as Unauthenticated
**Symptoms:**
- Console shows: `Session status: unauthenticated`
- Upload button says "Sign in to upload"

**Solution:**
1. Sign out completely
2. Close all browser tabs for the site
3. Clear cookies for the domain
4. Sign in again
5. Check console logs again

### Issue 2: Session Works in Dev, Fails in Production
**Symptoms:**
- Works on localhost:3000
- Fails on appmrkt.xyz

**Root Cause:** Environment variables not set on Vercel

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Set `NEXTAUTH_URL=https://appmrkt.xyz` (or your domain)
3. Set `NEXTAUTH_SECRET` (generate with: `openssl rand -base64 32`)
4. Click "Redeploy" in Vercel
5. Wait for deployment to complete
6. Clear browser cookies and sign in again

### Issue 3: Cookies Not Being Sent
**Symptoms:**
- Network tab shows no Cookie header in request
- Console shows session exists but API says no session

**Root Cause:** Mixed content (HTTPS/HTTP) or wrong credentials setting

**Solution:**
1. Make sure you're accessing the site via HTTPS (not HTTP)
2. Check if the credentials: "include" fix was deployed:
   - Go to your repo
   - Check `app/dashboard/settings/page.tsx` line 85-89
   - Should say `credentials: "include"`
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue 4: Wrong Cookie Name in Production
**Symptoms:**
- Cookie is named `next-auth.session-token` in production
- Should be `__Secure-next-auth.session-token` in production

**Root Cause:** NODE_ENV not set to "production" on Vercel

**Solution:**
This is usually automatic on Vercel, but check:
1. Vercel → Settings → Environment Variables
2. Add `NODE_ENV=production` (only if missing)
3. Redeploy

### Issue 5: Smart Contract Not Deployed (User's Concern)
**Symptoms:**
- Worried that Solana contract not being deployed is causing auth issues

**Answer:** NO - Authentication doesn't depend on smart contracts!
- Authentication uses NextAuth with JWT sessions
- Smart contracts are only needed for buying/selling projects
- Authentication should work regardless of contract deployment

## Testing Checklist

After making fixes, test in this order:

- [ ] Check browser console for session logs
- [ ] Verify session status shows "authenticated"
- [ ] Verify session has user.id
- [ ] Check Network tab for Cookie header in upload request
- [ ] Try uploading a small image (< 1MB)
- [ ] Check Vercel logs for success/error messages
- [ ] Test in incognito/private window
- [ ] Test after signing out and back in

## Environment Variable Template

Create these in Vercel → Settings → Environment Variables:

```bash
# NextAuth (REQUIRED)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generated-secret-here

# Database (REQUIRED)
DATABASE_URL=your-postgres-connection-string

# Vercel Blob (REQUIRED for uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx

# OAuth (optional - only if using)
GITHUB_ID=your-github-oauth-id
GITHUB_SECRET=your-github-oauth-secret
GOOGLE_ID=your-google-oauth-id
GOOGLE_SECRET=your-google-oauth-secret

# Solana (for blockchain features)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

## Still Not Working?

If you've tried all the above and it's still failing:

1. **Check deployment:** Make sure the latest code is deployed
   ```bash
   git log -1  # Check latest commit
   # Go to Vercel and verify this commit is deployed
   ```

2. **Check cookies manually:**
   - Open DevTools → Application → Cookies
   - Look for `next-auth.session-token` or `__Secure-next-auth.session-token`
   - If missing, authentication isn't working at all

3. **Test auth flow:**
   - Sign out
   - Sign in with a fresh account
   - Immediately try to upload before doing anything else

4. **Check API route directly:**
   Open browser console and run:
   ```javascript
   fetch('/api/profile/upload-picture', {
     method: 'POST',
     credentials: 'include',
     body: new FormData() // empty form
   }).then(r => r.json()).then(console.log)
   ```
   This should show the actual error from the API

## Contact Support

If all else fails, share these details:
- Browser console logs (full session debug output)
- Network tab screenshot showing request headers
- Vercel server logs
- Confirmation that environment variables are set
- Whether it works in development vs production
