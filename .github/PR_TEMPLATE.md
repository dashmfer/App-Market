# Fix wallet authentication and profile upload session issues

## Summary

This PR fixes two critical authentication issues:
1. **Wallet signature prompt not appearing** - Added comprehensive debugging
2. **Profile upload "Unauthorized" error** - Fixed session authentication

## Changes

### 1. Wallet Authentication Debugging (`6023dcc`)

**Client-side (app/auth/signin/page.tsx):**
- ✅ Added detailed console logging throughout wallet auth flow
- ✅ Fixed useEffect dependency to include `signMessage`
- ✅ Added wallet capability checks and better error messages
- ✅ Improved error handling for various wallet scenarios

**Server-side (app/api/auth/wallet/verify/route.ts):**
- ✅ Added server-side logging for signature verification
- ✅ Logs each step: request received, verification, user creation

### 2. Profile Upload Session Fix (`bcc38f3`)

**Client-side (components/profile/ProfilePictureUpload.tsx):**
- ✅ Added `useSession` hook to check authentication before upload
- ✅ Changed `credentials: 'same-origin'` to `credentials: 'include'`
- ✅ Disable upload button when not authenticated
- ✅ Show "Sign in to upload" message when session is missing
- ✅ Comprehensive error handling and logging

**Server-side (lib/auth.ts):**
- ✅ Added explicit cookie configuration for production
- ✅ Set secure cookies with `__Secure-` prefix in production
- ✅ Configure `sameSite: 'lax'` for cross-site compatibility
- ✅ Set session maxAge to 30 days
- ✅ Enable debug mode in development

**Documentation (DEPLOYMENT.md):**
- ✅ Environment variable setup guide
- ✅ Common issues and fixes
- ✅ Debugging tips

## 🚨 Critical: Environment Variables Required

After merging, you **MUST** set these in Vercel:

```bash
NEXTAUTH_URL=https://appmrkt.xyz
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
```

Then **redeploy** - environment variables only apply to new deployments.

## Testing

### Wallet Authentication
1. Open browser console (Command + Option + J)
2. Click "Connect Wallet"
3. Watch for `[Wallet Auth]` logs showing each step
4. Signature prompt should appear

### Profile Upload
1. Sign in to your account
2. Go to Settings
3. Check console for `[ProfilePictureUpload]` logs
4. Should show session status
5. Upload should work after setting NEXTAUTH_URL

## Files Changed

- `app/auth/signin/page.tsx` - Wallet auth debugging
- `app/api/auth/wallet/verify/route.ts` - Server-side logging
- `components/profile/ProfilePictureUpload.tsx` - Session checks
- `lib/auth.ts` - Cookie configuration
- `DEPLOYMENT.md` - Setup documentation

## Debugging

All authentication flows now include comprehensive logging:
- `[Wallet Auth]` - Client-side wallet authentication
- `[Wallet Verify API]` - Server-side signature verification
- `[ProfilePictureUpload]` - Profile picture upload flow

Check browser console for detailed information if issues occur.
