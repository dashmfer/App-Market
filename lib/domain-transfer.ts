/**
 * Domain Transfer Validation & Instructions
 *
 * Validates domain transfer links from popular registrars and
 * provides auto-generated transfer instructions.
 */

export interface DomainRegistrar {
  id: string;
  name: string;
  patterns: RegExp[];
  transferUrlPatterns: RegExp[];
  instructions: string[];
  authCodeFormat?: RegExp;
  authCodeHelp?: string;
}

// Supported domain registrars with their transfer URL patterns
export const DOMAIN_REGISTRARS: DomainRegistrar[] = [
  {
    id: "godaddy",
    name: "GoDaddy",
    patterns: [/godaddy\.com/i],
    transferUrlPatterns: [
      /godaddy\.com\/.*transfer/i,
      /godaddy\.com\/.*domain.*change/i,
      /dcc\.godaddy\.com/i,
    ],
    instructions: [
      "1. Log into your GoDaddy account",
      "2. Go to Domain Portfolio > select your domain",
      "3. Click 'Transfer' and select 'Transfer domain to another GoDaddy account'",
      "4. Enter the buyer's GoDaddy email or customer number",
      "5. Confirm the transfer and share the authorization link",
    ],
    authCodeFormat: /^[A-Za-z0-9!@#$%^&*()_+=\-]{6,32}$/,
    authCodeHelp: "GoDaddy auth codes are typically 8-20 alphanumeric characters",
  },
  {
    id: "namecheap",
    name: "Namecheap",
    patterns: [/namecheap\.com/i],
    transferUrlPatterns: [
      /namecheap\.com\/.*transfer/i,
      /ap\.www\.namecheap\.com\/.*transfer/i,
      /namecheap\.com\/domains\/transfer/i,
    ],
    instructions: [
      "1. Log into your Namecheap account",
      "2. Go to Domain List > select your domain > Manage",
      "3. Under 'Sharing & Transfer', click 'Transfer Out'",
      "4. Unlock the domain and get the EPP code",
      "5. Share the EPP code securely with the buyer",
    ],
    authCodeFormat: /^[A-Za-z0-9!@#$%^&*()_+=\-]{8,32}$/,
    authCodeHelp: "Namecheap EPP codes are typically 8-16 characters",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    patterns: [/cloudflare\.com/i, /dash\.cloudflare\.com/i],
    transferUrlPatterns: [
      /dash\.cloudflare\.com\/.*registrar/i,
      /cloudflare\.com\/.*transfer/i,
      /dash\.cloudflare\.com\/.*domains/i,
    ],
    instructions: [
      "1. Log into your Cloudflare dashboard",
      "2. Go to Domain Registration > select your domain",
      "3. Click 'Configuration' > 'Transfer Out'",
      "4. Unlock the domain and request auth code",
      "5. Share the auth code securely with the buyer",
    ],
    authCodeFormat: /^[A-Za-z0-9]{8,32}$/,
    authCodeHelp: "Cloudflare auth codes are alphanumeric, typically 8-16 characters",
  },
  {
    id: "google",
    name: "Google Domains / Squarespace",
    patterns: [/domains\.google/i, /squarespace\.com.*domains/i],
    transferUrlPatterns: [
      /domains\.google\.com\/registrar/i,
      /domains\.google\.com\/.*transfer/i,
      /squarespace\.com\/.*domains.*transfer/i,
    ],
    instructions: [
      "1. Go to domains.google.com or Squarespace Domains",
      "2. Select your domain and click 'Manage'",
      "3. Go to 'Registration settings'",
      "4. Unlock the domain and get the transfer code",
      "5. Share the authorization code securely",
    ],
    authCodeFormat: /^[A-Za-z0-9\-_]{8,64}$/,
    authCodeHelp: "Google/Squarespace auth codes are typically 10-20 characters",
  },
  {
    id: "porkbun",
    name: "Porkbun",
    patterns: [/porkbun\.com/i],
    transferUrlPatterns: [
      /porkbun\.com\/.*transfer/i,
      /porkbun\.com\/account\/domain/i,
    ],
    instructions: [
      "1. Log into your Porkbun account",
      "2. Go to Domain Management > select your domain",
      "3. Click 'Get Auth Code' to reveal the EPP code",
      "4. Ensure the domain is unlocked for transfer",
      "5. Share the auth code with the buyer",
    ],
    authCodeFormat: /^[A-Za-z0-9!@#$%^&*()]{6,32}$/,
    authCodeHelp: "Porkbun auth codes are typically 8-16 characters",
  },
  {
    id: "dynadot",
    name: "Dynadot",
    patterns: [/dynadot\.com/i],
    transferUrlPatterns: [
      /dynadot\.com\/.*transfer/i,
      /dynadot\.com\/account\/domain/i,
    ],
    instructions: [
      "1. Log into your Dynadot account",
      "2. Go to 'My Domains' > select the domain",
      "3. Click 'Unlock' to enable transfers",
      "4. Click 'Auth Code' to get the transfer code",
      "5. Share the authorization code with the buyer",
    ],
  },
  {
    id: "hover",
    name: "Hover",
    patterns: [/hover\.com/i],
    transferUrlPatterns: [
      /hover\.com\/.*transfer/i,
      /hover\.com\/control_panel/i,
    ],
    instructions: [
      "1. Log into your Hover account",
      "2. Go to your domain's overview page",
      "3. Click 'Transfer' and select 'Transfer Away'",
      "4. Follow the steps to unlock and get auth code",
      "5. Share the transfer authorization with the buyer",
    ],
  },
  {
    id: "gandi",
    name: "Gandi",
    patterns: [/gandi\.net/i],
    transferUrlPatterns: [
      /gandi\.net\/.*transfer/i,
      /admin\.gandi\.net\/.*domain/i,
    ],
    instructions: [
      "1. Log into your Gandi account",
      "2. Go to Domain > select your domain",
      "3. Navigate to 'Transfer' tab",
      "4. Unlock the domain and reveal the auth code",
      "5. Share the authorization code securely",
    ],
  },
  {
    id: "name",
    name: "Name.com",
    patterns: [/name\.com/i],
    transferUrlPatterns: [
      /name\.com\/.*transfer/i,
      /name\.com\/account\/domain/i,
    ],
    instructions: [
      "1. Log into your Name.com account",
      "2. Go to My Domains > select your domain",
      "3. Click on the 'Details' tab",
      "4. Unlock the domain and get the auth code",
      "5. Share the transfer code with the buyer",
    ],
  },
  {
    id: "epik",
    name: "Epik",
    patterns: [/epik\.com/i],
    transferUrlPatterns: [
      /epik\.com\/.*transfer/i,
      /registrar\.epik\.com/i,
    ],
    instructions: [
      "1. Log into your Epik account",
      "2. Go to Portfolio > Domains",
      "3. Select the domain and click 'Transfer Out'",
      "4. Get the EPP/Auth code",
      "5. Share the code securely with the buyer",
    ],
  },
];

export interface ValidationResult {
  isValid: boolean;
  registrar: DomainRegistrar | null;
  isTransferUrl: boolean;
  error?: string;
  suggestions?: string[];
}

/**
 * Validates a URL to check if it's a valid domain transfer link
 */
export function validateDomainTransferLink(url: string): ValidationResult {
  // Basic URL validation
  if (!url || typeof url !== "string") {
    return {
      isValid: false,
      registrar: null,
      isTransferUrl: false,
      error: "Please provide a valid URL",
    };
  }

  // Trim and normalize
  url = url.trim();

  // Check if it's a valid URL format
  let parsedUrl: URL;
  try {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    parsedUrl = new URL(url);
  } catch {
    return {
      isValid: false,
      registrar: null,
      isTransferUrl: false,
      error: "Invalid URL format. Please enter a valid link.",
    };
  }

  // Must be HTTPS for security
  if (parsedUrl.protocol !== "https:") {
    return {
      isValid: false,
      registrar: null,
      isTransferUrl: false,
      error: "Link must use HTTPS for security",
      suggestions: [`Try: https://${parsedUrl.host}${parsedUrl.pathname}`],
    };
  }

  // Find matching registrar
  // SECURITY [M19]: Regex validation cannot prevent all phishing URLs.
  // Consider adding an allowlist of known registrar domains (e.g., namecheap.com,
  // godaddy.com, cloudflare.com) for higher confidence.
  const registrar = DOMAIN_REGISTRARS.find((r) =>
    r.patterns.some((pattern) => pattern.test(url))
  );

  if (!registrar) {
    return {
      isValid: true,
      registrar: null,
      isTransferUrl: false,
      error: "Unrecognized domain registrar. Please ensure this is a legitimate transfer link from your registrar.",
      suggestions: [
        "Supported registrars: GoDaddy, Namecheap, Cloudflare, Google Domains, Porkbun, and more",
        "Make sure the link is from your registrar's official domain",
      ],
    };
  }

  // Check if it's specifically a transfer-related URL
  const isTransferUrl = registrar.transferUrlPatterns.some((pattern) =>
    pattern.test(url)
  );

  if (!isTransferUrl) {
    return {
      isValid: true,
      registrar,
      isTransferUrl: false,
      error: `This appears to be a ${registrar.name} link but may not be a direct transfer link.`,
      suggestions: [
        "Make sure you're sharing the link from the transfer or domain management section",
        ...registrar.instructions.slice(0, 3),
      ],
    };
  }

  return {
    isValid: true,
    registrar,
    isTransferUrl: true,
  };
}

/**
 * Validates an EPP/Auth code format
 */
export function validateAuthCode(code: string, registrar?: DomainRegistrar): {
  isValid: boolean;
  error?: string;
} {
  if (!code || typeof code !== "string") {
    return { isValid: false, error: "Auth code is required" };
  }

  const trimmedCode = code.trim();

  // Basic length check
  if (trimmedCode.length < 4) {
    return { isValid: false, error: "Auth code seems too short" };
  }

  if (trimmedCode.length > 64) {
    return { isValid: false, error: "Auth code seems too long" };
  }

  // Check for common invalid patterns
  if (/^[0-9]+$/.test(trimmedCode) && trimmedCode.length < 8) {
    return { isValid: false, error: "Auth codes typically contain letters and numbers" };
  }

  // Check registrar-specific format if available
  if (registrar?.authCodeFormat && !registrar.authCodeFormat.test(trimmedCode)) {
    return {
      isValid: false,
      error: registrar.authCodeHelp || "Invalid auth code format for this registrar",
    };
  }

  return { isValid: true };
}

/**
 * Gets transfer instructions for a registrar
 */
export function getTransferInstructions(registrarId: string): string[] {
  const registrar = DOMAIN_REGISTRARS.find((r) => r.id === registrarId);
  return registrar?.instructions || getGenericInstructions();
}

/**
 * Generic instructions when registrar is unknown
 */
export function getGenericInstructions(): string[] {
  return [
    "1. Log into your domain registrar account",
    "2. Navigate to your domain's settings or management page",
    "3. Look for 'Transfer', 'Transfer Out', or 'Change Registrar' options",
    "4. Unlock the domain if it's locked",
    "5. Request or copy the EPP/Authorization code",
    "6. Share the transfer link and auth code securely with the buyer",
  ];
}

/**
 * Detects registrar from a domain name
 */
export function detectRegistrarFromUrl(url: string): DomainRegistrar | null {
  const registrar = DOMAIN_REGISTRARS.find((r) =>
    r.patterns.some((pattern) => pattern.test(url))
  );
  return registrar || null;
}

/**
 * Format evidence for display - extracts domain from URL if present
 */
export function formatTransferEvidence(evidence: string): {
  type: "url" | "code" | "text";
  displayValue: string;
  fullValue: string;
} {
  const trimmed = evidence.trim();

  // Check if it looks like a URL
  if (trimmed.match(/^https?:\/\//i) || trimmed.match(/^[a-z0-9-]+\.(com|net|org|io)/i)) {
    try {
      const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      const parsed = new URL(url);
      return {
        type: "url",
        displayValue: `${parsed.hostname}${parsed.pathname.slice(0, 30)}${parsed.pathname.length > 30 ? '...' : ''}`,
        fullValue: trimmed,
      };
    } catch {
      // Not a valid URL, treat as text
    }
  }

  // Check if it looks like an auth code (alphanumeric, specific length)
  if (/^[A-Za-z0-9!@#$%^&*()_+=\-]{6,32}$/.test(trimmed) && !trimmed.includes(" ")) {
    return {
      type: "code",
      displayValue: `${trimmed.slice(0, 4)}${"*".repeat(Math.max(0, trimmed.length - 8))}${trimmed.slice(-4)}`,
      fullValue: trimmed,
    };
  }

  return {
    type: "text",
    displayValue: trimmed.length > 100 ? trimmed.slice(0, 100) + "..." : trimmed,
    fullValue: trimmed,
  };
}
