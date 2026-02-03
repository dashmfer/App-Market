/**
 * Local type definitions for Prisma types
 * These mirror the enums defined in prisma/schema.prisma
 * Used as a fallback when Prisma client types aren't generated
 *
 * Using string literal types for compatibility with string assignments
 */

export type ListingStatus =
  | "DRAFT"
  | "PENDING_COLLABORATORS"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "RESERVED"
  | "SOLD"
  | "EXPIRED"
  | "UNLISTED"
  | "REJECTED";

export const ListingStatus = {
  DRAFT: "DRAFT" as const,
  PENDING_COLLABORATORS: "PENDING_COLLABORATORS" as const,
  PENDING_REVIEW: "PENDING_REVIEW" as const,
  ACTIVE: "ACTIVE" as const,
  RESERVED: "RESERVED" as const,
  SOLD: "SOLD" as const,
  EXPIRED: "EXPIRED" as const,
  UNLISTED: "UNLISTED" as const,
  REJECTED: "REJECTED" as const,
};

export type CollaboratorRole = "PARTNER" | "COLLABORATOR";

export const CollaboratorRole = {
  PARTNER: "PARTNER" as const,
  COLLABORATOR: "COLLABORATOR" as const,
};

export type CollaboratorRoleDescription =
  | "CO_FOUNDER"
  | "DEVELOPER"
  | "TECHNICAL_LEAD"
  | "CTO"
  | "DESIGNER"
  | "MARKETING"
  | "VIDEO_EDITOR"
  | "CONSULTANT"
  | "ADVISOR"
  | "BRANDING"
  | "COPYWRITER"
  | "COMMUNITY_MANAGER"
  | "OTHER";

export const CollaboratorRoleDescription = {
  CO_FOUNDER: "CO_FOUNDER" as const,
  DEVELOPER: "DEVELOPER" as const,
  TECHNICAL_LEAD: "TECHNICAL_LEAD" as const,
  CTO: "CTO" as const,
  DESIGNER: "DESIGNER" as const,
  MARKETING: "MARKETING" as const,
  VIDEO_EDITOR: "VIDEO_EDITOR" as const,
  CONSULTANT: "CONSULTANT" as const,
  ADVISOR: "ADVISOR" as const,
  BRANDING: "BRANDING" as const,
  COPYWRITER: "COPYWRITER" as const,
  COMMUNITY_MANAGER: "COMMUNITY_MANAGER" as const,
  OTHER: "OTHER" as const,
};

export type CollaboratorStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export const CollaboratorStatus = {
  PENDING: "PENDING" as const,
  ACCEPTED: "ACCEPTED" as const,
  DECLINED: "DECLINED" as const,
};

export type ReviewReportReason =
  | "SPAM"
  | "FAKE_REVIEW"
  | "HARASSMENT"
  | "INAPPROPRIATE_CONTENT"
  | "CONFLICT_OF_INTEREST"
  | "FALSE_INFORMATION"
  | "OFF_TOPIC"
  | "OTHER";

export const ReviewReportReason = {
  SPAM: "SPAM" as const,
  FAKE_REVIEW: "FAKE_REVIEW" as const,
  HARASSMENT: "HARASSMENT" as const,
  INAPPROPRIATE_CONTENT: "INAPPROPRIATE_CONTENT" as const,
  CONFLICT_OF_INTEREST: "CONFLICT_OF_INTEREST" as const,
  FALSE_INFORMATION: "FALSE_INFORMATION" as const,
  OFF_TOPIC: "OFF_TOPIC" as const,
  OTHER: "OTHER" as const,
};

export type ApiKeyPermission = "READ" | "WRITE" | "ADMIN" | "TRANSACTION";

export const ApiKeyPermission = {
  READ: "READ" as const,
  WRITE: "WRITE" as const,
  ADMIN: "ADMIN" as const,
  TRANSACTION: "TRANSACTION" as const,
};

export type WebhookEventType =
  | "LISTING_CREATED"
  | "LISTING_UPDATED"
  | "LISTING_ENDED"
  | "LISTING_ENDING_SOON"
  | "BID_PLACED"
  | "BID_OUTBID"
  | "BID_WON"
  | "TRANSACTION_INITIATED"
  | "TRANSACTION_COMPLETED"
  | "TRANSACTION_CANCELLED"
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "OFFER_COUNTERED"
  | "MESSAGE_RECEIVED"
  | "AGREEMENT_REQUESTED"
  | "AGREEMENT_SIGNED"
  | "WATCHLIST_LISTING_UPDATED"
  | "WATCHLIST_LISTING_ENDING_SOON";

