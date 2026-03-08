/**
 * Centralized environment variable validation.
 * Import this module early (e.g., in instrumentation.ts or layout.tsx) to fail fast on misconfiguration.
 */

interface EnvVar {
  name: string;
  required: boolean;
  minLength?: number;
  validate?: (value: string) => boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string",
  },
  {
    name: "NEXTAUTH_SECRET",
    required: true,
    minLength: 32,
    description: "NextAuth session signing secret",
  },
  {
    name: "ENCRYPTION_SECRET",
    required: true,
    minLength: 32,
    description: "AES-256 encryption secret for sensitive data",
  },
  {
    name: "CRON_SECRET",
    required: true,
    minLength: 32,
    description: "Secret for authenticating cron job requests",
  },
  {
    name: "NEXT_PUBLIC_SOLANA_RPC_URL",
    required: process.env.NODE_ENV === "production",
    validate: (v) => v.startsWith("http://") || v.startsWith("https://"),
    description: "Solana RPC endpoint URL",
  },
  {
    name: "NEXT_PUBLIC_PROGRAM_ID",
    required: process.env.NODE_ENV === "production",
    description: "Solana program ID for escrow contract",
  },
  {
    name: "NEXT_PUBLIC_TREASURY_WALLET",
    required: process.env.NODE_ENV === "production",
    description: "Platform treasury wallet address",
  },
  {
    name: "ADMIN_SECRET",
    required: process.env.NODE_ENV === "production",
    minLength: 32,
    validate: (v: string) => {
      // SECURITY: Reject common placeholder substrings that pass length checks
      const placeholders = ["change-in-production", "your-", "changeme", "xxx", "replace-me"];
      return !placeholders.some(p => v.toLowerCase().includes(p));
    },
    description: "Admin API authentication secret (must not contain placeholder text)",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    required: process.env.NODE_ENV === "production",
    validate: (v: string) => v.startsWith("https://"),
    description: "Public site URL (must use HTTPS in production)",
  },
  {
    name: "CSRF_SECRET",
    required: process.env.NODE_ENV === "production",
    minLength: 32,
    description: "CSRF token HMAC secret (must be independent from NEXTAUTH_SECRET)",
  },
  {
    name: "WEBHOOK_SECRET",
    required: false,
    minLength: 32,
    description: "Secret for authenticating incoming webhook requests (pool graduation, etc.)",
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      if (envVar.required) {
        errors.push(`MISSING: ${envVar.name} — ${envVar.description}`);
      } else {
        warnings.push(`OPTIONAL: ${envVar.name} not set — ${envVar.description}`);
      }
      continue;
    }

    if (envVar.minLength && value.length < envVar.minLength) {
      errors.push(
        `WEAK: ${envVar.name} must be at least ${envVar.minLength} characters (current: ${value.length})`
      );
    }

    if (envVar.validate && !envVar.validate(value)) {
      errors.push(`INVALID: ${envVar.name} failed validation — ${envVar.description}`);
    }
  }

  // Check admin secret if set
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && adminSecret.length < 32) {
    errors.push("WEAK: ADMIN_SECRET must be at least 32 characters");
  }

  // SECURITY: Validate Privy credentials are either both set or both unset
  const privyAppId = process.env.PRIVY_APP_ID;
  const privyAppSecret = process.env.PRIVY_APP_SECRET;
  if ((privyAppId && !privyAppSecret) || (!privyAppId && privyAppSecret)) {
    errors.push("PARTIAL: PRIVY_APP_ID and PRIVY_APP_SECRET must both be set, or both unset");
  }

  // SECURITY: Check that NEXTAUTH_SECRET doesn't contain placeholder text
  const nextauthSecret = process.env.NEXTAUTH_SECRET;
  if (nextauthSecret) {
    const placeholders = ["change-in-production", "your-", "changeme", "xxx", "replace-me"];
    if (placeholders.some(p => nextauthSecret.toLowerCase().includes(p))) {
      errors.push("WEAK: NEXTAUTH_SECRET contains placeholder text — generate a real secret with: openssl rand -hex 32");
    }
  }

  // Check Redis in production
  if (process.env.NODE_ENV === "production") {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      errors.push("MISSING: Upstash Redis required in production for rate limiting and nonce tracking");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Call at app startup. Logs warnings and throws on critical missing config.
 */
export function assertEnvironment(): void {
  const result = validateEnvironment();

  for (const warning of result.warnings) {
    console.warn(`[ENV] ${warning}`);
  }

  if (!result.valid) {
    for (const error of result.errors) {
      console.error(`[ENV] ${error}`);
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Environment validation failed with ${result.errors.length} error(s). Fix before deploying to production.`
      );
    }
  }
}
