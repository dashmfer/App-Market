"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Github,
  Globe,
  Database,
  Key,
  FileText,
  Palette,
  Upload,
  Plus,
  X,
  AlertCircle,
  Loader2,
  Info,
  Link as LinkIcon,
  MessageSquare,
  Sparkles,
  Lock,
  Code,
  Twitter,
  Instagram,
  Youtube,
  AtSign,
  Image,
  Video,
  CheckCircle2,
  ExternalLink,
  File,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  { id: 1, name: "Basics", description: "Project info" },
  { id: 2, name: "Assets Included", description: "What's being transferred" },
  { id: 3, name: "Pricing", description: "Sale settings" },
  { id: 4, name: "Review", description: "Final check" },
];

const categories = [
  { value: "SAAS", label: "SaaS", icon: "💼" },
  { value: "AI_ML", label: "AI & Machine Learning", icon: "🤖" },
  { value: "MOBILE_APP", label: "Mobile App", icon: "📱" },
  { value: "WEB_APP", label: "Web Application", icon: "🌐" },
  { value: "BROWSER_EXTENSION", label: "Browser Extension", icon: "🧩" },
  { value: "API", label: "API / Backend", icon: "⚡" },
  { value: "ECOMMERCE", label: "E-commerce", icon: "🛒" },
  { value: "CRYPTO_WEB3", label: "Crypto & Web3", icon: "⛓️" },
  { value: "DEVELOPER_TOOLS", label: "Developer Tools", icon: "🛠️" },
  { value: "GAMING", label: "Gaming", icon: "🎮" },
  { value: "OTHER", label: "Other", icon: "📦" },
];

const blockchains = [
  { value: "", label: "Not blockchain-based" },
  { value: "SOLANA", label: "Solana" },
  { value: "BASE", label: "Base" },
  { value: "HYPERLIQUID", label: "Hyperliquid" },
  { value: "ETHEREUM", label: "Ethereum" },
  { value: "BITCOIN", label: "Bitcoin" },
];

const popularTechStack = [
  "Next.js", "React", "Vue", "Angular", "Svelte",
  "Node.js", "Python", "Go", "Rust", "TypeScript",
  "PostgreSQL", "MongoDB", "Redis", "Supabase", "Firebase",
  "Tailwind", "OpenAI", "Stripe", "AWS", "Vercel",
  "Solana", "Ethereum", "Anchor", "Hardhat", "Foundry",
];

const socialPlatforms = [
  { key: "twitter", label: "Twitter / X", icon: Twitter, placeholder: "@username or URL" },
  { key: "discord", label: "Discord", icon: MessageSquare, placeholder: "discord.gg/..." },
  { key: "telegram", label: "Telegram", icon: MessageSquare, placeholder: "t.me/..." },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@username or URL" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "Channel URL" },
  { key: "tiktok", label: "TikTok", icon: AtSign, placeholder: "@username or URL" },
  { key: "other", label: "Other", icon: Globe, placeholder: "URL" },
];