export const WebhookEventType = {
  LISTING_CREATED: "LISTING_CREATED" as const,
  LISTING_UPDATED: "LISTING_UPDATED" as const,
  LISTING_ENDED: "LISTING_ENDED" as const,
  LISTING_ENDING_SOON: "LISTING_ENDING_SOON" as const,
  BID_PLACED: "BID_PLACED" as const,
  BID_OUTBID: "BID_OUTBID" as const,
  BID_WON: "BID_WON" as const,
  TRANSACTION_INITIATED: "TRANSACTION_INITIATED" as const,
  TRANSACTION_COMPLETED: "TRANSACTION_COMPLETED" as const,
  TRANSACTION_CANCELLED: "TRANSACTION_CANCELLED" as const,
  OFFER_RECEIVED: "OFFER_RECEIVED" as const,
  OFFER_ACCEPTED: "OFFER_ACCEPTED" as const,
  OFFER_REJECTED: "OFFER_REJECTED" as const,
  OFFER_COUNTERED: "OFFER_COUNTERED" as const,
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED" as const,
  AGREEMENT_REQUESTED: "AGREEMENT_REQUESTED" as const,
  AGREEMENT_SIGNED: "AGREEMENT_SIGNED" as const,
  WATCHLIST_LISTING_UPDATED: "WATCHLIST_LISTING_UPDATED" as const,
  WATCHLIST_LISTING_ENDING_SOON: "WATCHLIST_LISTING_ENDING_SOON" as const,
};

export type WebhookDeliveryStatus = "PENDING" | "SUCCESS" | "FAILED" | "RETRYING";

export const WebhookDeliveryStatus = {
  PENDING: "PENDING" as const,
  SUCCESS: "SUCCESS" as const,
  FAILED: "FAILED" as const,
  RETRYING: "RETRYING" as const,
};

export type AuthMethod =
  | "WALLET"
  | "PRIVY_EMAIL"
  | "PRIVY_TWITTER"
  | "PRIVY_WALLET";

export const AuthMethod = {
  WALLET: "WALLET" as const,
  PRIVY_EMAIL: "PRIVY_EMAIL" as const,
  PRIVY_TWITTER: "PRIVY_TWITTER" as const,
  PRIVY_WALLET: "PRIVY_WALLET" as const,
};

export type NotificationType =
  // Bid/Auction notifications
  | "BID_PLACED"
  | "BID_OUTBID"
  | "AUCTION_WON"
  | "AUCTION_LOST"
  | "AUCTION_ENDING_SOON"
  | "AUCTION_EXTENDED"
  // Transfer notifications
  | "TRANSFER_STARTED"
  | "TRANSFER_COMPLETED"
  // Payment notifications
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "REFUND_PROCESSED"
  | "PAYOUT_INITIATED"
  | "PAYOUT_COMPLETED"
  // Sale notifications
  | "SALE_CANCELLED"
  // Dispute notifications
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  // Review notifications
  | "REVIEW_RECEIVED"
  // Watchlist notifications
  | "WATCHLIST_ENDING"
  | "WATCHLIST_PRICE_DROP"
  | "WATCHLIST_NEW_BID"
  | "WATCHLIST_UPDATED"
  // Message notifications
  | "MESSAGE_RECEIVED"
  // Buyer info notifications
  | "BUYER_INFO_REQUIRED"
  | "BUYER_INFO_REMINDER"
  | "BUYER_INFO_SUBMITTED"
  | "BUYER_INFO_DEADLINE"
  | "FALLBACK_TRANSFER_ACTIVE"
  // Listing notifications
  | "LISTING_CREATED"
  | "LISTING_RESERVED"
  | "LISTING_APPROVED"
  | "LISTING_REJECTED"
  | "LISTING_EXPIRED"
  | "LISTING_UPDATED"
  // Offer notifications
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "OFFER_COUNTERED"
  | "OFFER_EXPIRED"
  // Collaboration notifications
  | "COLLABORATION_INVITE"
  | "COLLABORATION_ACCEPTED"
  | "COLLABORATION_DECLINED"
  | "COLLABORATION_REMOVED"
  // Purchase partner notifications
  | "PURCHASE_PARTNER_INVITE"
  | "PURCHASE_PARTNER_DEPOSITED"
  | "PURCHASE_PARTNER_ALL_READY"
  | "PURCHASE_PARTNER_TIMEOUT"
  | "PURCHASE_PARTNER_LEAD_TRANSFERRED"
  // Referral notifications
  | "REFERRAL_EARNED"
  // Agreement notifications
  | "AGREEMENT_REQUESTED"
  | "AGREEMENT_SIGNED"
  // Account notifications
  | "VERIFICATION_REQUIRED"
  | "VERIFICATION_COMPLETED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED"
  // Security notifications
  | "LOGIN_NEW_DEVICE"
  | "PASSWORD_CHANGED"
  | "SECURITY_ALERT"
  | "SYSTEM";

