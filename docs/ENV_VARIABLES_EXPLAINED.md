# Environment Variables: .env.local vs Vercel Dashboard

## **The Key Difference** ⚠️

### `.env.local` (Local Development)
- **Used when:** Running `npm run dev` on your computer
- **Purpose:** Development environment (localhost:3000)
- **Domain:** `http://localhost:3000`
- **Location:** File in your project folder
- **Security:** Git-ignored (never pushed to GitHub)

### **Vercel Dashboard Environment Variables** (Production)
- **Used when:** Deployed site running on Vercel servers
- **Purpose:** Production environment (your live website)
- **Domain:** `https://appmrkt.xyz` (or your actual domain)
- **Location:** Vercel Dashboard → Settings → Environment Variables
- **Security:** Stored securely on Vercel servers

## **Why This Is Likely Your Issue** 🎯

Looking at your `.env.local`:
```bash
NEXTAUTH_URL="http://localhost:3000"  # ← This is for LOCAL development only!
```

But your **production site needs**:
```bash
NEXTAUTH_URL="https://appmrkt.xyz"    # ← Your actual production domain!
```

### What Happens When This Is Wrong:
1. ❌ NextAuth can't create proper session cookies
2. ❌ Authentication appears to work but sessions are invalid
3. ❌ Upload button stays disabled with "Sign in to upload"
4. ❌ API returns "Unauthorized - No active session found"

## **Verification Checklist** ✅

### Step 1: Check Vercel Dashboard Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

You should see these variables set for **Production**:

```bash
# CRITICAL - Must match your domain EXACTLY
NEXTAUTH_URL=https://appmrkt.xyz

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-generated-secret-here

# Your database connection string
DATABASE_URL=postgresql://username:password@host:5432/database

# From Vercel Blob Storage settings
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXX

# Solana configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Platform settings
NEXT_PUBLIC_PLATFORM_FEE_BPS=500
NEXT_PUBLIC_DISPUTE_FEE_BPS=200
NEXT_PUBLIC_TOKEN_FEE_BPS=100

# Your production domain
NEXT_PUBLIC_SITE_URL=https://appmrkt.xyz
```

### Step 2: Critical Checks

#### ⚠️ Check `NEXTAUTH_URL` specifically:
- [ ] Is it set to `https://appmrkt.xyz` (or your actual domain)?
- [ ] Does it start with `https://` (NOT `http://`)?
- [ ] Does it have NO trailing slash?
- [ ] Does it EXACTLY match your production domain?

**Common Mistakes:**
- ❌ `http://appmrkt.xyz` (missing HTTPS)
- ❌ `https://appmrkt.xyz/` (has trailing slash)
- ❌ `https://appmarket.xyz` (wrong domain)
- ❌ `http://localhost:3000` (still set to local!)
- ✅ `https://appmrkt.xyz` (CORRECT!)

#### 🔐 Check `NEXTAUTH_SECRET`:
- [ ] Is it set to a long random string?
- [ ] Is it the same secret you're using (not the example one)?

#### 💾 Check `DATABASE_URL`:
- [ ] Does it point to your production database?
- [ ] NOT `localhost` (should be a cloud database URL)

#### 📦 Check `BLOB_READ_WRITE_TOKEN`:
- [ ] Starts with `vercel_blob_rw_`?
- [ ] Is the actual token (not placeholder)?

### Step 3: Verify Environment is "Production"

In Vercel Dashboard, when you added these variables:
- [ ] Did you select **"Production"** environment?
- [ ] Or did you accidentally only set them for "Preview" or "Development"?

**Important:** Each variable has checkboxes for:
- ☑️ Production (MUST be checked)
- ☐ Preview (optional)
- ☐ Development (optional)

### Step 4: Did You Redeploy? **CRITICAL!**

**Environment variables ONLY apply to NEW deployments!**

After adding/changing variables yesterday:
- [ ] Did you click "Redeploy" in Vercel?
- [ ] Did you wait for deployment to complete (green checkmark)?

**How to redeploy:**
1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the latest deployment
3. Click the three dots (•••) → "Redeploy"
4. Click "Redeploy" to confirm
5. Wait for the green checkmark

### Step 5: Test the Live Site

After redeploying:
1. Open your production site in **incognito/private window**
2. Open browser console (F12)
3. Sign in to your account
4. Check console logs:
```
[Settings] Session status: authenticated  ← Should say "authenticated"
[Settings] Has user: true                 ← Should be true
[Settings] User ID: clxxxxx               ← Should show an ID
```

5. Try to upload a photo
6. Check if button is enabled

## **Most Common Issue: Environment Variables Changed But Not Redeployed** 🔄

**Scenario:**
- ✅ Added all environment variables to Vercel yesterday
- ✅ Variables show up in Vercel Dashboard
- ❌ Upload still doesn't work

**Why:** The variables are saved in Vercel, but your deployed site is still using the OLD build (from before you added them).

**Solution:** Redeploy!

## **How to Verify Environment Variables Are Being Used**

### Check Server Logs:
1. Go to Vercel Dashboard → Your Project → Logs
2. Try to upload a photo on your production site
3. Look for this log entry:
```
[Upload Picture - Session Debug]
hasSession: true   ← Should be true
hasUser: true      ← Should be true
userId: clxxxxx    ← Should show your user ID
```

**If you see:**
```
hasSession: false   ← Problem!
```
Then environment variables aren't set correctly or deployment is old.

## **Quick Fix Summary** 🚀

1. **Go to Vercel Dashboard**
   - Settings → Environment Variables

2. **Verify these are set for Production:**
   ```
   NEXTAUTH_URL=https://your-actual-domain.com
   NEXTAUTH_SECRET=your-actual-secret
   DATABASE_URL=your-actual-database-url
   BLOB_READ_WRITE_TOKEN=your-actual-token
   ```

3. **Check NEXTAUTH_URL specifically:**
   - Must be `https://` (not `http://`)
   - Must match your domain exactly
   - No trailing slash

4. **Redeploy:**
   - Deployments tab → Latest deployment → ••• → Redeploy

5. **Wait for deployment to complete** (green checkmark)

6. **Test in incognito window:**
   - Sign in
   - Check console logs
   - Try to upload

7. **If still not working:**
   - Sign out completely
   - Clear browser cookies
   - Sign back in
   - Try upload again

## **Still Not Working?**

Share these with me:
1. Screenshot of Vercel environment variables page (blur sensitive values)
2. Browser console logs when trying to upload
3. Your production domain URL
4. Confirmation that you redeployed after setting variables

I'll help you debug further!
