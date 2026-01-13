import { prisma } from '@/lib/prisma';
import { NotificationType } from '@prisma/client';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
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

  // Generate notification message based on type
  const { title: notificationTitle, message } = generateNotificationContent(
    type,
    title,
    amount
  );

  return prisma.notification.create({
    data: {
      userId,
      type,
      title: notificationTitle,
      message,
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
  amount?: number
): { title: string; message: string } {
  const displayTitle = listingTitle || 'Unknown Listing';
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
