"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export interface MessageUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  walletAddress?: string | null;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: MessageUser;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  otherParticipant: MessageUser;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
}

interface UseMessagesOptions {
  pollInterval?: number;
}

export function useConversations(options: UseMessagesOptions = {}) {
  const { pollInterval = 30000 } = options;
  const { data: session, status } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchConversations = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/messages");
      if (!res.ok) throw new Error("Failed to fetch conversations");

      const data = await res.json();
      setConversations(data.conversations || []);
      setTotalUnread(
        data.conversations?.reduce(
          (sum: number, c: Conversation) => sum + c.unreadCount,
          0
        ) || 0
      );
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchConversations();
    }
  }, [status, fetchConversations]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const interval = setInterval(fetchConversations, pollInterval);
    return () => clearInterval(interval);
  }, [status, pollInterval, fetchConversations]);

  return {
    conversations,
    totalUnread,
    loading,
    refetch: fetchConversations,
  };
}

export function useConversation(conversationId: string | null) {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<MessageUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || status !== "authenticated" || !session?.user) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/messages/${conversationId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");

      const data = await res.json();
      setMessages(data.messages || []);
      setOtherParticipant(data.conversation?.otherParticipant || null);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, session, status]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return null;

      try {
        const res = await fetch(`/api/messages/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) throw new Error("Failed to send message");

        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        return data.message;
      } catch (error) {
        console.error("Error sending message:", error);
        return null;
      }
    },
    [conversationId]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages
  useEffect(() => {
    if (!conversationId || status !== "authenticated") return;

    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds when in conversation
    return () => clearInterval(interval);
  }, [conversationId, status, fetchMessages]);

  return {
    messages,
    otherParticipant,
    loading,
    sendMessage,
    refetch: fetchMessages,
  };
}

export async function startConversation(
  recipientId: string,
  message: string,
  listingId?: string
): Promise<{ conversationId: string } | null> {
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, content: message, listingId }),
    });

    if (!res.ok) throw new Error("Failed to start conversation");

    const data = await res.json();
    return { conversationId: data.conversationId };
  } catch (error) {
    console.error("Error starting conversation:", error);
    return null;
  }
}