export default function CreateListingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingGithub, setIsVerifyingGithub] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  
  const [formData, setFormData] = useState({
    // Step 1: Basics
    profileImage: null as File | null,
    profileImagePreview: "",
    title: "",
    tagline: "",
    description: "",
    category: "",
    blockchain: "",
    techStack: [] as string[],
    customTech: "",
    demoUrl: "",
    videoUrl: "",
    
    // AI Image Generation (disabled for now)
    aiImagePrompt: "",
    generatedImageUrl: "",
    
    // Step 2: Assets Included (all will be required in transfer)
    // Code & Repository
    hasCodeFiles: false,
    codeFilesDescription: "",
    githubRepo: "",
    githubVerified: false,
    githubVerificationError: "",
    repoStats: null as { files: number; lines: number; lastUpdated: string } | null,
    
    // Domain & Hosting
    hasDomain: false,
    domain: "",
    hasHosting: false,
    hostingProvider: "",
    
    // Database
    hasDatabase: false,
    databaseType: "",
    
    // API Keys & Credentials
    hasApiKeys: false,
    apiKeysDescription: "",
    
    // Design Files
    hasDesignFiles: false,
    designFilesDescription: "",
    
    // Documentation
    hasDocumentation: false,
    documentationDescription: "",
    
    // Smart Contract (for Crypto/Web3)
    hasSmartContract: false,
    smartContractType: "" as "" | "solana" | "ethereum" | "other",
    smartContractProgramId: "",
    smartContractVerified: false,
    
    // Brand Assets
    hasBrandAssets: false,
    brandAssetsList: "",
    
    // Media Files
    screenshots: [] as File[],
    hasDemoVideo: false,
    demoVideoDescription: "",
    hasProductVideo: false,
    productVideoDescription: "",
    
    // AI Conversations / Chat Logs
    hasAiConversations: false,
    aiConversationPlatform: "",
    
    // Pitch Deck & Marketing
    hasPitchDeck: false,
    hasMarketingPlan: false,
    
    // Social Accounts (with transfer)
    socialAccounts: [] as { platform: string; handle: string }[],
    
    // Project Links (with transfer)
    projectLinks: [] as { label: string; url: string }[],
    
    // Other Documents
    otherDocuments: [] as { description: string }[],
    
    // Additional Assets
    additionalAssets: "",
    
    // Step 3: Pricing
    enableAuction: true,
    startingPrice: "",
    reservePrice: "",
    duration: "7",
    enableBuyNow: false,
    buyNowPrice: "",
    currency: "APP",
    
    // Terms accepted
    termsAccepted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  // Profile image handler
  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateFormData("profileImage", file);
      const reader = new FileReader();
      reader.onloadend = () => {
        updateFormData("profileImagePreview", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Tech stack helpers
  const addTechStack = (tech: string) => {
    if (!formData.techStack.includes(tech)) {
      updateFormData("techStack", [...formData.techStack, tech]);
    }
  };
  const removeTechStack = (tech: string) => {
    updateFormData("techStack", formData.techStack.filter(t => t !== tech));
  };

  // Social account helpers
  const addSocialAccount = () => {
    updateFormData("socialAccounts", [...formData.socialAccounts, { platform: "", handle: "" }]);
  };
  const updateSocialAccount = (index: number, field: string, value: any) => {
    const updated = [...formData.socialAccounts];
    updated[index] = { ...updated[index], [field]: value };
    updateFormData("socialAccounts", updated);
  };
  const removeSocialAccount = (index: number) => {
    updateFormData("socialAccounts", formData.socialAccounts.filter((_, i) => i !== index));
  };

  // Project link helpers
  const addProjectLink = () => {
    updateFormData("projectLinks", [...formData.projectLinks, { label: "", url: "" }]);
  };
  const updateProjectLink = (index: number, field: string, value: any) => {
    const updated = [...formData.projectLinks];
    updated[index] = { ...updated[index], [field]: value };
    updateFormData("projectLinks", updated);
  };
  const removeProjectLink = (index: number) => {
    updateFormData("projectLinks", formData.projectLinks.filter((_, i) => i !== index));
  };

  // Document helpers
  const addOtherDocument = () => {
    updateFormData("otherDocuments", [...formData.otherDocuments, { description: "" }]);
  };
  const updateOtherDocument = (index: number, value: string) => {
    const updated = [...formData.otherDocuments];
    updated[index] = { description: value };
    updateFormData("otherDocuments", updated);
  };
  const removeOtherDocument = (index: number) => {
    updateFormData("otherDocuments", formData.otherDocuments.filter((_, i) => i !== index));
  };

  // GitHub verification - requires user to authenticate with GitHub
  const verifyGitHubRepo = async () => {
    if (!formData.githubRepo.trim()) {
      updateFormData("githubVerificationError", "Please enter a repository URL");
      return;
    }
    
    setIsVerifyingGithub(true);
    updateFormData("githubVerificationError", "");
    
    try {
      // Extract owner/repo from URL
      const match = formData.githubRepo.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
      if (!match) {
        updateFormData("githubVerificationError", "Invalid GitHub URL format");
        setIsVerifyingGithub(false);
        return;
      }
      
      const [, owner, repo] = match;
      
      // Call API to verify ownership
      const response = await fetch("/api/github/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo: repo.replace(/\.git$/, "") }),
      });
      
      const data = await response.json();
      
      if (data.verified) {
        updateFormData("githubVerified", true);
        updateFormData("repoStats", data.stats);
      } else {
        updateFormData("githubVerificationError", data.error || "Could not verify ownership. Make sure you own this repository.");
      }
    } catch (error) {
      updateFormData("githubVerificationError", "Verification failed. Please try again.");
    } finally {
      setIsVerifyingGithub(false);
    }
  };

  // Smart contract verification
  const verifySmartContract = async () => {
    if (!formData.smartContractProgramId) return;
    await new Promise(r => setTimeout(r, 1500));
    updateFormData("smartContractVerified", true);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!formData.title.trim()) newErrors.title = "Title is required";
      if (!formData.description.trim()) newErrors.description = "Description is required";
      if (!formData.category) newErrors.category = "Category is required";
      if (formData.techStack.length === 0) newErrors.techStack = "Add at least one technology";
    }
    
    if (step === 2) {
      // Must have at least code files or github
      if (!formData.hasCodeFiles && !formData.githubRepo.trim()) {
        newErrors.assets = "You must include either Code Files or a GitHub Repository";
      }
      if (formData.githubRepo.trim() && !formData.githubVerified) {
        newErrors.githubRepo = "Please verify your GitHub repository ownership";
      }
      if (formData.hasCodeFiles && !formData.codeFilesDescription.trim()) {
        newErrors.codeFilesDescription = "Describe what code files will be transferred";
      }
    }
    
    if (step === 3) {
      if (!formData.enableAuction && !formData.enableBuyNow) {
        newErrors.pricing = "Enable at least Auction or Buy Now";
      }
      if (formData.enableAuction) {
        if (!formData.startingPrice) newErrors.startingPrice = "Starting price required";
        if (Number(formData.startingPrice) <= 0) newErrors.startingPrice = "Must be greater than 0";
      }
      if (formData.enableBuyNow) {
        if (!formData.buyNowPrice) newErrors.buyNowPrice = "Buy now price required";
        if (Number(formData.buyNowPrice) <= 0) newErrors.buyNowPrice = "Must be greater than 0";
        if (formData.enableAuction && Number(formData.buyNowPrice) <= Number(formData.startingPrice)) {
          newErrors.buyNowPrice = "Must be higher than starting price";
        }
      }
    }
    
    if (step === 4) {
      if (!formData.termsAccepted) newErrors.terms = "You must accept the terms";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setSubmitError(null); // Clear any previous submit errors
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };
  const prevStep = () => {
    setSubmitError(null); // Clear any previous submit errors
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setSubmitError(null);

    // Check wallet connection
    if (!connected || !publicKey || !signMessage) {
      setSubmitError("Please connect your wallet to publish the listing.");
      setWalletModalVisible(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // Create a message to sign for listing creation
      const message = `Create listing on App Market.\n\nTitle: ${formData.title}\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
      const encodedMessage = new TextEncoder().encode(message);

      // Request signature from wallet
      const signature = await signMessage(encodedMessage);

      // Convert signature to base58
      const bs58 = await import("bs58");
      const signatureBase58 = bs58.default.encode(signature);

      // Submit to API with wallet signature
      // Map form fields to API expected fields
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          tagline: formData.tagline,
          description: formData.description,
          category: formData.category,
          blockchain: formData.blockchain || null,
          techStack: formData.techStack,
          thumbnailUrl: formData.profileImagePreview || null, // Map profileImagePreview to thumbnailUrl
          demoUrl: formData.demoUrl,
          videoUrl: formData.videoUrl,
          githubRepo: formData.githubRepo,
          hasDomain: formData.hasDomain,
          domain: formData.domain,
          hasDatabase: formData.hasDatabase,
          databaseType: formData.databaseType,
          hasHosting: formData.hasHosting,
          hostingProvider: formData.hostingProvider,
          hasSocialAccounts: formData.socialAccounts.length > 0,
          socialAccounts: formData.socialAccounts.length > 0 ? JSON.stringify(formData.socialAccounts) : null,
          hasApiKeys: formData.hasApiKeys,
          hasDesignFiles: formData.hasDesignFiles,
          hasDocumentation: formData.hasDocumentation,
          additionalAssets: formData.additionalAssets,
          startingPrice: formData.startingPrice,
          reservePrice: formData.reservePrice || null,
          buyNowEnabled: formData.enableBuyNow,
          buyNowPrice: formData.buyNowPrice || null,
          currency: formData.currency,
          duration: formData.duration,
          walletAddress: publicKey.toBase58(),
          walletSignature: signatureBase58,
          signedMessage: message,
        }),
      });

      if (response.ok) {
        router.push("/dashboard/listings");
      } else {
        let errorMessage = "Failed to create listing";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Response might be empty or not JSON
          errorMessage = `Server error (${response.status}). Please try again.`;
        }
        setSubmitError(errorMessage);
      }
    } catch (error: any) {
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        setSubmitError("Signature request was rejected. Please try again.");
      } else {
        setSubmitError(`Failed to create listing: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get all transferable items for review
  const getTransferableItems = () => {
    const items: string[] = [];
    if (formData.hasCodeFiles) items.push("Code Files");
    if (formData.githubRepo && formData.githubVerified) items.push("GitHub Repository");
    if (formData.hasDomain) items.push(`Domain: ${formData.domain}`);
    if (formData.hasDatabase) items.push(`Database: ${formData.databaseType}`);
    if (formData.hasHosting) items.push(`Hosting: ${formData.hostingProvider}`);
    if (formData.hasApiKeys) items.push("API Keys & Credentials");
    if (formData.hasDesignFiles) items.push("Design Files");
    if (formData.hasDocumentation) items.push("Documentation");
    if (formData.hasBrandAssets) items.push("Brand Assets");
    if (formData.hasSmartContract) items.push("Smart Contract Admin Keys");
    if (formData.hasDemoVideo) items.push("Demo Video");
    if (formData.hasProductVideo) items.push("Product Video");
    if (formData.hasAiConversations) items.push("AI Conversations");
    if (formData.hasPitchDeck) items.push("Pitch Deck");
    if (formData.hasMarketingPlan) items.push("Marketing Plan");
    formData.socialAccounts.filter(s => s.handle).forEach(s => {
      items.push(`Social: ${s.platform} (${s.handle})`);
    });
    formData.projectLinks.filter(l => l.url).forEach(l => {
      items.push(`Link: ${l.label || l.url}`);
    });
    formData.otherDocuments.filter(d => d.description).forEach(d => {
      items.push(d.description);
    });
    return items;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Sign in required
          </h2>
          <p className="mt-2 text-zinc-500">
            Connect your wallet to create a listing.
          </p>
          <Link href="/auth/signin?callbackUrl=/create">
            <Button variant="primary" size="lg" className="mt-6">
              <Wallet className="w-5 h-5" />
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 md:py-12">
      <div className="container-tight">
        {/* Submit Error */}
        {submitError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{submitError}</span>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                  currentStep >= step.id 
                    ? "bg-green-500 text-white" 
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                }`}>
                  {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <div className="hidden sm:block ml-3">
                  <p className={`text-sm font-medium ${currentStep >= step.id ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-zinc-500">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 sm:w-24 h-1 mx-2 sm:mx-4 rounded ${
                    currentStep > step.id ? "bg-green-500" : "bg-zinc-200 dark:bg-zinc-800"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Project Basics</h2>
                  
                  {/* Profile Image / Logo */}
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                      Project Logo / Image <span className="text-zinc-400">(optional)</span>
                    </label>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {formData.profileImagePreview ? (
                          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700">
                            <img src={formData.profileImagePreview} alt="Profile" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800">
                            <Image className="w-8 h-8 text-zinc-400" />
                          </div>
                        )}
                        <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-600 transition-colors">
                          <Plus className="w-4 h-4 text-white" />
                          <input type="file" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
                        </label>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Upload a logo or image for your project</p>
                        <p className="text-xs text-zinc-500 mt-1">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Image Generation - Disabled */}
                  <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 opacity-60">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                          Generate with AI <span className="text-sm font-normal text-purple-600">(coming soon)</span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">No logo? Let AI create a professional image for your project.</p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={formData.aiImagePrompt} 
                            onChange={(e) => updateFormData("aiImagePrompt", e.target.value)} 
                            placeholder="Describe your ideal project image..." 
                            className="input-field flex-1" 
                            disabled 
                          />
                          <button 
                            type="button" 
                            disabled 
                            className="btn-primary whitespace-nowrap opacity-50 cursor-not-allowed"
                          >
                            <Sparkles className="w-4 h-4" />Generate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Project Title <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.title} 
                        onChange={(e) => updateFormData("title", e.target.value)} 
                        placeholder="My Awesome App"
                        className={`input-field ${errors.title ? "border-red-500" : ""}`}
                      />
                      {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Tagline <span className="text-zinc-400">(optional)</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.tagline} 
                        onChange={(e) => updateFormData("tagline", e.target.value)} 
                        placeholder="A short, catchy description"
                        className="input-field"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea 
                        value={formData.description} 
                        onChange={(e) => updateFormData("description", e.target.value)} 
                        placeholder="Describe your project in detail. What does it do? What problem does it solve?"
                        rows={6}
                        className={`input-field resize-none ${errors.description ? "border-red-500" : ""}`}
                      />
                      {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => updateFormData("category", cat.value)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              formData.category === cat.value
                                ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                            }`}
                          >
                            <span className="text-xl mb-1 block">{cat.icon}</span>
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
                    </div>

                    {/* Blockchain - Optional */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Blockchain <span className="text-zinc-400">(if on-chain)</span>
                      </label>
                      <select
                        value={formData.blockchain}
                        onChange={(e) => updateFormData("blockchain", e.target.value)}
                        className="w-full md:w-auto px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        {blockchains.map((chain) => (
                          <option key={chain.value} value={chain.value}>
                            {chain.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-zinc-500">
                        Select if your project is built on a specific blockchain
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        Tech Stack <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.techStack.map((tech) => (
                          <span key={tech} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
                            {tech}
                            <button type="button" onClick={() => removeTechStack(tech)} className="hover:text-green-900">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {popularTechStack.filter(t => !formData.techStack.includes(t)).slice(0, 15).map((tech) => (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => addTechStack(tech)}
                            className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          >
                            + {tech}
                          </button>
                        ))}
                      </div>
                      {errors.techStack && <p className="mt-1 text-sm text-red-500">{errors.techStack}</p>}
                    </div>

                    {/* Demo URL & Video URL moved to Basics */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Demo URL <span className="text-zinc-400">(optional)</span>
                        </label>
                        <input 
                          type="url" 
                          value={formData.demoUrl} 
                          onChange={(e) => updateFormData("demoUrl", e.target.value)} 
                          placeholder="https://your-demo.com"
                          className="input-field"
                        />
                        <p className="mt-1 text-xs text-zinc-500">Live demo helps buyers see your project</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Video Walkthrough <span className="text-zinc-400">(optional)</span>
                        </label>
                        <input 
                          type="url" 
                          value={formData.videoUrl} 
                          onChange={(e) => updateFormData("videoUrl", e.target.value)} 
                          placeholder="https://youtube.com/watch?v=..."
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Assets Included */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {errors.assets && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-600 dark:text-red-400">{errors.assets}</p>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-blue-700 dark:text-blue-400 font-medium">Everything checked here must be transferred to the buyer</p>
                    <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">Only select assets you're willing to fully transfer ownership of. Documents are not uploaded - they'll be transferred securely during the sale process.</p>
                  </div>
                </div>

                {/* Code & Repository Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Code & Repository</h2>
                  <p className="text-zinc-500 mb-4">Source code and version control access</p>

                  {/* Required notice */}
                  <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Required:</strong> You must include at least one - either Code Files or a GitHub Repository (or both).
                    </p>
                  </div>

                  {errors.assets && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.assets}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Code Files */}
                    <div className={`p-4 rounded-xl border ${formData.hasCodeFiles ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.hasCodeFiles} 
                          onChange={(e) => updateFormData("hasCodeFiles", e.target.checked)} 
                          className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-green-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Code className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Code Files</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Source code files to be transferred directly</p>
                        </div>
                      </label>
                      {formData.hasCodeFiles && (
                        <div className="mt-4 ml-8">
                          <textarea
                            value={formData.codeFilesDescription}
                            onChange={(e) => updateFormData("codeFilesDescription", e.target.value)}
                            placeholder="Describe what code files will be transferred (e.g., 'Full Next.js frontend + Node.js backend, 47 files including components, API routes, and utilities')"
                            rows={3}
                            className={`input-field resize-none ${errors.codeFilesDescription ? "border-red-500" : ""}`}
                          />
                          {errors.codeFilesDescription && <p className="mt-1 text-sm text-red-500">{errors.codeFilesDescription}</p>}
                        </div>
                      )}
                    </div>

                    {/* GitHub Repository */}
                    <div className={`p-4 rounded-xl border ${formData.githubVerified ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <div className="flex items-start gap-3">
                        <Github className="w-5 h-5 text-zinc-600 dark:text-zinc-400 mt-1" />
                        <div className="flex-1">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">GitHub Repository</span>
                          <p className="text-sm text-zinc-500 mt-1">Repository ownership will be transferred to buyer</p>
                          
                          <div className="mt-3 space-y-3">
                            <div className="flex gap-2">
                              <input 
                                type="url" 
                                value={formData.githubRepo} 
                                onChange={(e) => {
                                  updateFormData("githubRepo", e.target.value);
                                  updateFormData("githubVerified", false);
                                  updateFormData("githubVerificationError", "");
                                }} 
                                placeholder="https://github.com/username/repo"
                                className={`input-field flex-1 ${errors.githubRepo ? "border-red-500" : ""}`}
                              />
                              <button
                                type="button"
                                onClick={verifyGitHubRepo}
                                disabled={isVerifyingGithub || !formData.githubRepo.trim()}
                                className="btn-secondary whitespace-nowrap"
                              >
                                {isVerifyingGithub ? (
                                  <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</>
                                ) : formData.githubVerified ? (
                                  <><CheckCircle2 className="w-4 h-4 text-green-500" />Verified</>
                                ) : (
                                  <>Verify Ownership</>
                                )}
                              </button>
                            </div>
                            
                            {formData.githubVerificationError && (
                              <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {formData.githubVerificationError}
                              </p>
                            )}
                            
                            {errors.githubRepo && !formData.githubVerificationError && (
                              <p className="text-sm text-red-500">{errors.githubRepo}</p>
                            )}
                            
                            {formData.githubVerified && formData.repoStats && (
                              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="font-medium">Repository verified!</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                                  <div><span className="font-medium">{formData.repoStats.files}</span> files</div>
                                  <div><span className="font-medium">{formData.repoStats.lines.toLocaleString()}</span> lines</div>
                                  <div>Updated <span className="font-medium">{formData.repoStats.lastUpdated}</span></div>
                                </div>
                              </div>
                            )}
                            
                            <p className="text-xs text-zinc-500">
                              You must be the owner of this repository. We'll verify ownership through your connected GitHub account.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Infrastructure Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Infrastructure</h2>
                  <p className="text-zinc-500 mb-6">Domain, hosting, and database access</p>
                  
                  <div className="space-y-4">
                    {/* Domain */}
                    <div className={`p-4 rounded-xl border ${formData.hasDomain ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasDomain} onChange={(e) => updateFormData("hasDomain", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Domain Name</span>
                          </div>
                        </div>
                      </label>
                      {formData.hasDomain && (
                        <input type="text" value={formData.domain} onChange={(e) => updateFormData("domain", e.target.value)} placeholder="example.com" className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    {/* Hosting */}
                    <div className={`p-4 rounded-xl border ${formData.hasHosting ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasHosting} onChange={(e) => updateFormData("hasHosting", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Hosting Account</span>
                          </div>
                        </div>
                      </label>
                      {formData.hasHosting && (
                        <input type="text" value={formData.hostingProvider} onChange={(e) => updateFormData("hostingProvider", e.target.value)} placeholder="Vercel, AWS, Netlify, etc." className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    {/* Database */}
                    <div className={`p-4 rounded-xl border ${formData.hasDatabase ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasDatabase} onChange={(e) => updateFormData("hasDatabase", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Database</span>
                          </div>
                        </div>
                      </label>
                      {formData.hasDatabase && (
                        <input type="text" value={formData.databaseType} onChange={(e) => updateFormData("databaseType", e.target.value)} placeholder="PostgreSQL, MongoDB, Supabase, etc." className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    {/* API Keys */}
                    <div className={`p-4 rounded-xl border ${formData.hasApiKeys ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasApiKeys} onChange={(e) => updateFormData("hasApiKeys", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">API Keys & Credentials</span>
                          </div>
                        </div>
                      </label>
                      {formData.hasApiKeys && (
                        <textarea value={formData.apiKeysDescription} onChange={(e) => updateFormData("apiKeysDescription", e.target.value)} placeholder="List the API keys included (e.g., OpenAI, Stripe, etc.)" rows={2} className="input-field mt-3 ml-8 resize-none" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Design & Documentation Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Design & Documentation</h2>
                  <p className="text-zinc-500 mb-6">Design assets and project documentation</p>
                  
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${formData.hasDesignFiles ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasDesignFiles} onChange={(e) => updateFormData("hasDesignFiles", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Palette className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Design Files</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Figma, Sketch, Adobe XD files</p>
                        </div>
                      </label>
                      {formData.hasDesignFiles && (
                        <input type="text" value={formData.designFilesDescription} onChange={(e) => updateFormData("designFilesDescription", e.target.value)} placeholder="Describe design files included" className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    <div className={`p-4 rounded-xl border ${formData.hasDocumentation ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasDocumentation} onChange={(e) => updateFormData("hasDocumentation", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Documentation</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Technical docs, README, setup guides</p>
                        </div>
                      </label>
                      {formData.hasDocumentation && (
                        <input type="text" value={formData.documentationDescription} onChange={(e) => updateFormData("documentationDescription", e.target.value)} placeholder="Describe documentation included" className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    <div className={`p-4 rounded-xl border ${formData.hasBrandAssets ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasBrandAssets} onChange={(e) => updateFormData("hasBrandAssets", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Palette className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Brand Assets</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Logos, icons, brand guidelines</p>
                        </div>
                      </label>
                      {formData.hasBrandAssets && (
                        <textarea value={formData.brandAssetsList} onChange={(e) => updateFormData("brandAssetsList", e.target.value)} placeholder="List brand assets included" rows={2} className="input-field mt-3 ml-8 resize-none" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Media Files Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Media Files</h2>
                  <p className="text-zinc-500 mb-6">Screenshots and videos to be transferred</p>
                  
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${formData.hasDemoVideo ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasDemoVideo} onChange={(e) => updateFormData("hasDemoVideo", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Video className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Demo Video (MP4)</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Product demo video file to transfer</p>
                        </div>
                      </label>
                      {formData.hasDemoVideo && (
                        <input type="text" value={formData.demoVideoDescription} onChange={(e) => updateFormData("demoVideoDescription", e.target.value)} placeholder="Describe the demo video" className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    <div className={`p-4 rounded-xl border ${formData.hasProductVideo ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasProductVideo} onChange={(e) => updateFormData("hasProductVideo", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Video className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Product Video (MP4)</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Marketing or promo video file</p>
                        </div>
                      </label>
                      {formData.hasProductVideo && (
                        <input type="text" value={formData.productVideoDescription} onChange={(e) => updateFormData("productVideoDescription", e.target.value)} placeholder="Describe the product video" className="input-field mt-3 ml-8" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Business Documents Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Business Documents</h2>
                  <p className="text-zinc-500 mb-6">Documents to be transferred - no upload required here</p>
                  
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${formData.hasAiConversations ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasAiConversations} onChange={(e) => updateFormData("hasAiConversations", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">AI Conversations / Chat Logs</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">ChatGPT, Claude, or other AI conversation history</p>
                        </div>
                      </label>
                      {formData.hasAiConversations && (
                        <input type="text" value={formData.aiConversationPlatform} onChange={(e) => updateFormData("aiConversationPlatform", e.target.value)} placeholder="Platform (e.g., ChatGPT, Claude)" className="input-field mt-3 ml-8" />
                      )}
                    </div>

                    <div className={`p-4 rounded-xl border ${formData.hasPitchDeck ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasPitchDeck} onChange={(e) => updateFormData("hasPitchDeck", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Pitch Deck</span>
                          </div>
                        </div>
                      </label>
                    </div>

                    <div className={`p-4 rounded-xl border ${formData.hasMarketingPlan ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasMarketingPlan} onChange={(e) => updateFormData("hasMarketingPlan", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Marketing Plan</span>
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Other Documents */}
                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Other Documents</p>
                      <div className="space-y-2">
                        {formData.otherDocuments.map((doc, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={doc.description}
                              onChange={(e) => updateOtherDocument(index, e.target.value)}
                              placeholder="Document description"
                              className="input-field flex-1"
                            />
                            <button type="button" onClick={() => removeOtherDocument(index)} className="p-2 text-zinc-400 hover:text-red-500">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={addOtherDocument} className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
                          <Plus className="w-4 h-4" />Add Document
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social & Project Links Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Social & Project Links</h2>
                  <p className="text-zinc-500 mb-6">Accounts and links to transfer to the buyer</p>
                  
                  {/* Social Accounts */}
                  <div className="mb-6">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Social Accounts to Transfer</h3>
                    <div className="space-y-3">
                      {formData.socialAccounts.map((account, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                          <select
                            value={account.platform}
                            onChange={(e) => updateSocialAccount(index, "platform", e.target.value)}
                            className="input-field w-40"
                          >
                            <option value="">Platform</option>
                            {socialPlatforms.map(p => (
                              <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={account.handle}
                            onChange={(e) => updateSocialAccount(index, "handle", e.target.value)}
                            placeholder="@handle or URL"
                            className="input-field flex-1"
                          />
                          <button type="button" onClick={() => removeSocialAccount(index)} className="p-2 text-zinc-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addSocialAccount} className="w-full py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 hover:border-green-500 hover:text-green-600 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />Add Social Account
                      </button>
                    </div>
                  </div>

                  {/* Project Links */}
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">Project Links to Transfer</h3>
                    <p className="text-sm text-zinc-500 mb-3">MVPs, test sites, landing pages, etc.</p>
                    <div className="space-y-3">
                      {formData.projectLinks.map((link, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                          <LinkIcon className="w-5 h-5 text-zinc-400" />
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => updateProjectLink(index, "label", e.target.value)}
                            placeholder="Label (e.g., MVP, Landing)"
                            className="input-field w-40"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => updateProjectLink(index, "url", e.target.value)}
                            placeholder="https://..."
                            className="input-field flex-1"
                          />
                          <button type="button" onClick={() => removeProjectLink(index)} className="p-2 text-zinc-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addProjectLink} className="w-full py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 hover:border-green-500 hover:text-green-600 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />Add Project Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Pricing */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Pricing Settings</h2>

                  {errors.pricing && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <p className="text-red-600 dark:text-red-400">{errors.pricing}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Currency Selection */}
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                        Payment Currency
                      </label>
                      <div className="flex gap-3">
                        {[
                          { value: "APP", label: "$APP", icon: "✅", description: "Platform Token" },
                          { value: "SOL", label: "SOL", icon: "◎", description: "Native Solana" },
                          { value: "USDC", label: "USDC", icon: "💵", description: "Stablecoin" },
                        ].map((currency) => (
                          <button
                            key={currency.value}
                            type="button"
                            onClick={() => updateFormData("currency", currency.value)}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                              formData.currency === currency.value
                                ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                            }`}
                          >
                            <span className="text-2xl block mb-1">{currency.icon}</span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{currency.label}</span>
                            <span className="text-xs text-zinc-500">{currency.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auction */}
                    <div className={`p-6 rounded-xl border ${formData.enableAuction ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer mb-4">
                        <input type="checkbox" checked={formData.enableAuction} onChange={(e) => updateFormData("enableAuction", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">Enable Auction</span>
                          <p className="text-sm text-zinc-500">Let buyers bid on your project</p>
                        </div>
                      </label>

                      {formData.enableAuction && (
                        <div className="grid md:grid-cols-3 gap-4 ml-8">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Starting Price ({formData.currency})</label>
                            <input type="number" value={formData.startingPrice} onChange={(e) => updateFormData("startingPrice", e.target.value)} placeholder="0.00" step="0.01" className={`input-field ${errors.startingPrice ? "border-red-500" : ""}`} />
                            {errors.startingPrice && <p className="mt-1 text-sm text-red-500">{errors.startingPrice}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Reserve Price (Optional)</label>
                            <input type="number" value={formData.reservePrice} onChange={(e) => updateFormData("reservePrice", e.target.value)} placeholder="0.00" step="0.01" className="input-field" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duration</label>
                            <select value={formData.duration} onChange={(e) => updateFormData("duration", e.target.value)} className="input-field">
                              <option value="1">1 day</option>
                              <option value="3">3 days</option>
                              <option value="5">5 days</option>
                              <option value="7">7 days</option>
                              <option value="14">14 days</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Buy Now */}
                    <div className={`p-6 rounded-xl border ${formData.enableBuyNow ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer mb-4">
                        <input type="checkbox" checked={formData.enableBuyNow} onChange={(e) => updateFormData("enableBuyNow", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">Enable Buy Now</span>
                          <p className="text-sm text-zinc-500">Allow instant purchase at a fixed price</p>
                        </div>
                      </label>

                      {formData.enableBuyNow && (
                        <div className="ml-8 max-w-xs">
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Buy Now Price ({formData.currency})</label>
                          <input type="number" value={formData.buyNowPrice} onChange={(e) => updateFormData("buyNowPrice", e.target.value)} placeholder="0.00" step="0.01" className={`input-field ${errors.buyNowPrice ? "border-red-500" : ""}`} />
                          {errors.buyNowPrice && <p className="mt-1 text-sm text-red-500">{errors.buyNowPrice}</p>}
                        </div>
                      )}
                    </div>

                    {/* Fee Info */}
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <strong>Platform Fee:</strong> 5% of final sale price
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Review Your Listing</h2>
                  
                  <div className="space-y-6">
                    {/* Project Summary */}
                    <div className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                      {formData.profileImagePreview ? (
                        <img src={formData.profileImagePreview} alt="" className="w-16 h-16 rounded-xl object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold">
                          {formData.title.charAt(0) || "?"}
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formData.title || "Untitled"}</h3>
                        {formData.tagline && <p className="text-zinc-500">{formData.tagline}</p>}
                        <p className="text-sm text-zinc-500 mt-1">{categories.find(c => c.value === formData.category)?.label || "No category"}</p>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Pricing</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-zinc-500">Currency: <strong className="text-zinc-900 dark:text-zinc-100">{formData.currency === "APP" ? "$APP" : formData.currency}</strong></p>
                        {formData.enableAuction && <p>Auction starting at <strong>{formData.startingPrice} {formData.currency === "APP" ? "$APP" : formData.currency}</strong></p>}
                        {formData.enableBuyNow && <p>Buy Now for <strong>{formData.buyNowPrice} {formData.currency === "APP" ? "$APP" : formData.currency}</strong></p>}
                      </div>
                    </div>

                    {/* Transfer Checklist */}
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <h4 className="font-medium text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Assets to Transfer ({getTransferableItems().length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {getTransferableItems().map((item, i) => (
                          <span key={i} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-sm">{item}</span>
                        ))}
                      </div>
                    </div>

                    {/* Terms */}
                    <div className={`p-4 rounded-xl border ${errors.terms ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.termsAccepted} onChange={(e) => updateFormData("termsAccepted", e.target.checked)} className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-green-500" />
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          I confirm I own all assets listed
                        </span>
                      </label>
                      {errors.terms && <p className="mt-2 text-sm text-red-500">{errors.terms}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button onClick={prevStep} disabled={currentStep === 1} className={`btn-secondary ${currentStep === 1 ? "opacity-50 cursor-not-allowed" : ""}`}>
            <ArrowLeft className="w-4 h-4" />Back
          </button>
          {currentStep < steps.length ? (
            <button onClick={nextStep} className="btn-primary">Continue<ArrowRight className="w-4 h-4" /></button>
          ) : (
            <button onClick={handleSubmit} disabled={isSubmitting} className="btn-success">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : <><Check className="w-4 h-4" />Publish Listing</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