export const NotificationType = {
  // Bid/Auction notifications
  BID_PLACED: "BID_PLACED" as const,
  BID_OUTBID: "BID_OUTBID" as const,
  AUCTION_WON: "AUCTION_WON" as const,
  AUCTION_LOST: "AUCTION_LOST" as const,
  AUCTION_ENDING_SOON: "AUCTION_ENDING_SOON" as const,
  AUCTION_EXTENDED: "AUCTION_EXTENDED" as const,
  // Transfer notifications
  TRANSFER_STARTED: "TRANSFER_STARTED" as const,
  TRANSFER_COMPLETED: "TRANSFER_COMPLETED" as const,
  // Payment notifications
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED" as const,
  PAYMENT_FAILED: "PAYMENT_FAILED" as const,
  REFUND_PROCESSED: "REFUND_PROCESSED" as const,
  PAYOUT_INITIATED: "PAYOUT_INITIATED" as const,
  PAYOUT_COMPLETED: "PAYOUT_COMPLETED" as const,
  // Sale notifications
  SALE_CANCELLED: "SALE_CANCELLED" as const,
  // Dispute notifications
  DISPUTE_OPENED: "DISPUTE_OPENED" as const,
  DISPUTE_RESOLVED: "DISPUTE_RESOLVED" as const,
  // Review notifications
  REVIEW_RECEIVED: "REVIEW_RECEIVED" as const,
  // Watchlist notifications
  WATCHLIST_ENDING: "WATCHLIST_ENDING" as const,
  WATCHLIST_PRICE_DROP: "WATCHLIST_PRICE_DROP" as const,
  WATCHLIST_NEW_BID: "WATCHLIST_NEW_BID" as const,
  WATCHLIST_UPDATED: "WATCHLIST_UPDATED" as const,
  // Message notifications
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED" as const,
  // Buyer info notifications
  BUYER_INFO_REQUIRED: "BUYER_INFO_REQUIRED" as const,
  BUYER_INFO_REMINDER: "BUYER_INFO_REMINDER" as const,
  BUYER_INFO_SUBMITTED: "BUYER_INFO_SUBMITTED" as const,
  BUYER_INFO_DEADLINE: "BUYER_INFO_DEADLINE" as const,
  FALLBACK_TRANSFER_ACTIVE: "FALLBACK_TRANSFER_ACTIVE" as const,
  // Listing notifications
  LISTING_CREATED: "LISTING_CREATED" as const,
  LISTING_RESERVED: "LISTING_RESERVED" as const,
  LISTING_APPROVED: "LISTING_APPROVED" as const,
  LISTING_REJECTED: "LISTING_REJECTED" as const,
  LISTING_EXPIRED: "LISTING_EXPIRED" as const,
  LISTING_UPDATED: "LISTING_UPDATED" as const,
  // Offer notifications
  OFFER_RECEIVED: "OFFER_RECEIVED" as const,
  OFFER_ACCEPTED: "OFFER_ACCEPTED" as const,
  OFFER_REJECTED: "OFFER_REJECTED" as const,
  OFFER_COUNTERED: "OFFER_COUNTERED" as const,
  OFFER_EXPIRED: "OFFER_EXPIRED" as const,
  // Collaboration notifications
  COLLABORATION_INVITE: "COLLABORATION_INVITE" as const,
  COLLABORATION_ACCEPTED: "COLLABORATION_ACCEPTED" as const,
  COLLABORATION_DECLINED: "COLLABORATION_DECLINED" as const,
  COLLABORATION_REMOVED: "COLLABORATION_REMOVED" as const,
  // Purchase partner notifications
  PURCHASE_PARTNER_INVITE: "PURCHASE_PARTNER_INVITE" as const,
  PURCHASE_PARTNER_DEPOSITED: "PURCHASE_PARTNER_DEPOSITED" as const,
  PURCHASE_PARTNER_ALL_READY: "PURCHASE_PARTNER_ALL_READY" as const,
  PURCHASE_PARTNER_TIMEOUT: "PURCHASE_PARTNER_TIMEOUT" as const,
  PURCHASE_PARTNER_LEAD_TRANSFERRED: "PURCHASE_PARTNER_LEAD_TRANSFERRED" as const,
  // Referral notifications
  REFERRAL_EARNED: "REFERRAL_EARNED" as const,
  // Agreement notifications
  AGREEMENT_REQUESTED: "AGREEMENT_REQUESTED" as const,
  AGREEMENT_SIGNED: "AGREEMENT_SIGNED" as const,
  // Account notifications
  VERIFICATION_REQUIRED: "VERIFICATION_REQUIRED" as const,
  VERIFICATION_COMPLETED: "VERIFICATION_COMPLETED" as const,
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED" as const,
  ACCOUNT_REACTIVATED: "ACCOUNT_REACTIVATED" as const,
  // Security notifications
  LOGIN_NEW_DEVICE: "LOGIN_NEW_DEVICE" as const,
  PASSWORD_CHANGED: "PASSWORD_CHANGED" as const,
  SECURITY_ALERT: "SECURITY_ALERT" as const,
  SYSTEM: "SYSTEM" as const,
};
