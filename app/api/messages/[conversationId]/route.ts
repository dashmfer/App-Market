import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";
import { validateMessageContent, sanitizePagination, isValidUUID } from "@/lib/validation";
import { withRateLimitAsync } from "@/lib/rate-limit";
import { validateCsrfRequest, csrfError } from '@/lib/csrf';

const DEFAULT_MESSAGE_LIMIT = 50;

// GET /api/messages/[conversationId] - Get messages in a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.id as string;
    const { conversationId } = await params;

    // SECURITY: Validate UUID format
    if (!isValidUUID(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID format" },
        { status: 400 }
      );
    }

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const { page, limit } = sanitizePagination(
      searchParams.get("page"),
      searchParams.get("limit") || String(DEFAULT_MESSAGE_LIMIT)
    );
    const offset = (page - 1) * limit;

    // Verify user is a participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
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
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (
      conversation.participant1Id !== userId &&
      conversation.participant2Id !== userId
    ) {
      return NextResponse.json(
        { error: "Not authorized to view this conversation" },
        { status: 403 }
      );
    }

    // Get total count for pagination info
    const totalMessages = await prisma.message.count({
      where: { conversationId },
    });

    // Fetch messages with pagination (newest first, then reverse for display)
    const messages = await prisma.message.findMany({
      where: { conversationId },
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
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Reverse to show oldest first in the page
    messages.reverse();

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        conversationId,
        read: false,
        NOT: { senderId: userId },
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    // Get the other participant
    const otherParticipant =
      conversation.participant1Id === userId
        ? conversation.participant2
        : conversation.participant1;

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        otherParticipant,
        createdAt: conversation.createdAt,
      },
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: offset + messages.length < totalMessages,
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/messages/[conversationId] - Send a message in existing conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // SECURITY: Validate CSRF token
    const csrfValidation = validateCsrfRequest(request);
    if (!csrfValidation.valid) {
      return csrfError(csrfValidation.error || 'CSRF validation failed');
    }

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
    const { conversationId } = await params;
    const body = await request.json();
    const { content } = body;

    // SECURITY [M12]: Validate content is a string and within length limits
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Message content must be a string" },
        { status: 400 }
      );
    }
    if (content.length > 10000) {
      return NextResponse.json(
        { error: "Message content must be 10000 characters or less" },
        { status: 400 }
      );
    }

    // SECURITY: Validate message content (empty check + existing library limit)
    const contentValidation = validateMessageContent(content);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error },
        { status: 400 }
      );
    }

    // Verify user is a participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (
      conversation.participant1Id !== senderId &&
      conversation.participant2Id !== senderId
    ) {
      return NextResponse.json(
        { error: "Not authorized to send in this conversation" },
        { status: 403 }
      );
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
        senderId,
        conversationId,
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

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').substring(0, 100),
      },
    });

    // Get recipient ID
    const recipientId =
      conversation.participant1Id === senderId
        ? conversation.participant2Id
        : conversation.participant1Id;

    // Get sender info
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true, username: true },
    });

    const senderName = sender?.name || sender?.username || "Someone";

    // Create notification
    await prisma.notification.create({
      data: {
        type: "MESSAGE_RECEIVED",
        title: "New message",
        message: `${senderName} sent you a message`,
        data: {
          conversationId,
          senderId,
          messagePreview: content.substring(0, 50),
        },
        userId: recipientId,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
