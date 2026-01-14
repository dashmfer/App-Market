# Deployment Guide

## Vercel Environment Variables

To fix session and authentication issues in production, ensure these environment variables are set correctly in your Vercel project:

### Critical Variables for Authentication

1. **NEXTAUTH_URL** (MOST IMPORTANT)
   - Must match your production domain EXACTLY
   - Example: `https://appmrkt.xyz` (or whatever your domain is)
   - DO NOT include trailing slashes
   - This MUST match the URL users access your site from

2. **NEXTAUTH_SECRET**
   - Generate a secure random string
   - Use: `openssl rand -base64 32`
   - Keep this secret and unique per environment

### How to Set in Vercel:

1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add/Update these variables:

```
NEXTAUTH_URL=https://your-actual-domain.com
NEXTAUTH_SECRET=your-generated-secret-key
DATABASE_URL=your-postgres-connection-string
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### After Setting Variables:

1. Redeploy your application (Environment variables only apply to new deployments)
2. Clear browser cookies and cache
3. Test authentication and profile upload

## Common Issues

### "Unauthorized - No active session found"
- **Cause**: NEXTAUTH_URL doesn't match your domain
- **Fix**: Set NEXTAUTH_URL to exactly match your production URL

### Wallet signature not prompting
- **Cause**: Missing wallet adapter or browser wallet not installed
- **Fix**: Install a Solana wallet (Phantom, Solflare) and check browser console for errors

### Profile picture upload fails
- **Cause**: Session cookies not being sent
- **Fix**: Ensure NEXTAUTH_URL is set correctly and redeploy

## Debugging

Check the browser console and Vercel logs for:
- `[Wallet Auth]` - Wallet authentication flow
- `[ProfilePictureUpload]` - Profile upload issues
- `[Wallet Verify API]` - Server-side wallet verification

All authentication flows include detailed logging to help diagnose issues.
