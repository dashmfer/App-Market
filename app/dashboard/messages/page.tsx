"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  User,
  Loader2,
  Search,
} from "lucide-react";
import {
  useConversations,
  useConversation,
  Conversation,
  Message,
} from "@/hooks/useMessages";

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((c) => {
    const name =
      c.otherParticipant.name ||
      c.otherParticipant.username ||
      c.otherParticipant.walletAddress ||
      "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm text-zinc-500">No conversations yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`w-full p-4 text-left transition-colors ${
                  selectedId === conversation.id
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                    {conversation.otherParticipant.image ? (
                      <img
                        src={conversation.otherParticipant.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {conversation.otherParticipant.name ||
                          conversation.otherParticipant.username ||
                          conversation.otherParticipant.walletAddress?.slice(0, 8)}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold bg-green-500 text-white rounded-full">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    {conversation.lastMessagePreview && (
                      <p className="text-sm text-zinc-500 truncate mt-0.5">
                        {conversation.lastMessagePreview}
                      </p>
                    )}
                    {conversation.lastMessageAt && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageThread({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { messages, otherParticipant, loading, sendMessage } =
    useConversation(conversationId);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const result = await sendMessage(newMessage.trim());
    if (result) {
      setNewMessage("");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
          {otherParticipant?.image ? (
            <img
              src={otherParticipant.image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 text-zinc-400" />
          )}
        </div>
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {otherParticipant?.name ||
              otherParticipant?.username ||
              otherParticipant?.walletAddress?.slice(0, 8)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-zinc-500">No messages yet. Say hello!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.sender.id !== otherParticipant?.id;
              const showAvatar =
                !isOwn &&
                (index === 0 ||
                  messages[index - 1]?.sender.id !== message.sender.id);

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex items-end gap-2 max-w-[80%] ${
                      isOwn ? "flex-row-reverse" : ""
                    }`}
                  >
                    {!isOwn && showAvatar && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                        {message.sender.image ? (
                          <img
                            src={message.sender.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    )}
                    {!isOwn && !showAvatar && <div className="w-8" />}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwn
                          ? "bg-green-500 text-white rounded-br-md"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn
                            ? "text-green-100"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        {formatDistanceToNow(new Date(message.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-end gap-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-green-500 max-h-32"
            style={{
              height: "auto",
              minHeight: "44px",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="flex-shrink-0 p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");
  const { conversations, totalUnread, loading, refetch } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    conversationParam
  );
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    if (conversationParam) {
      setSelectedConversation(conversationParam);
      setShowList(false);
    }
  }, [conversationParam]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowList(false);
  };

  const handleBack = () => {
    setShowList(true);
    refetch();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Messages
          </h1>
          <p className="text-zinc-500 mt-1">
            {totalUnread > 0
              ? `${totalUnread} unread message${totalUnread !== 1 ? "s" : ""}`
              : "Your conversations"}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex h-[calc(100vh-220px)] min-h-[500px]">
            {/* Conversation List */}
            <div
              className={`w-full lg:w-80 border-r border-zinc-200 dark:border-zinc-800 ${
                !showList && selectedConversation ? "hidden lg:block" : ""
              }`}
            >
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversation}
                onSelect={handleSelectConversation}
                loading={loading}
              />
            </div>

            {/* Message Thread */}
            <div
              className={`flex-1 ${
                showList && !selectedConversation ? "hidden lg:flex" : "flex"
              }`}
            >
              {selectedConversation ? (
                <div className="w-full">
                  <MessageThread
                    conversationId={selectedConversation}
                    onBack={handleBack}
                  />
                </div>
              ) : (
                <div className="w-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                      Select a conversation
                    </p>
                    <p className="text-sm text-zinc-500 mt-1">
                      Choose from your existing conversations or start a new one
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
