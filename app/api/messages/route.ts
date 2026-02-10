import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { validateMessageContent } from "@/lib/validation";
import { withRateLimitAsync, getClientIp } from "@/lib/rate-limit";

// GET /api/messages - Get all conversations for the user
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: userId },
          { participant2Id: userId },
        ],
      },
      include: {
        participant1: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            walletAddress: true,
          },
        },
        participant2: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            walletAddress: true,
          },
        },
        messages: {
          where: {
            read: false,
            NOT: { senderId: userId },
          },
          select: { id: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Transform to include the "other" participant and unread count
    const transformedConversations = conversations.map((conv: typeof conversations[number]) => {
      const otherParticipant =
        conv.participant1Id === userId ? conv.participant2 : conv.participant1;

      return {
        id: conv.id,
        otherParticipant,
        lastMessageAt: conv.lastMessageAt,
        lastMessagePreview: conv.lastMessagePreview,
        unreadCount: conv.messages.length,
        createdAt: conv.createdAt,
      };
    });

    return NextResponse.json({ conversations: transformedConversations });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST /api/messages - Send a new message (creates conversation if needed)
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit
    const rateLimitResult = await (withRateLimitAsync('write', 'messages'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const senderId = token.id as string;
    const body = await request.json();
    const { recipientId, content, listingId } = body;

    if (!recipientId) {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400 }
      );
    }

    // SECURITY: Validate message content
    const contentValidation = validateMessageContent(content);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error },
        { status: 400 }
      );
    }

    if (recipientId === senderId) {
      return NextResponse.json(
        { error: "Cannot message yourself" },
        { status: 400 }
      );
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, name: true, username: true },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    // Find or create conversation (normalize participant order)
    const [p1, p2] = [senderId, recipientId].sort();

    let conversation = await prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: {
          participant1Id: p1,
          participant2Id: p2,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: p1,
          participant2Id: p2,
          listingId: listingId || null,
        },
      });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        conversationId: conversation.id,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    // Update conversation with last message info
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: content.substring(0, 100),
      },
    });

    // Get sender info for notification
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true, username: true },
    });

    const senderName = sender?.name || sender?.username || "Someone";

    // Create notification for recipient
    await prisma.notification.create({
      data: {
        type: "MESSAGE_RECEIVED",
        title: "New message",
        message: `${senderName} sent you a message`,
        data: {
          conversationId: conversation.id,
          senderId,
          messagePreview: content.substring(0, 50),
        },
        userId: recipientId,
      },
    });

    return NextResponse.json({
      message,
      conversationId: conversation.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
