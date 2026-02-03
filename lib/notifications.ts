import { prisma } from '@/lib/prisma';
import { NotificationType } from '@/lib/prisma-enums';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title?: string;  // Custom title (overrides generated title)
  message?: string; // Custom message (overrides generated message)
  listingId?: string;
  listingTitle?: string;
  amount?: number;
  data?: any;
}

/**
 * Create a notification for a user with actual listing title
 */
export async function createNotification({
  userId,
  type,
  title: customTitle,
  message: customMessage,
  listingId,
  listingTitle,
  amount,
  data,
}: CreateNotificationParams) {
  // If listing ID provided but no title, fetch it
  let title = listingTitle;
  if (listingId && !title) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { title: true },
    });
    title = listing?.title;
  }

  // Generate notification message based on type (if custom not provided)
  const { title: generatedTitle, message: generatedMessage } = generateNotificationContent(
    type,
    title,
    amount,
    data
  );

  return prisma.notification.create({
    data: {
      userId,
      type,
      title: customTitle || generatedTitle,
      message: customMessage || generatedMessage,
      data: {
        listingId,
        listingTitle: title,
        amount,
        ...data,
      },
    },
  });
}

/**
 * Generate notification title and message with actual listing names
 */
function generateNotificationContent(
  type: NotificationType,
  listingTitle?: string,
  amount?: number,
  data?: any
): { title: string; message: string } {
  const displayTitle = listingTitle || data?.listingTitle || 'Unknown Listing';
  const displayAmount = amount ? `${amount} SOL` : '';

  switch (type) {
    case 'BID_PLACED':
      return {
        title: 'New Bid Placed',
        message: `Someone placed a bid of ${displayAmount} on "${displayTitle}"`,
      };

    case 'BID_OUTBID':
      return {
        title: 'You\'ve Been Outbid',
        message: `You've been outbid on "${displayTitle}". Your funds are ready to withdraw.`,
      };

    case 'AUCTION_WON':
      return {
        title: 'Auction Won!',
        message: `Congratulations! You won the auction for "${displayTitle}"`,
      };

    case 'AUCTION_LOST':
      return {
        title: 'Auction Ended',
        message: `The auction for "${displayTitle}" has ended. You were outbid.`,
      };

    case 'AUCTION_ENDING_SOON':
      return {
        title: 'Auction Ending Soon',
        message: `The auction for "${displayTitle}" ends in less than 1 hour!`,
      };

    case 'AUCTION_EXTENDED':
      return {
        title: 'Auction Extended',
        message: `The auction deadline for "${displayTitle}" has been extended`,
      };

    case 'TRANSFER_STARTED':
      return {
        title: 'Transfer Started',
        message: `The seller has started transferring "${displayTitle}"`,
      };

    case 'TRANSFER_COMPLETED':
      return {
        title: 'Transfer Completed',
        message: `All assets for "${displayTitle}" have been transferred`,
      };

    case 'PAYMENT_RECEIVED':
      return {
        title: 'Payment Received',
        message: `You received ${displayAmount} for "${displayTitle}"`,
      };

    case 'PAYMENT_FAILED':
      return {
        title: 'Payment Failed',
        message: `Payment of ${displayAmount} for "${displayTitle}" has failed. Please try again.`,
      };

    case 'REFUND_PROCESSED':
      return {
        title: 'Refund Processed',
        message: `Your refund of ${displayAmount} for "${displayTitle}" has been processed`,
      };

    case 'PAYOUT_INITIATED':
      return {
        title: 'Payout Initiated',
        message: `Your payout of ${displayAmount} for "${displayTitle}" has been initiated`,
      };

    case 'PAYOUT_COMPLETED':
      return {
        title: 'Payout Completed',
        message: `Your payout of ${displayAmount} for "${displayTitle}" has been completed`,
      };

    case 'SALE_CANCELLED':
      return {
        title: 'Sale Cancelled',
        message: `The sale of "${displayTitle}" has been cancelled`,
      };

    case 'DISPUTE_OPENED':
      return {
        title: 'Dispute Opened',
        message: `A dispute has been opened for "${displayTitle}"`,
      };

    case 'DISPUTE_RESOLVED':
      return {
        title: 'Dispute Resolved',
        message: `The dispute for "${displayTitle}" has been resolved`,
      };

    case 'REVIEW_RECEIVED':
      return {
        title: 'New Review',
        message: `You received a new review for "${displayTitle}"`,
      };

    case 'WATCHLIST_ENDING':
      return {
        title: 'Watchlist Alert',
        message: `"${displayTitle}" from your watchlist is ending soon!`,
      };

    case 'WATCHLIST_PRICE_DROP':
      return {
        title: 'Price Drop Alert',
        message: `"${displayTitle}" from your watchlist has dropped to ${displayAmount}`,
      };

    case 'WATCHLIST_NEW_BID':
      return {
        title: 'New Bid on Watched Listing',
        message: `Someone placed a bid of ${displayAmount} on "${displayTitle}" from your watchlist`,
      };

    case 'WATCHLIST_UPDATED':
      return {
        title: 'Watchlist Listing Updated',
        message: `"${displayTitle}" from your watchlist has been updated`,
      };

    case 'MESSAGE_RECEIVED':
      return {
        title: 'New Message',
        message: `You have a new message about "${displayTitle}"`,
      };

    // Buyer info notifications
    case 'BUYER_INFO_REQUIRED':
      return {
        title: 'Buyer Information Required',
        message: `Please submit your information for "${displayTitle}" to complete the purchase`,
      };

    case 'BUYER_INFO_REMINDER':
      return {
        title: 'Reminder: Submit Buyer Information',
        message: `Don't forget to submit your information for "${displayTitle}"`,
      };

    case 'BUYER_INFO_SUBMITTED':
      return {
        title: 'Buyer Information Received',
        message: `The buyer has submitted their information for "${displayTitle}"`,
      };

    case 'BUYER_INFO_DEADLINE':
      return {
        title: 'Buyer Information Deadline Passed',
        message: `The deadline for buyer information on "${displayTitle}" has passed`,
      };

    case 'FALLBACK_TRANSFER_ACTIVE':
      return {
        title: 'Fallback Transfer Active',
        message: `The fallback transfer process has started for "${displayTitle}"`,
      };

    // Listing notifications
    case 'LISTING_CREATED':
      return {
        title: 'Listing Created',
        message: `Your listing "${displayTitle}" has been created successfully`,
      };

    case 'LISTING_RESERVED':
      return {
        title: 'Listing Reserved',
        message: `"${displayTitle}" has been reserved for you`,
      };

    case 'LISTING_APPROVED':
      return {
        title: 'Listing Approved',
        message: `Your listing "${displayTitle}" has been approved and is now live`,
      };

    case 'LISTING_REJECTED':
      return {
        title: 'Listing Rejected',
        message: `Your listing "${displayTitle}" was not approved. ${data?.reason || 'Please review and resubmit.'}`,
      };

    case 'LISTING_EXPIRED':
      return {
        title: 'Listing Expired',
        message: `Your listing "${displayTitle}" has expired`,
      };

    case 'LISTING_UPDATED':
      return {
        title: 'Listing Updated',
        message: `"${displayTitle}" has been updated`,
      };

    // Offer notifications
    case 'OFFER_RECEIVED':
      return {
        title: 'New Offer Received',
        message: `You received an offer of ${displayAmount} for "${displayTitle}"`,
      };

    case 'OFFER_ACCEPTED':
      return {
        title: 'Offer Accepted',
        message: `Your offer of ${displayAmount} for "${displayTitle}" has been accepted`,
      };

    case 'OFFER_REJECTED':
      return {
        title: 'Offer Rejected',
        message: `Your offer for "${displayTitle}" was not accepted`,
      };

    case 'OFFER_COUNTERED':
      return {
        title: 'Counter Offer Received',
        message: `The seller has countered your offer with ${displayAmount} for "${displayTitle}"`,
      };

    case 'OFFER_EXPIRED':
      return {
        title: 'Offer Expired',
        message: `The offer for "${displayTitle}" has expired`,
      };

    // Collaboration notifications
    case 'COLLABORATION_INVITE':
      return {
        title: 'Collaboration Invite',
        message: `You've been invited as a ${data?.role?.toLowerCase() || 'collaborator'} on "${displayTitle}" with ${data?.percentage || 0}% revenue share`,
      };

    case 'COLLABORATION_ACCEPTED':
      return {
        title: 'Collaboration Accepted',
        message: `A collaborator has accepted your invite for "${displayTitle}"`,
      };

    case 'COLLABORATION_DECLINED':
      return {
        title: 'Collaboration Declined',
        message: `A collaborator has declined your invite for "${displayTitle}"`,
      };

    case 'COLLABORATION_REMOVED':
      return {
        title: 'Removed from Listing',
        message: `You've been removed from "${displayTitle}"`,
      };

    // Purchase partner notifications
    case 'PURCHASE_PARTNER_INVITE':
      return {
        title: 'Purchase Partner Invite',
        message: `You've been invited to co-purchase "${displayTitle}" with ${data?.percentage || 0}% share (${data?.depositAmount || 0} SOL)`,
      };

    case 'PURCHASE_PARTNER_DEPOSITED':
      return {
        title: 'Partner Deposited',
        message: `${data?.partnerName || 'A partner'} has deposited their ${data?.percentage || 0}% share for "${displayTitle}"`,
      };

    case 'PURCHASE_PARTNER_ALL_READY':
      return {
        title: 'All Deposits Complete!',
        message: `All purchase partners have deposited for "${displayTitle}". The purchase is now locked in!`,
      };

    case 'PURCHASE_PARTNER_TIMEOUT':
      return {
        title: 'Purchase Partner Timeout',
        message: `The deposit window for "${displayTitle}" has expired. All deposits will be refunded.`,
      };

    case 'PURCHASE_PARTNER_LEAD_TRANSFERRED':
      return {
        title: 'Lead Buyer Status Transferred',
        message: `You are now the lead buyer for "${displayTitle}"`,
      };

    // Referral notifications
    case 'REFERRAL_EARNED':
      return {
        title: 'Referral Commission Earned',
        message: `You earned ${displayAmount} in referral commission`,
      };

    // Agreement notifications
    case 'AGREEMENT_REQUESTED':
      return {
        title: 'Agreement Requested',
        message: `The buyer has requested an agreement for "${displayTitle}"`,
      };

    case 'AGREEMENT_SIGNED':
      return {
        title: 'Agreement Signed',
        message: `The agreement for "${displayTitle}" has been signed`,
      };

    // Account notifications
    case 'VERIFICATION_REQUIRED':
      return {
        title: 'Verification Required',
        message: 'Please verify your account to continue using all features',
      };

    case 'VERIFICATION_COMPLETED':
      return {
        title: 'Account Verified',
        message: 'Your account has been successfully verified',
      };

    case 'ACCOUNT_SUSPENDED':
      return {
        title: 'Account Suspended',
        message: `Your account has been suspended. ${data?.reason || 'Please contact support for more information.'}`,
      };

    case 'ACCOUNT_REACTIVATED':
      return {
        title: 'Account Reactivated',
        message: 'Your account has been reactivated. Welcome back!',
      };

    // Security notifications
    case 'LOGIN_NEW_DEVICE':
      return {
        title: 'New Device Login',
        message: `A new login was detected from ${data?.device || 'an unknown device'}${data?.location ? ` in ${data.location}` : ''}`,
      };

    case 'PASSWORD_CHANGED':
      return {
        title: 'Password Changed',
        message: 'Your password has been changed successfully',
      };

    case 'SECURITY_ALERT':
      return {
        title: 'Security Alert',
        message: data?.message || 'Suspicious activity was detected on your account',
      };

    case 'SYSTEM':
      return {
        title: 'System Notification',
        message: 'You have a new system notification',
      };

    default:
      return {
        title: 'Notification',
        message: `You have a new notification about "${displayTitle}"`,
      };
  }
}

