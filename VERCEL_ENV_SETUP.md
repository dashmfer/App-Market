# Vercel Environment Variable Setup

## Critical: Your live site doesn't use .env.local!

Your production site on Vercel uses environment variables configured in the Vercel Dashboard, NOT your local `.env.local` file.

## Step-by-Step: Add Environment Variables to Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your project (App-Market)
   - Click **Settings** → **Environment Variables**

2. **Add Required Variables:**

   Copy each variable from your LOCAL `.env.local` file and add them one by one:

   ### Authentication (REQUIRED)
   ```
   NEXTAUTH_URL=https://yourdomain.com  ← Use your actual Vercel domain
   NEXTAUTH_SECRET=<your-secret-from-local-env>
   ```

   ### Database (REQUIRED)
   ```
   DATABASE_URL=<your-production-database-url>
   ```

   ### GitHub OAuth (REQUIRED)
   ```
   GITHUB_ID=<your-github-client-id>
   GITHUB_SECRET=<your-github-client-secret>
   ```
   **Important:** Make sure your GitHub OAuth app has the production callback URL:
   - `https://yourdomain.com/api/auth/callback/github`

   ### Vercel Blob Storage (REQUIRED for profile pictures)
   ```
   BLOB_READ_WRITE_TOKEN=<your-vercel-blob-token>
   ```

   **How to get this token:**
   - Go to: https://vercel.com/dashboard/stores
   - Create a new Blob Store (if you haven't already)
   - Click on the store → Copy the `BLOB_READ_WRITE_TOKEN`
   - Paste it into your Vercel environment variables

   ### Solana (REQUIRED)
   ```
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_PLATFORM_FEE_BPS=500
   NEXT_PUBLIC_DISPUTE_FEE_BPS=200
   NEXT_PUBLIC_TOKEN_FEE_BPS=100
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   ```

   ### Optional (if you use them)
   ```
   GOOGLE_ID=<your-google-client-id>
   GOOGLE_SECRET=<your-google-client-secret>
   STRIPE_SECRET_KEY=<your-stripe-secret>
   STRIPE_PUBLISHABLE_KEY=<your-stripe-public-key>
   ```

3. **Select Environment:**
   - For each variable, select: **Production**, **Preview**, and **Development**
   - This ensures they work across all deployments

4. **Redeploy:**
   - After adding all variables, go to **Deployments** tab
   - Click the **three dots** on your latest deployment → **Redeploy**
   - This applies the new environment variables

## Troubleshooting Profile Uploads

If uploads still fail after adding variables:

1. **Check Browser Console:**
   - Open DevTools (F12) → Console tab
   - Try uploading a picture
   - Look for error messages

2. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → **Logs**
   - Try uploading a picture
   - Check for authentication or Blob storage errors

3. **Verify Blob Token:**
   - Make sure it starts with `vercel_blob_rw_`
   - Make sure it's from a Blob Store (not KV or Postgres)

4. **Test Authentication:**
   - Make sure you can sign in successfully on production
   - Check that your session is working (you should see your name/avatar in navbar)

5. **Check GitHub OAuth:**
   - Verify callback URL in GitHub settings matches your production URL
   - Should be: `https://yourdomain.com/api/auth/callback/github`

## Common Mistakes

❌ **Thinking Vercel uses your local `.env.local`** - It doesn't!
❌ **Not redeploying after adding variables** - Changes don't apply until redeploy
❌ **Using localhost URLs in production** - Use your real domain
❌ **Missing BLOB_READ_WRITE_TOKEN** - Profile uploads will fail without it
❌ **Wrong GitHub OAuth callback URL** - Authentication will fail

## Quick Checklist

- [ ] All environment variables added to Vercel Dashboard
- [ ] `BLOB_READ_WRITE_TOKEN` is from Vercel Blob Store
- [ ] `NEXTAUTH_URL` is your production domain (not localhost)
- [ ] GitHub OAuth callback URL includes production domain
- [ ] Redeployed after adding variables
- [ ] Tested sign-in on production
- [ ] Tested profile picture upload on production

---

**Remember:** Your `.env.local` file is only for local development. Production uses Vercel Dashboard settings!
