import prisma from "@/lib/db";

type AuditAction =
  | "AUTH_LOGIN" | "AUTH_LOGOUT" | "AUTH_FAILED_LOGIN" | "AUTH_SESSION_REVOKED"
  | "ADMIN_RESET_LISTINGS" | "ADMIN_SIMILARITY_SCAN" | "ADMIN_DISPUTE_RESOLUTION"
  | "TRANSACTION_CREATED" | "TRANSACTION_COMPLETED" | "TRANSACTION_REFUNDED"
  | "ESCROW_DEPOSIT" | "ESCROW_RELEASE"
  | "WITHDRAWAL_CREATED" | "WITHDRAWAL_CLAIMED" | "WITHDRAWAL_EXPIRED"
  | "LISTING_CREATED" | "LISTING_UPDATED" | "LISTING_CANCELLED"
  | "USER_PROFILE_UPDATED" | "USER_WALLET_LINKED"
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
  // SECURITY: Use x-real-ip first (set by trusted proxy), fall back to
  // rightmost x-forwarded-for IP (closest to trusted proxy, not spoofable).
  const realIp = headers.get("x-real-ip");
  let ipAddress: string | undefined;
  if (realIp) {
    ipAddress = realIp.trim();
  } else {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const ips = forwarded.split(",").map(ip => ip.trim()).filter(Boolean);
      ipAddress = ips.length > 0 ? ips[ips.length - 1] : undefined;
    }
  }

  return {
    ipAddress,
    userAgent: headers.get("user-agent") || undefined,
  };
}
