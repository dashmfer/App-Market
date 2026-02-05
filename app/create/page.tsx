"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
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
  Star,
} from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { CollaboratorInput, type Collaborator } from "@/components/listings/collaborator-input";

// Custom Provider Dropdown with logos and premium badges
interface ProviderOption {
  value: string;
  label: string;
  transferMethod: string;
  placeholder: string;
  logo: string | null;
  premium: boolean;
}

function ProviderDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: ProviderOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-left hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-3">
            {selected.logo ? (
              <div className="w-5 h-5 relative flex-shrink-0">
                <NextImage src={selected.logo} alt={selected.label} fill className="object-contain" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <Globe className="w-3 h-3 text-zinc-500" />
              </div>
            )}
            <span className="text-zinc-900 dark:text-zinc-100">{selected.label}</span>
            {selected.premium && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-current" />
                Premium
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-400">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${
                value === option.value ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
              }`}
            >
              {option.logo ? (
                <div className="w-5 h-5 relative flex-shrink-0">
                  <NextImage src={option.logo} alt={option.label} fill className="object-contain" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                  <Globe className="w-3 h-3 text-zinc-500" />
                </div>
              )}
              <span className="flex-1 text-left text-zinc-900 dark:text-zinc-100">{option.label}</span>
              {option.premium && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  Premium
                </span>
              )}
              {value === option.value && (
                <Check className="w-4 h-4 text-emerald-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  { value: "CRYPTO_WEB3", label: "Crypto", icon: "⛓️" },
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

// Infrastructure Providers with logos and premium flags
const hostingProviders = [
  { value: "vercel", label: "Vercel", transferMethod: "Project transfer via dashboard", placeholder: "Project URL", logo: "/logos/vercel.svg", premium: true },
  { value: "railway", label: "Railway", transferMethod: "Team invite or project transfer", placeholder: "Project URL", logo: "/logos/railway.svg", premium: true },
  { value: "render", label: "Render", transferMethod: "Team transfer or account handoff", placeholder: "Service URL", logo: "/logos/render.svg", premium: false },
  { value: "fly", label: "Fly.io", transferMethod: "Organization transfer", placeholder: "App name", logo: "/logos/fly.svg", premium: true },
  { value: "heroku", label: "Heroku", transferMethod: "App transfer via dashboard", placeholder: "App name", logo: "/logos/heroku.svg", premium: false },
  { value: "digitalocean", label: "DigitalOcean", transferMethod: "Team invite or droplet transfer", placeholder: "Project/Droplet URL", logo: "/logos/digitalocean.svg", premium: false },
  { value: "aws", label: "AWS", transferMethod: "IAM account or organization transfer", placeholder: "Account/Resource ID", logo: "/logos/aws.svg", premium: true },
  { value: "gcp", label: "Google Cloud", transferMethod: "Project ownership transfer", placeholder: "Project ID", logo: "/logos/gcp.svg", premium: true },
  { value: "azure", label: "Azure", transferMethod: "Subscription or resource transfer", placeholder: "Resource URL", logo: "/logos/azure.svg", premium: true },
  { value: "netlify", label: "Netlify", transferMethod: "Team invite or site transfer", placeholder: "Site URL", logo: "/logos/netlify.svg", premium: false },
  { value: "cloudflare", label: "Cloudflare Pages", transferMethod: "Account or project transfer", placeholder: "Project URL", logo: "/logos/cloudflare.svg", premium: true },
  { value: "other", label: "Other", transferMethod: "Manual credential transfer", placeholder: "Provider details", logo: null, premium: false },
];

const domainRegistrars = [
  { value: "namecheap", label: "Namecheap", transferMethod: "Domain push or auth code transfer", placeholder: "domain.com", logo: "/logos/namecheap.svg", premium: false },
  { value: "godaddy", label: "GoDaddy", transferMethod: "Domain transfer with auth code", placeholder: "domain.com", logo: "/logos/godaddy.svg", premium: false },
  { value: "google", label: "Google Domains", transferMethod: "Transfer to another registrar", placeholder: "domain.com", logo: "/logos/google.svg", premium: true },
  { value: "cloudflare", label: "Cloudflare Registrar", transferMethod: "Account transfer or auth code", placeholder: "domain.com", logo: "/logos/cloudflare.svg", premium: true },
  { value: "porkbun", label: "Porkbun", transferMethod: "Push to another account", placeholder: "domain.com", logo: "/logos/porkbun.svg", premium: false },
  { value: "hover", label: "Hover", transferMethod: "Transfer with auth code", placeholder: "domain.com", logo: "/logos/hover.svg", premium: false },
  { value: "name", label: "Name.com", transferMethod: "Push or transfer with auth code", placeholder: "domain.com", logo: "/logos/namecom.svg", premium: false },
  { value: "dynadot", label: "Dynadot", transferMethod: "Account push or transfer", placeholder: "domain.com", logo: "/logos/dynadot.svg", premium: false },
  { value: "gandi", label: "Gandi", transferMethod: "Change of registrant", placeholder: "domain.com", logo: "/logos/gandi.svg", premium: false },
  { value: "other", label: "Other", transferMethod: "Auth code transfer", placeholder: "domain.com", logo: null, premium: false },
];

const databaseProviders = [
  { value: "supabase", label: "Supabase", transferMethod: "Organization transfer or project export", placeholder: "Project URL", logo: "/logos/supabase.svg", premium: true },
  { value: "planetscale", label: "PlanetScale", transferMethod: "Organization transfer", placeholder: "Database URL", logo: "/logos/planetscale.svg", premium: true },
  { value: "neon", label: "Neon", transferMethod: "Project transfer or connection string", placeholder: "Project URL", logo: "/logos/neon.svg", premium: true },
  { value: "mongodb", label: "MongoDB Atlas", transferMethod: "Organization invite or cluster transfer", placeholder: "Cluster URL", logo: "/logos/mongodb.svg", premium: true },
  { value: "firebase", label: "Firebase / Firestore", transferMethod: "Project ownership transfer", placeholder: "Project ID", logo: "/logos/firebase.svg", premium: true },
  { value: "upstash", label: "Upstash", transferMethod: "Team invite or database transfer", placeholder: "Database URL", logo: "/logos/upstash.svg", premium: true },
  { value: "turso", label: "Turso", transferMethod: "Organization transfer", placeholder: "Database URL", logo: "/logos/turso.svg", premium: true },
  { value: "aws-rds", label: "AWS RDS", transferMethod: "Snapshot share or account transfer", placeholder: "Instance identifier", logo: "/logos/aws.svg", premium: true },
  { value: "aws-dynamodb", label: "AWS DynamoDB", transferMethod: "Account transfer or export", placeholder: "Table name", logo: "/logos/aws.svg", premium: true },
  { value: "cockroachdb", label: "CockroachDB", transferMethod: "Organization transfer", placeholder: "Cluster URL", logo: "/logos/cockroachdb.svg", premium: false },
  { value: "redis", label: "Redis Cloud", transferMethod: "Subscription transfer", placeholder: "Database URL", logo: "/logos/redis.svg", premium: false },
  { value: "other", label: "Other", transferMethod: "Credential handoff", placeholder: "Database details", logo: null, premium: false },
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
    categories: [] as string[],
    blockchain: "",
    techStack: [] as string[],
    customTech: "",
    demoUrl: "",
    videoUrl: "",

    // Team (Partners & Collaborators)
    collaborators: [] as Collaborator[],

    // AI Image Generation (disabled for now)
    aiImagePrompt: "",
    generatedImageUrl: "",
    
    // Step 2: Assets Included (all will be required in transfer)
    // Code Repository
    githubRepo: "",
    githubVerified: false,
    githubVerificationError: "",
    repoStats: null as { files: number; lines: number; lastUpdated: string } | null,
    
    // Hosting
    hasHosting: false,
    hostingProvider: "", // Selected provider from dropdown
    hostingProjectUrl: "", // Project URL or identifier

    // Domain
    hasDomain: false,
    domainRegistrar: "", // Selected registrar from dropdown
    domain: "", // The actual domain name

    // Database
    hasDatabase: false,
    databaseProvider: "", // Selected provider from dropdown
    databaseName: "", // Database name or connection identifier
    
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

    // Required Buyer Information (what seller needs from buyer to complete transfer)
    requiredBuyerInfo: {
      github: { required: false, description: "" },
      domain: { required: false, description: "" },
      email: { required: false, description: "" },
      walletAddress: { required: false, description: "" },
      other: { required: false, description: "" },
    } as Record<string, { required: boolean; description: string }>,

    // Step 3: Pricing
    enableAuction: true,
    startingPrice: "",
    duration: "7",
    enableBuyNow: false,
    buyNowPrice: "",
    currency: "APP",

    // Reserve for specific buyer (optional)
    reserveForBuyer: false,
    reservedBuyerWallet: "",

    // NDA Settings
    requiresNDA: false,
    ndaTerms: "",

    // Agreement Settings (seller offers upfront; buyer can request during transfer if not offered)
    offersAPA: false, // Seller offers Asset Purchase Agreement
    offersNonCompete: false, // Seller offers Non-Compete Agreement
    nonCompeteDurationYears: 1 as 1 | 2 | 3,

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

  // Required buyer info helpers
  const updateRequiredBuyerInfo = (field: string, key: "required" | "description", value: boolean | string) => {
    const updated = { ...formData.requiredBuyerInfo };
    updated[field] = { ...updated[field], [key]: value };
    updateFormData("requiredBuyerInfo", updated);
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
      if (formData.categories.length === 0) newErrors.categories = "At least one category is required";
      if (formData.techStack.length === 0) newErrors.techStack = "Add at least one technology";
    }
    
    if (step === 2) {
      // GitHub is optional, but if provided must be verified
      if (formData.githubRepo.trim() && !formData.githubVerified) {
        newErrors.githubRepo = "Please verify your GitHub repository ownership";
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
      if (formData.reserveForBuyer) {
        if (!formData.reservedBuyerWallet.trim()) {
          newErrors.reservedBuyerWallet = "Wallet address is required when reserving";
        } else if (formData.reservedBuyerWallet.length < 32 || formData.reservedBuyerWallet.length > 44) {
          newErrors.reservedBuyerWallet = "Invalid Solana wallet address";
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
      // Scroll to top when moving to next step
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const prevStep = () => {
    setSubmitError(null); // Clear any previous submit errors
    setCurrentStep(prev => Math.max(prev - 1, 1));
    // Scroll to top when moving to previous step
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          categories: formData.categories,
          blockchain: formData.blockchain || null,
          techStack: formData.techStack,
          thumbnailUrl: formData.profileImagePreview || null, // Map profileImagePreview to thumbnailUrl
          demoUrl: formData.demoUrl,
          videoUrl: formData.videoUrl,
          githubRepo: formData.githubRepo,
          // Hosting
          hasHosting: formData.hasHosting,
          hostingProvider: formData.hostingProvider || null,
          hostingProjectUrl: formData.hostingProjectUrl || null,
          // Domain
          hasDomain: formData.hasDomain,
          domainRegistrar: formData.domainRegistrar || null,
          domain: formData.domain || null,
          // Database
          hasDatabase: formData.hasDatabase,
          databaseProvider: formData.databaseProvider || null,
          databaseName: formData.databaseName || null,
          // Social & Other Assets
          hasSocialAccounts: formData.socialAccounts.length > 0,
          socialAccounts: formData.socialAccounts.length > 0 ? JSON.stringify(formData.socialAccounts) : null,
          hasApiKeys: formData.hasApiKeys,
          hasDesignFiles: formData.hasDesignFiles,
          hasDocumentation: formData.hasDocumentation,
          additionalAssets: formData.additionalAssets,
          requiredBuyerInfo: Object.values(formData.requiredBuyerInfo).some(v => v.required)
            ? formData.requiredBuyerInfo
            : null,
          // Pricing
          startingPrice: formData.startingPrice,
          buyNowEnabled: formData.enableBuyNow,
          buyNowPrice: formData.buyNowPrice || null,
          currency: formData.currency,
          duration: formData.duration,
          reservedBuyerWallet: formData.reserveForBuyer ? formData.reservedBuyerWallet : null,
          // Agreements
          requiresNDA: formData.requiresNDA,
          ndaTerms: formData.requiresNDA ? formData.ndaTerms : null,
          offersAPA: formData.offersAPA,
          offersNonCompete: formData.offersNonCompete,
          nonCompeteDurationYears: formData.offersNonCompete ? formData.nonCompeteDurationYears : null,
          // Collaborators - transform for API
          collaborators: formData.collaborators.length > 0
            ? formData.collaborators.map(c => ({
                walletAddress: c.walletAddress,
                userId: c.user?.id || null,
                role: c.role,
                roleDescription: c.roleDescription,
                customRoleDescription: c.customRoleDescription || null,
                percentage: c.percentage,
              }))
            : null,
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
    if (formData.githubRepo && formData.githubVerified) items.push("GitHub Repository");
    if (formData.hasHosting && formData.hostingProvider) {
      const provider = hostingProviders.find(p => p.value === formData.hostingProvider);
      items.push(`Hosting: ${provider?.label || formData.hostingProvider}`);
    }
    if (formData.hasDomain && formData.domainRegistrar) {
      const registrar = domainRegistrars.find(p => p.value === formData.domainRegistrar);
      items.push(`Domain: ${formData.domain || ""} (${registrar?.label || formData.domainRegistrar})`);
    }
    if (formData.hasDatabase && formData.databaseProvider) {
      const provider = databaseProviders.find(p => p.value === formData.databaseProvider);
      items.push(`Database: ${provider?.label || formData.databaseProvider}`);
    }
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
                        Categories <span className="text-red-500">*</span>
                        <span className="text-zinc-400 font-normal ml-2">(select all that apply)</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {categories.map((cat) => {
                          const isSelected = formData.categories.includes(cat.value);
                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => {
                                const newCategories = isSelected
                                  ? formData.categories.filter((c) => c !== cat.value)
                                  : [...formData.categories, cat.value];
                                updateFormData("categories", newCategories);
                              }}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                              }`}
                            >
                              <span className="text-xl mb-1 block">{cat.icon}</span>
                              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {errors.categories && <p className="mt-1 text-sm text-red-500">{errors.categories}</p>}
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

                {/* Team Section - Partners & Collaborators */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Team</h2>
                  <p className="text-zinc-500 mb-6">Add partners or collaborators who will share in the sale revenue</p>

                  <CollaboratorInput
                    collaborators={formData.collaborators}
                    onChange={(collaborators) => updateFormData("collaborators", collaborators)}
                    ownerPercentage={100 - formData.collaborators.reduce((sum, c) => sum + c.percentage, 0)}
                    disabled={false}
                  />

                  {formData.collaborators.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Collaborators must accept your invite before the listing can go live.
                      </p>
                    </div>
                  )}
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

                {/* Repository Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Repository</h2>
                  <p className="text-zinc-500 mb-4">Source code and version control access</p>

                  {/* Required notice */}
                  <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Required:</strong> You must include a verified GitHub Repository.
                    </p>
                  </div>

                  {errors.assets && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.assets}</p>
                    </div>
                  )}

                  <div className="space-y-6">
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
                  <p className="text-zinc-500 mb-6">Hosting, domain, and database access</p>

                  <div className="space-y-4">
                    {/* Hosting */}
                    <div className={`p-4 rounded-xl border transition-all ${formData.hostingProvider ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-5 h-5 text-zinc-600" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">Hosting</span>
                      </div>
                      <ProviderDropdown
                        options={hostingProviders}
                        value={formData.hostingProvider}
                        onChange={(value) => {
                          updateFormData("hostingProvider", value);
                          updateFormData("hostingProjectUrl", "");
                          updateFormData("hasHosting", !!value);
                        }}
                        placeholder="Select hosting provider..."
                      />
                      {formData.hostingProvider && (
                        <div className="mt-3 space-y-3">
                          <input
                            type="text"
                            value={formData.hostingProjectUrl}
                            onChange={(e) => updateFormData("hostingProjectUrl", e.target.value)}
                            placeholder={hostingProviders.find(p => p.value === formData.hostingProvider)?.placeholder || "Project URL or identifier"}
                            className="input-field"
                          />
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                            <Info className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-zinc-500">
                              Transfer method: {hostingProviders.find(p => p.value === formData.hostingProvider)?.transferMethod}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Domain */}
                    <div className={`p-4 rounded-xl border transition-all ${formData.domainRegistrar ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-5 h-5 text-zinc-600" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">Domain Name</span>
                      </div>
                      <ProviderDropdown
                        options={domainRegistrars}
                        value={formData.domainRegistrar}
                        onChange={(value) => {
                          updateFormData("domainRegistrar", value);
                          updateFormData("domain", "");
                          updateFormData("hasDomain", !!value);
                        }}
                        placeholder="Select registrar..."
                      />
                      {formData.domainRegistrar && (
                        <div className="mt-3 space-y-3">
                          <input
                            type="text"
                            value={formData.domain}
                            onChange={(e) => updateFormData("domain", e.target.value)}
                            placeholder={domainRegistrars.find(p => p.value === formData.domainRegistrar)?.placeholder || "domain.com"}
                            className="input-field"
                          />
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                            <Info className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-zinc-500">
                              Transfer method: {domainRegistrars.find(p => p.value === formData.domainRegistrar)?.transferMethod}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Database */}
                    <div className={`p-4 rounded-xl border transition-all ${formData.databaseProvider ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Database className="w-5 h-5 text-zinc-600" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">Database</span>
                      </div>
                      <ProviderDropdown
                        options={databaseProviders}
                        value={formData.databaseProvider}
                        onChange={(value) => {
                          updateFormData("databaseProvider", value);
                          updateFormData("databaseName", "");
                          updateFormData("hasDatabase", !!value);
                        }}
                        placeholder="Select database provider..."
                      />
                      {formData.databaseProvider && (
                        <div className="mt-3 space-y-3">
                          <input
                            type="text"
                            value={formData.databaseName}
                            onChange={(e) => updateFormData("databaseName", e.target.value)}
                            placeholder={databaseProviders.find(p => p.value === formData.databaseProvider)?.placeholder || "Database name or URL"}
                            className="input-field"
                          />
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                            <Info className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-zinc-500">
                              Transfer method: {databaseProviders.find(p => p.value === formData.databaseProvider)?.transferMethod}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* API Keys */}
                    <div className={`p-4 rounded-xl border transition-all ${formData.hasApiKeys ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.hasApiKeys} onChange={(e) => updateFormData("hasApiKeys", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">API Keys & Credentials</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Third-party service API keys</p>
                        </div>
                      </label>
                      {formData.hasApiKeys && (
                        <div className="mt-4 ml-8">
                          <textarea
                            value={formData.apiKeysDescription}
                            onChange={(e) => updateFormData("apiKeysDescription", e.target.value)}
                            placeholder="List the API keys included (e.g., OpenAI, Stripe, Twilio, SendGrid...)"
                            rows={2}
                            className="input-field resize-none"
                          />
                        </div>
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

                {/* Required Buyer Information Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Required Buyer Information</h2>
                      <p className="text-zinc-500 text-sm mt-1">What information do you need from the buyer to complete the transfer?</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mb-6">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-700 dark:text-blue-400">
                        <p className="font-medium mb-1">How it works:</p>
                        <ul className="list-disc ml-4 space-y-1 text-blue-600 dark:text-blue-500">
                          <li>After purchase, buyers have <strong>48 hours</strong> to provide the information you request</li>
                          <li>You&apos;ll be notified when they submit their info</li>
                          <li>If they miss the deadline, a fallback transfer process begins</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* GitHub Username - shown if github repo is included */}
                    {(formData.githubRepo && formData.githubVerified) && (
                      <div className={`p-4 rounded-xl border ${formData.requiredBuyerInfo.github?.required ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.requiredBuyerInfo.github?.required || false}
                            onChange={(e) => updateRequiredBuyerInfo("github", "required", e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Github className="w-5 h-5 text-zinc-600" />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">GitHub Username</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Recommended</span>
                            </div>
                            <p className="text-sm text-zinc-500 mt-1">Buyer&apos;s GitHub username for repository transfer</p>
                          </div>
                        </label>
                        {formData.requiredBuyerInfo.github?.required && (
                          <input
                            type="text"
                            value={formData.requiredBuyerInfo.github?.description || ""}
                            onChange={(e) => updateRequiredBuyerInfo("github", "description", e.target.value)}
                            placeholder="Instructions for the buyer (optional)"
                            className="input-field mt-3 ml-8"
                          />
                        )}
                      </div>
                    )}

                    {/* Domain Transfer Info - shown if domain is included */}
                    {formData.hasDomain && (
                      <div className={`p-4 rounded-xl border ${formData.requiredBuyerInfo.domain?.required ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.requiredBuyerInfo.domain?.required || false}
                            onChange={(e) => updateRequiredBuyerInfo("domain", "required", e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Globe className="w-5 h-5 text-zinc-600" />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">Domain Registrar Info</span>
                            </div>
                            <p className="text-sm text-zinc-500 mt-1">Buyer&apos;s registrar account or email for domain push</p>
                          </div>
                        </label>
                        {formData.requiredBuyerInfo.domain?.required && (
                          <input
                            type="text"
                            value={formData.requiredBuyerInfo.domain?.description || ""}
                            onChange={(e) => updateRequiredBuyerInfo("domain", "description", e.target.value)}
                            placeholder="e.g., 'I'll push from GoDaddy - need your GoDaddy email'"
                            className="input-field mt-3 ml-8"
                          />
                        )}
                      </div>
                    )}

                    {/* Email Address - always available */}
                    <div className={`p-4 rounded-xl border ${formData.requiredBuyerInfo.email?.required ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.requiredBuyerInfo.email?.required || false}
                          onChange={(e) => updateRequiredBuyerInfo("email", "required", e.target.checked)}
                          className="w-5 h-5 mt-0.5 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AtSign className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Email Address</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">For sending credentials or transfer instructions</p>
                        </div>
                      </label>
                      {formData.requiredBuyerInfo.email?.required && (
                        <input
                          type="text"
                          value={formData.requiredBuyerInfo.email?.description || ""}
                          onChange={(e) => updateRequiredBuyerInfo("email", "description", e.target.value)}
                          placeholder="What will you send to this email?"
                          className="input-field mt-3 ml-8"
                        />
                      )}
                    </div>

                    {/* Wallet Address - shown if crypto/web3 related */}
                    {(formData.blockchain || formData.categories.includes("CRYPTO_WEB3")) && (
                      <div className={`p-4 rounded-xl border ${formData.requiredBuyerInfo.walletAddress?.required ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.requiredBuyerInfo.walletAddress?.required || false}
                            onChange={(e) => updateRequiredBuyerInfo("walletAddress", "required", e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-5 h-5 text-zinc-600" />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">Wallet Address</span>
                            </div>
                            <p className="text-sm text-zinc-500 mt-1">For transferring on-chain assets or admin rights</p>
                          </div>
                        </label>
                        {formData.requiredBuyerInfo.walletAddress?.required && (
                          <input
                            type="text"
                            value={formData.requiredBuyerInfo.walletAddress?.description || ""}
                            onChange={(e) => updateRequiredBuyerInfo("walletAddress", "description", e.target.value)}
                            placeholder="Which chain/network? What will you transfer?"
                            className="input-field mt-3 ml-8"
                          />
                        )}
                      </div>
                    )}

                    {/* Other - always available */}
                    <div className={`p-4 rounded-xl border ${formData.requiredBuyerInfo.other?.required ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.requiredBuyerInfo.other?.required || false}
                          onChange={(e) => updateRequiredBuyerInfo("other", "required", e.target.checked)}
                          className="w-5 h-5 mt-0.5 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-zinc-600" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Other Information</span>
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">Any other info you need to complete the transfer</p>
                        </div>
                      </label>
                      {formData.requiredBuyerInfo.other?.required && (
                        <textarea
                          value={formData.requiredBuyerInfo.other?.description || ""}
                          onChange={(e) => updateRequiredBuyerInfo("other", "description", e.target.value)}
                          placeholder="Describe what information you need and why"
                          rows={2}
                          className="input-field mt-3 ml-8 resize-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* No requirements selected info */}
                  {!Object.values(formData.requiredBuyerInfo).some(v => v.required) && (
                    <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                      <p className="text-sm text-zinc-500 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        No required info selected. The fallback transfer process will be used automatically.
                      </p>
                    </div>
                  )}
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
                          { value: "APP", label: "$APP", icon: "✅", description: "Platform Token", fee: "3%" },
                          { value: "SOL", label: "SOL", icon: "◎", description: "Native Solana", fee: "5%" },
                          { value: "USDC", label: "USDC", icon: "💵", description: "Stablecoin", fee: "5%" },
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
                            <span className={`text-xs font-medium block mt-1 ${currency.value === "APP" ? "text-green-600 dark:text-green-400" : "text-zinc-500"}`}>
                              {currency.fee} fee{currency.value === "APP" && " (save 2%)"}
                            </span>
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
                        <div className="grid md:grid-cols-2 gap-4 ml-8 max-w-lg">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Starting Price ({formData.currency})</label>
                            <input type="number" value={formData.startingPrice} onChange={(e) => updateFormData("startingPrice", e.target.value)} placeholder="0.00" step="0.01" className={`input-field ${errors.startingPrice ? "border-red-500" : ""}`} />
                            {errors.startingPrice && <p className="mt-1 text-sm text-red-500">{errors.startingPrice}</p>}
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
                        <div className="ml-8 grid md:grid-cols-2 gap-4 max-w-lg">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Buy Now Price ({formData.currency})</label>
                            <input type="number" value={formData.buyNowPrice} onChange={(e) => updateFormData("buyNowPrice", e.target.value)} placeholder="0.00" step="0.01" className={`input-field ${errors.buyNowPrice ? "border-red-500" : ""}`} />
                            {errors.buyNowPrice && <p className="mt-1 text-sm text-red-500">{errors.buyNowPrice}</p>}
                          </div>
                          {!formData.enableAuction && (
                            <div>
                              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Listing Duration</label>
                              <select value={formData.duration} onChange={(e) => updateFormData("duration", e.target.value)} className="input-field">
                                <option value="1">1 day</option>
                                <option value="3">3 days</option>
                                <option value="5">5 days</option>
                                <option value="7">7 days</option>
                                <option value="14">14 days</option>
                                <option value="30">30 days</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reserve for Buyer */}
                    <div className={`p-6 rounded-xl border ${formData.reserveForBuyer ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <label className="flex items-start gap-3 cursor-pointer mb-4">
                        <input type="checkbox" checked={formData.reserveForBuyer} onChange={(e) => updateFormData("reserveForBuyer", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                        <div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            Reserve for Specific Buyer
                          </span>
                          <p className="text-sm text-zinc-500">Only this wallet can purchase your listing</p>
                        </div>
                      </label>

                      {formData.reserveForBuyer && (
                        <div className="ml-8">
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Buyer&apos;s Wallet Address</label>
                          <input
                            type="text"
                            value={formData.reservedBuyerWallet}
                            onChange={(e) => updateFormData("reservedBuyerWallet", e.target.value)}
                            placeholder="Enter Solana wallet address..."
                            className={`input-field font-mono text-sm ${errors.reservedBuyerWallet ? "border-red-500" : ""}`}
                          />
                          {errors.reservedBuyerWallet && <p className="mt-1 text-sm text-red-500">{errors.reservedBuyerWallet}</p>}
                          <p className="mt-2 text-xs text-zinc-500">
                            <Info className="w-3 h-3 inline mr-1" />
                            The listing will be marked as reserved and only visible to this buyer. You can remove the reservation later from the listing edit page.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Legal Agreements Section */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Legal Agreements</h3>
                      <p className="text-sm text-zinc-500 mb-4">Configure which agreements buyers must sign at time of purchase</p>

                      <div className="space-y-4">
                        {/* NDA Requirement */}
                        <div className={`p-4 rounded-xl border transition-all ${formData.requiresNDA ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={formData.requiresNDA} onChange={(e) => updateFormData("requiresNDA", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                            <div className="flex-1">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Non-Disclosure Agreement (NDA)
                              </span>
                              <p className="text-sm text-zinc-500 mt-1">Buyers must sign an NDA before viewing full listing details</p>
                            </div>
                          </label>
                          {formData.requiresNDA && (
                            <div className="mt-4 ml-8 space-y-3">
                              <textarea
                                value={formData.ndaTerms}
                                onChange={(e) => updateFormData("ndaTerms", e.target.value)}
                                placeholder="Add custom NDA terms, or leave blank to use our standard NDA template..."
                                rows={3}
                                className="input-field resize-none text-sm"
                              />
                              <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-100/50 dark:bg-purple-900/30">
                                <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-purple-700 dark:text-purple-400">
                                  Buyers will see a blurred preview until they sign. NDA is wallet-signed for legal validity.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Asset Purchase Agreement */}
                        <div className={`p-4 rounded-xl border transition-all ${formData.offersAPA ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={formData.offersAPA} onChange={(e) => updateFormData("offersAPA", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                            <div className="flex-1">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Offer Asset Purchase Agreement (APA)
                              </span>
                              <p className="text-sm text-zinc-500 mt-1">Offer to sign an APA covering transfer of ownership, IP rights, and warranties</p>
                            </div>
                          </label>
                          {formData.offersAPA && (
                            <div className="mt-4 ml-8">
                              <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
                                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                  Both parties sign at purchase. Buyers can also request this during transfer if you don't offer it here.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Non-Compete Agreement */}
                        <div className={`p-4 rounded-xl border transition-all ${formData.offersNonCompete ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={formData.offersNonCompete} onChange={(e) => updateFormData("offersNonCompete", e.target.checked)} className="w-5 h-5 mt-0.5 rounded" />
                            <div className="flex-1">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Offer Non-Compete Agreement
                              </span>
                              <p className="text-sm text-zinc-500 mt-1">Offer to sign a non-compete, agreeing not to build competing products</p>
                            </div>
                          </label>
                          {formData.offersNonCompete && (
                            <div className="mt-4 ml-8 space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Non-Compete Duration</label>
                                <div className="flex gap-2">
                                  {[1, 2, 3].map((years) => (
                                    <button
                                      key={years}
                                      type="button"
                                      onClick={() => updateFormData("nonCompeteDurationYears", years)}
                                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                                        formData.nonCompeteDurationYears === years
                                          ? "border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                                      }`}
                                    >
                                      {years} Year{years > 1 ? "s" : ""}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/30">
                                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  You commit to not creating competing products for {formData.nonCompeteDurationYears} year{formData.nonCompeteDurationYears > 1 ? "s" : ""}. Buyers can also request this during transfer.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fee Info */}
                    <div className={`p-4 rounded-xl ${formData.currency === "APP" ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <strong>Platform Fee:</strong>{" "}
                        {formData.currency === "APP" ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">3% of final sale price (2% discount for $APP)</span>
                        ) : (
                          <span>5% of final sale price</span>
                        )}
                      </p>
                      {formData.currency !== "APP" && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Tip: List in $APP to pay only 3% in fees
                        </p>
                      )}
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
                        <p className="text-sm text-zinc-500 mt-1">{formData.categories.length > 0 ? formData.categories.map(c => categories.find(cat => cat.value === c)?.label).filter(Boolean).join(", ") : "No categories"}</p>
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

                    {/* Reserved for Buyer */}
                    {formData.reserveForBuyer && formData.reservedBuyerWallet && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Reserved for Specific Buyer
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Only wallet <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">{formData.reservedBuyerWallet.slice(0, 8)}...{formData.reservedBuyerWallet.slice(-6)}</code> can purchase this listing.
                        </p>
                      </div>
                    )}

                    {/* Legal Agreements Summary */}
                    {(formData.requiresNDA || formData.offersAPA || formData.offersNonCompete) && (
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                        <h4 className="font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Legal Agreements
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {formData.requiresNDA && (
                            <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium">
                              NDA Required (before viewing)
                            </span>
                          )}
                          {formData.offersAPA && (
                            <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium">
                              Offering APA
                            </span>
                          )}
                          {formData.offersNonCompete && (
                            <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium">
                              Offering Non-Compete ({formData.nonCompeteDurationYears}yr)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                          {formData.requiresNDA ? "Buyers sign NDA before viewing details. " : ""}
                          {(formData.offersAPA || formData.offersNonCompete) ? "Offered agreements signed at purchase." : ""}
                        </p>
                      </div>
                    )}

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

                    {/* Required Buyer Information */}
                    {Object.values(formData.requiredBuyerInfo).some(v => v.required) && (
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                        <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Required Buyer Information
                        </h4>
                        <p className="text-sm text-purple-600 dark:text-purple-500 mb-2">
                          Buyers have 48 hours after purchase to provide:
                        </p>
                        <div className="space-y-2">
                          {formData.requiredBuyerInfo.github?.required && (
                            <div className="flex items-center gap-2 text-sm">
                              <Github className="w-4 h-4 text-purple-600" />
                              <span className="text-zinc-700 dark:text-zinc-300">GitHub Username</span>
                              {formData.requiredBuyerInfo.github.description && (
                                <span className="text-zinc-500">- {formData.requiredBuyerInfo.github.description}</span>
                              )}
                            </div>
                          )}
                          {formData.requiredBuyerInfo.domain?.required && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="w-4 h-4 text-purple-600" />
                              <span className="text-zinc-700 dark:text-zinc-300">Domain Registrar Info</span>
                              {formData.requiredBuyerInfo.domain.description && (
                                <span className="text-zinc-500">- {formData.requiredBuyerInfo.domain.description}</span>
                              )}
                            </div>
                          )}
                          {formData.requiredBuyerInfo.email?.required && (
                            <div className="flex items-center gap-2 text-sm">
                              <AtSign className="w-4 h-4 text-purple-600" />
                              <span className="text-zinc-700 dark:text-zinc-300">Email Address</span>
                              {formData.requiredBuyerInfo.email.description && (
                                <span className="text-zinc-500">- {formData.requiredBuyerInfo.email.description}</span>
                              )}
                            </div>
                          )}
                          {formData.requiredBuyerInfo.walletAddress?.required && (
                            <div className="flex items-center gap-2 text-sm">
                              <Wallet className="w-4 h-4 text-purple-600" />
                              <span className="text-zinc-700 dark:text-zinc-300">Wallet Address</span>
                              {formData.requiredBuyerInfo.walletAddress.description && (
                                <span className="text-zinc-500">- {formData.requiredBuyerInfo.walletAddress.description}</span>
                              )}
                            </div>
                          )}
                          {formData.requiredBuyerInfo.other?.required && (
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="w-4 h-4 text-purple-600" />
                              <span className="text-zinc-700 dark:text-zinc-300">Other</span>
                              {formData.requiredBuyerInfo.other.description && (
                                <span className="text-zinc-500">- {formData.requiredBuyerInfo.other.description}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
