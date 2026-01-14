"use client";

import { useState, useRef } from "react";
import { Settings, User, Wallet, Bell, Shield, Upload, X, Link2, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConnectWallet = () => {
    setWalletModalVisible(true);
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Maximum size is 5MB.");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/upload-picture", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      setProfileImage(data.imageUrl);
      alert("Profile picture updated successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!confirm("Remove profile picture?")) return;

    try {
      const res = await fetch("/api/profile/upload-picture", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove image");

      setProfileImage(null);
      alert("Profile picture removed");
    } catch (error) {
      console.error("Remove error:", error);
      alert("Failed to remove image");
    }
  };

  const handleSaveProfile = async () => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio,
        }),
      });

      if (!res.ok) throw new Error("Failed to save profile");

      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save profile");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
          <p className="text-zinc-500 mt-1">Manage your account preferences</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {[
                { id: "profile", label: "Profile", icon: User },
                { id: "wallet", label: "Wallet", icon: Wallet },
                { id: "notifications", label: "Notifications", icon: Bell },
                { id: "security", label: "Security", icon: Shield },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeTab === tab.id
                      ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              {activeTab === "profile" && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Profile Settings</h2>
                  <div className="space-y-6">
                    {/* Profile Picture */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Profile Picture</label>
                      <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                          {profileImage || session?.user?.image ? (
                            <Image
                              src={profileImage || session?.user?.image || ""}
                              alt="Profile"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-12 h-12 text-zinc-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                            >
                              <Upload className="w-4 h-4" />
                              {uploading ? "Uploading..." : "Upload Photo"}
                            </button>
                            {(profileImage || session?.user?.image) && (
                              <button
                                onClick={handleRemoveImage}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-2">JPG, PNG or WebP. Max 5MB.</p>
                        </div>
                      </div>
                    </div>

                    {/* Display Name */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        placeholder="Your name"
                      />
                    </div>

                    {/* Username - Read Only */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Username</label>
                      <input
                        type="text"
                        value={session?.user?.username || ""}
                        disabled
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        placeholder="username"
                      />
                      <p className="text-xs text-zinc-500 mt-1">Username cannot be changed</p>
                    </div>

                    {/* Bio */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Bio</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        rows={3}
                        placeholder="Tell us about yourself"
                        maxLength={500}
                      />
                      <p className="text-xs text-zinc-500 mt-1">{bio.length}/500 characters</p>
                    </div>

                    <button onClick={handleSaveProfile} className="btn-primary">
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "wallet" && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Wallet Settings</h2>
                  <p className="text-zinc-500 mb-6">Connect your Solana wallet to buy and sell projects.</p>

                  <div className="space-y-4">
                    {connected && publicKey ? (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Check className="w-5 h-5 text-green-500" />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">Wallet Connected</span>
                            </div>
                            <p className="text-sm text-zinc-500 mb-4">Your Solana wallet is connected and ready to use.</p>
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                              <p className="text-xs text-zinc-500 mb-1">Wallet Address</p>
                              <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100 break-all">
                                {publicKey.toBase58()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={handleDisconnectWallet}
                          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Disconnect Wallet
                        </button>
                      </div>
                    ) : (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                        <Wallet className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                          No Wallet Connected
                        </h3>
                        <p className="text-zinc-500 mb-6">
                          Connect your Solana wallet to start buying and selling on the marketplace.
                        </p>
                        <button
                          onClick={handleConnectWallet}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors"
                        >
                          <Link2 className="w-5 h-5" />
                          Connect Wallet
                        </button>
                      </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
                        Supported Wallets
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Phantom, Solflare, Coinbase Wallet, and Ledger are supported.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Notification Preferences</h2>
                  <div className="space-y-4">
                    {["Email notifications", "Bid alerts", "Sale notifications", "Marketing emails"].map((item) => (
                      <div key={item} className="flex items-center justify-between">
                        <span className="text-zinc-700 dark:text-zinc-300">{item}</span>
                        <button className="w-12 h-6 rounded-full bg-green-500 relative">
                          <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Security Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Current Password</label>
                      <input type="password" className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">New Password</label>
                      <input type="password" className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                    </div>
                    <button className="btn-primary">Update Password</button>
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
