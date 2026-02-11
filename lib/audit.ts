import prisma from "@/lib/db";

type AuditAction =
  | "AUTH_LOGIN" | "AUTH_LOGOUT" | "AUTH_FAILED_LOGIN" | "AUTH_SESSION_REVOKED"
  | "ADMIN_RESET_LISTINGS" | "ADMIN_SIMILARITY_SCAN" | "ADMIN_DISPUTE_RESOLUTION"
  | "TRANSACTION_CREATED" | "TRANSACTION_COMPLETED" | "TRANSACTION_REFUNDED"
  | "ESCROW_DEPOSIT" | "ESCROW_RELEASE"
  | "WITHDRAWAL_CREATED" | "WITHDRAWAL_CLAIMED" | "WITHDRAWAL_EXPIRED"
  | "LISTING_CREATED" | "LISTING_UPDATED" | "LISTING_CANCELLED"
  | "USER_PROFILE_UPDATED" | "USER_WALLET_LINKED"
  | "OFFER_CREATED" | "REVIEW_CREATED" | "DISPUTE_CREATED"
  | "RATE_LIMIT_EXCEEDED" | "CRON_EXECUTION" | "API_ERROR";

type AuditSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

interface AuditLogEntry {
  action: AuditAction;
  severity?: AuditSeverity;
  userId?: string | null;
  targetId?: string;
  targetType?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export async function audit(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        severity: entry.severity || "INFO",
        userId: entry.userId || null,
        targetId: entry.targetId,
        targetType: entry.targetType,
        detail: entry.detail,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[Audit] Failed to write audit log:", error);
  }
}

/**
 * Convenience: extract IP + user agent from request headers for audit logging.
 */
export function auditContext(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor ? forwardedFor.split(",").pop()?.trim() :
      headers.get("x-real-ip") || undefined,
    userAgent: headers.get("user-agent") || undefined,
  };
}
