import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthToken } from "@/lib/auth";

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

    // Fetch messages
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
      orderBy: { createdAt: "asc" },
    });

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

    if (!content) {
      return NextResponse.json(
        { error: "Message content is required" },
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
        content,
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
        lastMessagePreview: content.substring(0, 100),
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
