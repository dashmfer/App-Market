"use client";

import { useState, useEffect, Suspense } from "react";
import {
  Key,
  Webhook,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Settings2,
  Code2,
  Activity,
} from "lucide-react";
import { useSession } from "next-auth/react";

// Types
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  requestCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
}

const PERMISSION_OPTIONS = [
  { value: "LISTINGS_READ", label: "Read Listings" },
  { value: "LISTINGS_WRITE", label: "Create/Edit Listings" },
  { value: "BIDS_READ", label: "Read Bids" },
  { value: "BIDS_WRITE", label: "Place Bids" },
  { value: "OFFERS_READ", label: "Read Offers" },
  { value: "OFFERS_WRITE", label: "Create/Manage Offers" },
  { value: "TRANSACTIONS_READ", label: "Read Transactions" },
  { value: "TRANSACTIONS_WRITE", label: "Manage Transactions" },
  { value: "WEBHOOKS_READ", label: "Read Webhooks" },
  { value: "WEBHOOKS_WRITE", label: "Manage Webhooks" },
  { value: "PROFILE_READ", label: "Read Profile" },
  { value: "PROFILE_WRITE", label: "Edit Profile" },
];

const EVENT_OPTIONS = [
  { value: "LISTING_CREATED", label: "Listing Created" },
  { value: "LISTING_UPDATED", label: "Listing Updated" },
  { value: "LISTING_ENDED", label: "Listing Ended" },
  { value: "LISTING_ENDING_SOON", label: "Listing Ending Soon" },
  { value: "BID_PLACED", label: "Bid Placed" },
  { value: "BID_OUTBID", label: "Outbid" },
  { value: "BID_WON", label: "Bid Won" },
  { value: "OFFER_RECEIVED", label: "Offer Received" },
  { value: "OFFER_ACCEPTED", label: "Offer Accepted" },
  { value: "OFFER_REJECTED", label: "Offer Rejected" },
  { value: "OFFER_COUNTERED", label: "Offer Countered" },
  { value: "TRANSACTION_INITIATED", label: "Transaction Initiated" },
  { value: "TRANSACTION_COMPLETED", label: "Transaction Completed" },
  { value: "TRANSACTION_CANCELLED", label: "Transaction Cancelled" },
  { value: "MESSAGE_RECEIVED", label: "Message Received" },
  { value: "WATCHLIST_LISTING_UPDATED", label: "Watchlist Listing Updated" },
  { value: "WATCHLIST_LISTING_ENDING_SOON", label: "Watchlist Listing Ending" },
];

export default function DeveloperPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <DeveloperContent />
    </Suspense>
  );
}

