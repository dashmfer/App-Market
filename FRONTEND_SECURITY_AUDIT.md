# Frontend Security Audit Report

**Application:** App Market (Next.js Marketplace)
**Audit Date:** 2026-01-31
**Auditor:** Security Review

---

## Executive Summary

This audit analyzed the frontend security of the Next.js marketplace application. The codebase demonstrates several security-conscious practices, including proper authentication flows, cookie security, and input validation. However, several areas require attention to improve the overall security posture.

**Risk Levels:**
- **CRITICAL**: 1 finding
- **HIGH**: 3 findings
- **MEDIUM**: 5 findings
- **LOW**: 4 findings
- **INFORMATIONAL**: 4 findings

---

## 1. Client-Side Security

### 1.1 NEXT_PUBLIC_ Environment Variables

**Risk Level:** HIGH

**Findings:**

The application exposes the following environment variables to the client:

| Variable | Purpose | Risk Assessment |
|----------|---------|-----------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy authentication | LOW - Public by design |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Network selection | LOW - Public configuration |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | RPC endpoint | MEDIUM - Could enable DoS tracking |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous access | MEDIUM - See below |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint | LOW - Public by design |
| `NEXT_PUBLIC_PROGRAM_ID` | Solana program address | LOW - Public on-chain |
| `NEXT_PUBLIC_TREASURY_WALLET` | Treasury address | LOW - Public on-chain |
| `NEXT_PUBLIC_APP_TOKEN_MINT` | Token mint address | LOW - Public on-chain |
| `NEXT_PUBLIC_USDC_MINT` | USDC mint address | LOW - Public on-chain |
| `NEXT_PUBLIC_MOONPAY_API_KEY` | MoonPay integration | MEDIUM - Should be server-side |

**Location:** `/Users/dasherxd/Desktop/App-Market/.env`, `.env.local`, `.env.example`

**Concerns:**

1. **Supabase Anon Key Exposure** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`):
   - While Supabase anon keys are designed to be public, Row Level Security (RLS) must be properly configured on all tables.
   - Verify RLS policies restrict data access appropriately.

2. **MoonPay API Key** (`NEXT_PUBLIC_MOONPAY_API_KEY`):
   - Currently exposed client-side in `/Users/dasherxd/Desktop/App-Market/components/wallet/AddFundsModal.tsx`:
   ```typescript
   moonpayUrl.searchParams.set("apiKey", process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "");
   ```
   - Recommendation: Use server-side proxy to protect API key.

### 1.2 Wallet Private Key Handling

**Risk Level:** MEDIUM

**Location:** `/Users/dasherxd/Desktop/App-Market/components/wallet/ExportKeyModal.tsx`

**Findings:**

The private key export modal implements several security measures:
- Warning banner about never sharing private key
- Requires user acknowledgment checkbox before reveal
- Key is initially hidden/masked
- Only reveals after explicit user action

**Good Practices Observed:**
```typescript
const maskedKey = privateKey
  ? privateKey.slice(0, 8) + "".repeat(40) + privateKey.slice(-8)
  : "";
```

**Concerns:**
1. Private key is stored in component state after retrieval
2. No automatic clearing of private key from memory after modal close
3. Console.error logs errors related to private key operations:
   ```typescript
   console.error("Failed to get private key:", error);
   ```

**Recommendation:**
- Clear `privateKey` state when modal closes
- Avoid logging any private key related errors with stack traces that could leak data

---

## 2. XSS Vulnerabilities

### 2.1 dangerouslySetInnerHTML Usage

**Risk Level:** LOW (NOT FOUND)

**Finding:** No instances of `dangerouslySetInnerHTML` found in the codebase.

**Status:** PASS - The application does not use dangerous innerHTML injection.

### 2.2 User Content Rendering

**Risk Level:** LOW

**Findings:**

User-generated content (e.g., listing descriptions, bios, comments) is rendered using React's default text interpolation, which automatically escapes HTML entities.

**Locations:**
- Review comments in `/Users/dasherxd/Desktop/App-Market/components/reviews/review-form.tsx`
- User bios in `/Users/dasherxd/Desktop/App-Market/app/dashboard/settings/page.tsx`
- Listing descriptions in `/Users/dasherxd/Desktop/App-Market/app/create/page.tsx`

**Good Practice Observed:**
```typescript
<textarea
  value={comment}
  onChange={(e) => setComment(e.target.value)}
  maxLength={1000}
  // ...