/**
 * Create "you've been outbid" notification
 */
export async function notifyOutbid(
  userId: string,
  listingId: string,
  listingTitle: string,
  newBidAmount: number
) {
  return createNotification({
    userId,
    type: 'BID_OUTBID',
    listingId,
    listingTitle,
    amount: newBidAmount,
  });
}

/**
 * Create "new bid placed" notification for seller
 */
export async function notifyNewBid(
  sellerId: string,
  listingId: string,
  listingTitle: string,
  bidAmount: number
) {
  return createNotification({
    userId: sellerId,
    type: 'BID_PLACED',
    listingId,
    listingTitle,
    amount: bidAmount,
  });
}

/**
 * Create "auction won" notification
 */
export async function notifyAuctionWon(
  winnerId: string,
  listingId: string,
  listingTitle: string,
  winningAmount: number
) {
  return createNotification({
    userId: winnerId,
    type: 'AUCTION_WON',
    listingId,
    listingTitle,
    amount: winningAmount,
  });
}

/**
 * Create "auction ending soon" notification
 */
export async function notifyAuctionEndingSoon(
  userId: string,
  listingId: string,
  listingTitle: string
) {
  return createNotification({
    userId,
    type: 'AUCTION_ENDING_SOON',
    listingId,
    listingTitle,
  });
}