function DeveloperContent() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    "LISTINGS_READ",
  ]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(1000);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<
    string | null
  >(null);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load API keys
  useEffect(() => {
    async function loadApiKeys() {
      if (status !== "authenticated") return;
      try {
        const res = await fetch("/api/agent/keys");
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data.keys || []);
        }
      } catch (error: any) {
        console.error("Failed to load API keys:", error);
      } finally {
        setKeysLoading(false);
      }
    }
    loadApiKeys();
  }, [status]);

  // Load webhooks
  useEffect(() => {
    async function loadWebhooks() {
      if (status !== "authenticated") return;
      try {
        const res = await fetch("/api/agent/webhooks");
        if (res.ok) {
          const data = await res.json();
          setWebhooks(data.webhooks || []);
        }
      } catch (error: any) {
        console.error("Failed to load webhooks:", error);
      } finally {
        setWebhooksLoading(false);
      }
    }
    loadWebhooks();
  }, [status]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPermissions,
          rateLimit: newKeyRateLimit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setApiKeys((prev) => [data.apiKey, ...prev]);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create API key");
      }
    } catch (error: any) {
      console.error("Failed to create API key:", error);
      alert("Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/agent/keys?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        alert("Failed to delete API key");
      }
    } catch (error: any) {
      console.error("Failed to delete API key:", error);
      alert("Failed to delete API key");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleKey = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/agent/keys?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        setApiKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, isActive: !isActive } : k))
        );
      }
    } catch (error: any) {
      console.error("Failed to toggle API key:", error);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;
    if (newWebhookEvents.length === 0) {
      alert("Please select at least one event");
      return;
    }
    setCreatingWebhook(true);
    try {
      const res = await fetch("/api/agent/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWebhookName,
          url: newWebhookUrl,
          events: newWebhookEvents,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedWebhookSecret(data.secret);
        setWebhooks((prev) => [data.webhook, ...prev]);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create webhook");
      }
    } catch (error: any) {
      console.error("Failed to create webhook:", error);
      alert("Failed to create webhook");
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/agent/webhooks?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
      } else {
        alert("Failed to delete webhook");
      }
    } catch (error: any) {
      console.error("Failed to delete webhook:", error);
      alert("Failed to delete webhook");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/agent/webhooks?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === id ? { ...w, isActive: !isActive } : w))
        );
      }
    } catch (error: any) {
      console.error("Failed to toggle webhook:", error);
    }
  };

  const resetKeyForm = () => {
    setShowCreateKey(false);
    setNewKeyName("");
    setNewKeyPermissions(["LISTINGS_READ"]);
    setNewKeyRateLimit(1000);
    setCreatedKey(null);
  };

  const resetWebhookForm = () => {
    setShowCreateWebhook(false);
    setNewWebhookName("");
    setNewWebhookUrl("");
    setNewWebhookEvents([]);
    setCreatedWebhookSecret(null);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Authentication Required
          </h2>
          <p className="text-zinc-500">
            Please sign in to access developer settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Developer Settings
              </h1>
              <p className="text-zinc-500">
                Manage API keys and webhooks for agent integrations
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mb-8 flex flex-wrap gap-3">
          <a
            href="/docs"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            API Documentation
          </a>
          <a
            href="/api/openapi"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors"
          >
            <Code2 className="w-4 h-4" />
            OpenAPI Spec
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("keys")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "keys"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Keys
              {apiKeys.length > 0 && (
                <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">
                  {apiKeys.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "webhooks"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
              {webhooks.length > 0 && (
                <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">
                  {webhooks.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* API Keys Tab */}
        {activeTab === "keys" && (
          <div>
            {/* Create Key Button */}
            {!showCreateKey && !createdKey && (
              <button
                onClick={() => setShowCreateKey(true)}
                className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create API Key
              </button>
            )}

            {/* Create Key Form */}
            {(showCreateKey || createdKey) && (
              <div className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                {createdKey ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Check className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        API Key Created
                      </h3>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                        Copy this key now. It won&apos;t be shown again!
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 rounded font-mono text-sm break-all">
                          {createdKey}
                        </code>
                        <button
                          onClick={() => handleCopy(createdKey, "new-key")}
                          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        >
                          {copiedId === "new-key" ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={resetKeyForm}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                      Create New API Key
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="My Agent Key"
                          className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Permissions
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {PERMISSION_OPTIONS.map((perm) => (
                            <label
                              key={perm.value}
                              className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={newKeyPermissions.includes(perm.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewKeyPermissions((prev) => [
                                      ...prev,
                                      perm.value,
                                    ]);
                                  } else {
                                    setNewKeyPermissions((prev) =>
                                      prev.filter((p) => p !== perm.value)
                                    );
                                  }
                                }}
                                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                {perm.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Rate Limit (requests/hour)
                        </label>
                        <input
                          type="number"
                          value={newKeyRateLimit}
                          onChange={(e) =>
                            setNewKeyRateLimit(parseInt(e.target.value) || 1000)
                          }
                          min={100}
                          max={10000}
                          className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleCreateKey}
                          disabled={creatingKey || !newKeyName.trim()}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {creatingKey && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          Create Key
                        </button>
                        <button
                          onClick={resetKeyForm}
                          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Keys List */}
            {keysLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <Key className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  No API Keys
                </h3>
                <p className="text-zinc-500">
                  Create an API key to authenticate your agents.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                            {key.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              key.isActive
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {key.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono text-zinc-600 dark:text-zinc-400">
                            {key.keyPrefix}...
                          </code>
                          <span className="text-xs text-zinc-500">
                            {key.requestCount.toLocaleString()} requests
                          </span>
                          {key.lastUsedAt && (
                            <span className="text-xs text-zinc-500">
                              Last used:{" "}
                              {new Date(key.lastUsedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.slice(0, 4).map((perm) => (
                            <span
                              key={perm}
                              className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400"
                            >
                              {perm.replace("_", " ")}
                            </span>
                          ))}
                          {key.permissions.length > 4 && (
                            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400">
                              +{key.permissions.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleKey(key.id, key.isActive)}
                          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={key.isActive ? "Disable" : "Enable"}
                        >
                          {key.isActive ? (
                            <Eye className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          disabled={deletingId === key.id}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 transition-colors"
                        >
                          {deletingId === key.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === "webhooks" && (
          <div>
            {/* Create Webhook Button */}
            {!showCreateWebhook && !createdWebhookSecret && (
              <button
                onClick={() => setShowCreateWebhook(true)}
                disabled={webhooks.length >= 5}
                className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Create Webhook
                {webhooks.length >= 5 && (
                  <span className="text-xs">(Max 5)</span>
                )}
              </button>
            )}

            {/* Create Webhook Form */}
            {(showCreateWebhook || createdWebhookSecret) && (
              <div className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                {createdWebhookSecret ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Check className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Webhook Created
                      </h3>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                        Copy this signing secret now. It won&apos;t be shown
                        again!
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 rounded font-mono text-sm break-all">
                          {createdWebhookSecret}
                        </code>
                        <button
                          onClick={() =>
                            handleCopy(createdWebhookSecret, "new-webhook")
                          }
                          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        >
                          {copiedId === "new-webhook" ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={resetWebhookForm}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                      Create New Webhook
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={newWebhookName}
                          onChange={(e) => setNewWebhookName(e.target.value)}
                          placeholder="My Agent Webhook"
                          className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Endpoint URL
                        </label>
                        <input
                          type="url"
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          placeholder="https://your-agent.example.com/webhook"
                          className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Events
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                          {EVENT_OPTIONS.map((event) => (
                            <label
                              key={event.value}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={newWebhookEvents.includes(event.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewWebhookEvents((prev) => [
                                      ...prev,
                                      event.value,
                                    ]);
                                  } else {
                                    setNewWebhookEvents((prev) =>
                                      prev.filter((ev) => ev !== event.value)
                                    );
                                  }
                                }}
                                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                {event.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleCreateWebhook}
                          disabled={
                            creatingWebhook ||
                            !newWebhookName.trim() ||
                            !newWebhookUrl.trim()
                          }
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {creatingWebhook && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          Create Webhook
                        </button>
                        <button
                          onClick={resetWebhookForm}
                          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Webhooks List */}
            {webhooksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <Webhook className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  No Webhooks
                </h3>
                <p className="text-zinc-500">
                  Create a webhook to receive real-time notifications.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                            {webhook.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              webhook.isActive
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {webhook.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 font-mono mb-3 break-all">
                          {webhook.url}
                        </p>
                        <div className="flex items-center gap-4 mb-3 text-sm text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Activity className="w-4 h-4" />
                            {webhook.totalDeliveries} deliveries
                          </span>
                          <span className="text-emerald-600">
                            {webhook.successfulDeliveries} success
                          </span>
                          {webhook.failedDeliveries > 0 && (
                            <span className="text-red-600">
                              {webhook.failedDeliveries} failed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.slice(0, 3).map((event) => (
                            <span
                              key={event}
                              className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400"
                            >
                              {event.replace(/_/g, " ")}
                            </span>
                          ))}
                          {webhook.events.length > 3 && (
                            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400">
                              +{webhook.events.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleToggleWebhook(webhook.id, webhook.isActive)
                          }
                          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={webhook.isActive ? "Disable" : "Enable"}
                        >
                          {webhook.isActive ? (
                            <Eye className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          disabled={deletingId === webhook.id}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 transition-colors"
                        >
                          {deletingId === webhook.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
