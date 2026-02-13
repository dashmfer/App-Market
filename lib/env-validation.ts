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
