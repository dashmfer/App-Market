/**
 * Validation utilities for security and data integrity
 */
import crypto from 'crypto';

// Maximum limits for pagination and content
export const MAX_PAGINATION_LIMIT = 100;
export const MAX_SEARCH_QUERY_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_CATEGORIES = 3;

// Valid listing states for editing
export const EDITABLE_LISTING_STATES = ['ACTIVE', 'RESERVED', 'PENDING_COLLABORATORS', 'DRAFT'];

// Valid transaction state transitions
export const VALID_TRANSACTION_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['FUNDED', 'CANCELLED'],
  'FUNDED': ['IN_PROGRESS', 'CANCELLED', 'DISPUTED'],
  'IN_PROGRESS': ['AWAITING_CONFIRMATION', 'DISPUTED', 'COMPLETED'],
  'AWAITING_CONFIRMATION': ['COMPLETED', 'DISPUTED'],
  'DISPUTED': ['RESOLVED', 'COMPLETED'],
  'COMPLETED': [], // Terminal state
  'CANCELLED': [], // Terminal state
  'RESOLVED': ['COMPLETED'], // After dispute resolution
};

/**
 * Validate URL has safe protocol (http/https only)
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return true; // Empty URLs are valid (optional fields)
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate Solana wallet address (Base58 format)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || address.length < 32 || address.length > 44) {
    return false;
  }
  // Base58 character set (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Sanitize and limit pagination parameters
 */
export function sanitizePagination(page: string | null, limit: string | null): { page: number; limit: number } {
  const parsedPage = Math.max(1, parseInt(page || '1') || 1);
  const parsedLimit = Math.min(MAX_PAGINATION_LIMIT, Math.max(1, parseInt(limit || '20') || 20));
  return { page: parsedPage, limit: parsedLimit };
}

/**
 * Sanitize search query (limit length)
 */
export function sanitizeSearchQuery(query: string | null): string | null {
  if (!query) return null;
  return query.slice(0, MAX_SEARCH_QUERY_LENGTH).trim();
}

/**
 * Check if listing state allows editing
 */
export function canEditListing(status: string): boolean {
  return EDITABLE_LISTING_STATES.includes(status);
}

/**
 * Check if transaction state transition is valid
 */
export function isValidTransactionTransition(fromState: string, toState: string): boolean {
  const validNextStates = VALID_TRANSACTION_TRANSITIONS[fromState];
  if (!validNextStates) return false;
  return validNextStates.includes(toState);
}

/**
 * Hash evidence for dispute integrity
 */
export function hashEvidence(evidence: any): string {
  const content = typeof evidence === 'string' ? evidence : JSON.stringify(evidence);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validate message content
 */
export function validateMessageContent(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * Calculate partner payment amounts using integer math to avoid rounding errors
 * All calculations done in lamports (1 SOL = 1,000,000,000 lamports)
 */
export function calculatePartnerPayments(
  totalAmountSol: number,
  partners: { walletAddress: string; percentage: number }[]
): { walletAddress: string; amountSol: number; amountLamports: bigint }[] {
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  const totalLamports = BigInt(Math.round(totalAmountSol * Number(LAMPORTS_PER_SOL)));

  let distributedLamports = 0n;
  const payments = partners.map((partner, index) => {
    // For the last partner, give them the remainder to avoid rounding issues
    const isLast = index === partners.length - 1;
    const amountLamports = isLast
      ? totalLamports - distributedLamports
      : (totalLamports * BigInt(Math.round(partner.percentage * 100))) / 10000n;

    distributedLamports += amountLamports;

    return {
      walletAddress: partner.walletAddress,
      amountSol: Number(amountLamports) / Number(LAMPORTS_PER_SOL),
      amountLamports,
    };
  });

  return payments;
}

/**
 * Validate password complexity
 */
export function validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate wallet signature message (replay protection)
 */
export function validateWalletSignatureMessage(
  message: string,
  expectedWallet: string,
  maxAgeSeconds: number = 300 // 5 minutes
): { valid: boolean; error?: string } {
  // Check message format
  if (!message.includes('Sign this message to authenticate with App Market')) {
    return { valid: false, error: 'Invalid message format' };
  }

  // Extract and validate wallet address
  const walletMatch = message.match(/Wallet: ([1-9A-HJ-NP-Za-km-z]{32,44})/);
  if (!walletMatch || walletMatch[1] !== expectedWallet) {
    return { valid: false, error: 'Wallet address mismatch' };
  }

  // Extract and validate timestamp
  const timestampMatch = message.match(/Timestamp: (.+)/);
  if (!timestampMatch) {
    return { valid: false, error: 'Missing timestamp' };
  }

  const timestamp = new Date(timestampMatch[1]);
  const now = new Date();
  const ageMs = now.getTime() - timestamp.getTime();

  if (ageMs < 0) {
    return { valid: false, error: 'Timestamp is in the future' };
  }

  if (ageMs > maxAgeSeconds * 1000) {
    return { valid: false, error: 'Signature has expired' };
  }

  return { valid: true };
}