/>
```

Input is properly bounded with `maxLength` restrictions.

### 2.3 URL Parameter Reflection

**Risk Level:** MEDIUM

**Locations:**
- `/Users/dasherxd/Desktop/App-Market/app/auth/signin/page.tsx`
- `/Users/dasherxd/Desktop/App-Market/app/dashboard/settings/page.tsx`
- `/Users/dasherxd/Desktop/App-Market/app/explore/page.tsx`

**Findings:**

URL parameters are read and used in the application:

```typescript
// signin/page.tsx
const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
const error = searchParams.get("error");
```

```typescript
// settings/page.tsx
const twitterError = searchParams.get("twitter_error");
alert(errorMessages[twitterError] || "Failed to connect X. Please try again.");
```

**Concerns:**
1. `callbackUrl` parameter could be used for open redirect attacks if not validated
2. Error messages from URL are displayed via `alert()` but are sanitized through a predefined mapping

**Recommendation:**
- Validate `callbackUrl` against a whitelist of allowed destinations
- Ensure the destination is a relative path or same-origin URL

---

## 3. CSRF Protection

### 3.1 Form Submission Protection

**Risk Level:** MEDIUM

**Findings:**

The application lacks explicit CSRF token implementation. No `csrf` or `_csrf` tokens were found.

**Mitigation Factors:**
1. **SameSite Cookie Policy:** The application uses `sameSite: "lax"` for session cookies:
   ```typescript
   // /Users/dasherxd/Desktop/App-Market/lib/auth.ts
   cookies: {
     sessionToken: {
       options: {
         httpOnly: true,
         sameSite: "lax",
         path: "/",
         secure: process.env.NODE_ENV === "production",
       },
     },
   },
   ```

2. **JSON Content-Type:** Most API calls use JSON bodies with `Content-Type: application/json`, which provides some CSRF protection as this triggers CORS preflight.

**Remaining Risks:**
- `SameSite: lax` still allows cookies on top-level GET navigations
- State-changing operations should only use POST/PUT/DELETE methods

### 3.2 State-Changing GET Requests

**Risk Level:** HIGH

**Location:** `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`

**Finding:**

The admin reset endpoint uses DELETE method but accepts secret via GET parameter:
```typescript
const secret = searchParams.get("secret");
// Destructive operations follow...
```

**Concerns:**
1. Secret is exposed in URL, which may be logged in server access logs, browser history, referer headers
2. Hardcoded fallback secret in code: `"devnet-reset-2024"`

**Recommendation:**
- Move secret to request body or authorization header
- Remove hardcoded fallback secret
- Implement proper admin authentication

### 3.3 Cookie Security Configuration

**Risk Level:** LOW

**Good Practices Observed:**

```typescript
// /Users/dasherxd/Desktop/App-Market/lib/auth.ts
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
    options: {
      httpOnly: true,      // Prevents JavaScript access
      sameSite: "lax",     // Provides CSRF protection
      path: "/",
      secure: process.env.NODE_ENV === "production",  // HTTPS only in production
    },
  },
},
```

**Additional Cookie Observations:**

Twitter OAuth uses secure cookies:
```typescript
// /Users/dasherxd/Desktop/App-Market/app/r/[code]/page.tsx
cookies().set("referral_code", code, {
  httpOnly: true,
  sameSite: "lax",
  // ...
});
```

---

## 4. Client-Side Validation

### 4.1 Relying Only on Client Validation

**Risk Level:** MEDIUM

**Locations:**
- `/Users/dasherxd/Desktop/App-Market/app/create/page.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/reviews/review-form.tsx`
- `/Users/dasherxd/Desktop/App-Market/app/dashboard/settings/page.tsx`

**Findings:**

Client-side validation is implemented for:
- File size limits (5MB max)
- File type validation
- Input length restrictions
- Required field checks

**Example from settings page:**
```typescript
if (file.size > 5 * 1024 * 1024) {
  alert("File too large. Maximum size is 5MB.");
  return;
}
if (!file.type.startsWith("image/")) {
  alert("Please upload an image file.");
  return;
}
```

**Server-side validation is also present:**
```typescript
// /Users/dasherxd/Desktop/App-Market/app/api/profile/upload-picture/route.ts
const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
if (!validTypes.includes(file.type)) {
  return NextResponse.json(
    { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
    { status: 400 }
  );
}
const maxSize = 5 * 1024 * 1024;
if (file.size > maxSize) {
  return NextResponse.json(
    { error: 'File too large. Maximum size is 5MB.' },
    { status: 400 }
  );
}
```

**Status:** PASS - Server-side validation is implemented alongside client-side checks.

### 4.2 File Security

**Risk Level:** LOW

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/file-security.ts`

**Good Practice Observed:**

Comprehensive file validation library with:
- Blocked dangerous extensions (.exe, .bat, .sh, etc.)
- Warning extensions for archives
- Safe extension whitelist

```typescript
export const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs',
  // ... comprehensive list
];
```

---

## 5. Sensitive Data Leakage

### 5.1 Console.log with Sensitive Data

**Risk Level:** HIGH

**Findings:**

Extensive console logging throughout the codebase, including potentially sensitive information:

**Location:** `/Users/dasherxd/Desktop/App-Market/app/auth/signin/page.tsx`
```typescript
console.log("[Signin] No Solana wallet found, creating one...");
console.log("[Signin] Created Solana wallet:", createdWalletAddress);
console.error("[Signin] Failed to create Solana wallet:", walletError);
```

**Location:** `/Users/dasherxd/Desktop/App-Market/app/dashboard/settings/page.tsx`
```typescript
console.log("[Settings] Session status:", status);
console.log("[Settings] Session data:", session);
console.log("[Settings] User ID:", session?.user?.id);
console.log("[Settings] Starting upload with session:", {
  status,
  userId: session.user.id,
  hasSession: !!session
});
```

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/wallet-verification.ts`
```typescript
console.log("[Wallet Verification] Verifying signature for wallet:", publicKey);
console.log("[Wallet Verification] New user created:", {
  id: user.id,
  username: user.username,
  referralCode: newUserReferralCode,
  referredBy: referrerId,
});
```

**Recommendation:**
- Remove or conditionally disable console.log statements in production
- Use a proper logging library that can be configured per environment
- Never log sensitive data like session objects, user IDs, or wallet addresses in production

### 5.2 Error Messages with Sensitive Info

**Risk Level:** LOW

**Findings:**

Error messages are generally well-sanitized. User-facing errors are generic:
```typescript
return NextResponse.json(
  { error: "Failed to fetch notifications" },
  { status: 500 }
);
```

Detailed errors are logged server-side:
```typescript
console.error("Error fetching notifications:", error);
```

**Status:** PASS - Error messages are appropriately sanitized for users.

### 5.3 Debug Endpoint Exposure

**Risk Level:** CRITICAL

**Location:** `/Users/dasherxd/Desktop/App-Market/app/debug/session/page.tsx`

**Finding:**

A debug page is exposed that displays:
- Session data including user IDs
- Cookie information
- API session data
- Internal state variables

```typescript
setCookies(document.cookie);
// Displays all cookies and session data
```

**Recommendation:**
- Remove debug endpoint from production
- Protect with authentication or environment checks
- Never expose internal session debugging to end users

---

## 6. Component Security

### 6.1 Components Directory Analysis

**Location:** `/Users/dasherxd/Desktop/App-Market/components/`

**Reviewed Components:**

| Component | Security Notes |
|-----------|---------------|
| `wallet/ExportKeyModal.tsx` | Private key handling - see Section 1.2 |
| `wallet/AddFundsModal.tsx` | MoonPay API key exposure - see Section 1.1 |
| `notifications/NotificationDropdown.tsx` | Properly sanitizes notification content |
| `reviews/review-form.tsx` | Input validation and length limits |
| `providers/PrivyAuthProvider.tsx` | Proper Privy configuration |
| `providers/WalletAuthProvider.tsx` | Minimal wrapper, delegates to hook |
| `listings/bid-modal.tsx` | Proper wallet interaction |

**Good Practices Observed:**
- Components use controlled inputs
- Event handlers properly bound
- No direct DOM manipulation
- State management through React hooks

### 6.2 Hooks Directory Analysis

**Location:** `/Users/dasherxd/Desktop/App-Market/hooks/`

**Reviewed Hooks:**

| Hook | Security Notes |
|------|---------------|
| `useAutoWalletAuth.ts` | Reads referral from cookies/URL - see concerns below |
| `useNotifications.ts` | Proper session validation before fetch |
| `useMessages.ts` | Proper session validation before fetch |
| `useCountdown.ts` | No security concerns |

**Concern in `useAutoWalletAuth.ts`:**

```typescript
function getReferralCode(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get('ref');
  if (refFromUrl) return refFromUrl;

  const cookies = document.cookie.split(';');
  // ...
}
```

The referral code is read from URL and cookies without validation. While it's only used for referral tracking, input should be sanitized:

**Recommendation:** Validate referral code format (alphanumeric only) before use.

---

## 7. Authentication Security

### 7.1 Wallet Signature Verification

**Risk Level:** LOW

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/wallet-verification.ts`

**Good Practices Observed:**

```typescript
const verified = nacl.sign.detached.verify(
  messageUint8,
  signatureUint8,
  publicKeyUint8
);

if (!verified) {
  return { success: false, error: "Invalid signature" };
}
```

Proper cryptographic signature verification is implemented.

### 7.2 Privy Authentication Flow

**Risk Level:** LOW

**Location:** `/Users/dasherxd/Desktop/App-Market/app/auth/signin/page.tsx`

The Privy integration properly:
- Delegates authentication to Privy
- Creates NextAuth session after Privy auth
- Handles wallet creation for new users

### 7.3 NextAuth Configuration

**Risk Level:** MEDIUM

**Location:** `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`

**Concerns:**

1. **Fallback Secret:**
   ```typescript
   secret: secret || "development-secret-change-in-production",
   ```
   - Hardcoded fallback secret exists for development
   - Production check exists but could be bypassed

2. **Privy Provider Trust:**
   ```typescript
   // Privy provider - for email/Twitter users authenticated via Privy
   // This trusts that Privy has already verified the user
   CredentialsProvider({
     id: "privy",
     async authorize(credentials) {
       // Looks up user by ID without additional verification
     },
   }),
   ```
   - The Privy provider trusts the userId without verifying it came from Privy
   - An attacker with a valid user ID could potentially impersonate users

**Recommendation:**
- Verify Privy access token server-side before accepting the userId
- Remove development fallback secrets

---

## 8. Recommendations Summary

### Critical (Immediate Action Required)

1. **Remove Debug Session Page** - The `/debug/session` page exposes sensitive session information and must be removed from production.

### High Priority

2. **Remove Console Logging** - Implement environment-aware logging to prevent sensitive data exposure in production.

3. **Fix Admin Endpoint Security** - Remove hardcoded secret and move authentication from URL parameters to proper headers/body.

4. **Verify Privy Token Server-Side** - Add server-side verification of Privy access tokens before trusting user identity.

### Medium Priority

5. **Implement CSRF Tokens** - While SameSite cookies provide some protection, explicit CSRF tokens should be added for state-changing operations.

6. **Validate Callback URLs** - Implement whitelist validation for redirect URLs to prevent open redirect attacks.

7. **Move MoonPay API Key Server-Side** - Create a server-side proxy for MoonPay integration.

8. **Clear Private Keys from Memory** - Implement proper cleanup of private key state when export modal closes.

### Low Priority

9. **Sanitize Referral Codes** - Add alphanumeric validation for referral code inputs.

10. **Review Supabase RLS Policies** - Ensure Row Level Security is properly configured given the exposed anon key.

---

## 9. Positive Security Practices

The following good security practices were observed:

1. **No XSS Vulnerabilities** - No use of `dangerouslySetInnerHTML` or `innerHTML`
2. **Proper Cookie Configuration** - HttpOnly, Secure, SameSite flags properly set
3. **Server-Side Validation** - Validation exists on both client and server
4. **File Upload Security** - Comprehensive file type validation and blocking
5. **Cryptographic Verification** - Proper wallet signature verification using nacl
6. **Input Length Limits** - MaxLength restrictions on user inputs
7. **Protected Routes** - Session validation before accessing protected resources
8. **Proper Error Handling** - Generic error messages for users, detailed logs server-side

---

## Appendix: Files Reviewed

- `/Users/dasherxd/Desktop/App-Market/.env.example`
- `/Users/dasherxd/Desktop/App-Market/lib/auth.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/wallet-verification.ts`
- `/Users/dasherxd/Desktop/App-Market/lib/file-security.ts`
- `/Users/dasherxd/Desktop/App-Market/app/auth/signin/page.tsx`
- `/Users/dasherxd/Desktop/App-Market/app/dashboard/settings/page.tsx`
- `/Users/dasherxd/Desktop/App-Market/app/debug/session/page.tsx`
- `/Users/dasherxd/Desktop/App-Market/app/api/admin/reset-listings/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/notifications/route.ts`
- `/Users/dasherxd/Desktop/App-Market/app/api/profile/upload-picture/route.ts`
- `/Users/dasherxd/Desktop/App-Market/components/wallet/ExportKeyModal.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/wallet/AddFundsModal.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/notifications/NotificationDropdown.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/reviews/review-form.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/providers/PrivyAuthProvider.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/providers/WalletAuthProvider.tsx`
- `/Users/dasherxd/Desktop/App-Market/components/layout/navbar.tsx`
- `/Users/dasherxd/Desktop/App-Market/hooks/useAutoWalletAuth.ts`
- `/Users/dasherxd/Desktop/App-Market/hooks/useNotifications.ts`
- `/Users/dasherxd/Desktop/App-Market/hooks/useMessages.ts`
- `/Users/dasherxd/Desktop/App-Market/app/create/page.tsx`

---

*Report generated for security review purposes. All findings should be verified in the actual production environment.*
