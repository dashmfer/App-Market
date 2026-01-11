"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Presentation,
  Sparkles,
  Lock,
  Code,
} from "lucide-react";

const steps = [
  { id: 1, name: "Basics", description: "Project info" },
  { id: 2, name: "Assets", description: "What's included" },
  { id: 3, name: "Media", description: "Screenshots & links" },
  { id: 4, name: "Documents", description: "Files & resources" },
  { id: 5, name: "Pricing", description: "Sale settings" },
  { id: 6, name: "Review", description: "Final check" },
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
  { value: "OTHER", label: "Other", icon: "📦" },
];

const popularTechStack = [
  "Next.js", "React", "Vue", "Angular", "Svelte",
  "Node.js", "Python", "Go", "Rust", "TypeScript",
  "PostgreSQL", "MongoDB", "Redis", "Supabase", "Firebase",
  "Tailwind", "OpenAI", "Stripe", "AWS", "Vercel",
  "Solana", "Ethereum", "Anchor", "Hardhat", "Foundry",
];

export default function CreateListingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    tagline: "",
    description: "",
    category: "",
    techStack: [] as string[],
    customTech: "",
    githubRepo: "",
    githubIsPrivate: true,
    hasDomain: false,
    domain: "",
    hasDatabase: false,
    databaseType: "",
    hasHosting: false,
    hostingProvider: "",
    hasSocialAccounts: false,
    socialAccountsList: "",
    hasApiKeys: false,
    hasDesignFiles: false,
    hasDocumentation: false,
    hasSmartContract: false,
    smartContractType: "",
    smartContractProgramId: "",
    hasBrandAssets: false,
    brandAssetsList: "",
    additionalAssets: "",
    screenshots: [] as File[],
    useAiImage: false,
    aiImagePrompt: "",
    generatedImageUrl: "",
    demoUrl: "",
    videoUrl: "",
    links: [{ label: "", url: "", isTransferable: false }] as { label: string; url: string; isTransferable: boolean }[],
    hasAiConversations: false,
    aiConversationPlatform: "",
    hasPitchDeck: false,
    hasMarketingPlan: false,
    otherDocuments: [] as { description: string }[],
    listingType: "AUCTION" as "AUCTION" | "BUY_NOW",
    startingPrice: "",
    reservePrice: "",
    buyNowEnabled: false,
    buyNowPrice: "",
    duration: "7",
    currency: "SOL",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const addTechStack = (tech: string) => {
    if (!formData.techStack.includes(tech)) {
      updateFormData("techStack", [...formData.techStack, tech]);
    }
  };

  const removeTechStack = (tech: string) => {
    updateFormData("techStack", formData.techStack.filter(t => t !== tech));
  };

  const addLink = () => {
    updateFormData("links", [...formData.links, { label: "", url: "", isTransferable: false }]);
  };

  const updateLink = (index: number, field: string, value: any) => {
    const newLinks = [...formData.links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    updateFormData("links", newLinks);
  };

  const removeLink = (index: number) => {
    updateFormData("links", formData.links.filter((_, i) => i !== index));
  };

  const addOtherDocument = () => {
    updateFormData("otherDocuments", [...formData.otherDocuments, { description: "" }]);
  };

  const handleGenerateAiImage = async () => {
    if (!formData.title && !formData.aiImagePrompt) return;
    setIsGeneratingImage(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateFormData("generatedImageUrl", "/placeholder-generated.png");
    } finally {
      setIsGeneratingImage(false);
    }
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
      if (!formData.githubRepo.trim()) newErrors.githubRepo = "GitHub repository is required";
      if (formData.category === "CRYPTO_WEB3" && formData.hasSmartContract && !formData.smartContractType) {
        newErrors.smartContractType = "Select smart contract type";
      }
      if (formData.hasBrandAssets && !formData.brandAssetsList.trim()) {
        newErrors.brandAssetsList = "List the brand assets included";
      }
    }
    if (step === 5) {
      if (formData.listingType === "AUCTION") {
        if (!formData.startingPrice) newErrors.startingPrice = "Starting price is required";
        if (Number(formData.startingPrice) <= 0) newErrors.startingPrice = "Price must be greater than 0";
        if (formData.buyNowEnabled && !formData.buyNowPrice) newErrors.buyNowPrice = "Buy now price is required";
        if (formData.buyNowEnabled && Number(formData.buyNowPrice) <= Number(formData.startingPrice)) {
          newErrors.buyNowPrice = "Buy now price must be higher than starting price";
        }
      } else {
        if (!formData.buyNowPrice) newErrors.buyNowPrice = "Price is required";
        if (Number(formData.buyNowPrice) <= 0) newErrors.buyNowPrice = "Price must be greater than 0";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) setCurrentStep(prev => Math.min(prev + 1, steps.length));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      router.push("/dashboard/listings");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="container-wide py-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-900 dark:text-zinc-100">List Your Project</h1>
              <p className="text-sm text-zinc-500">Create a new listing to sell your project</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <div className="container-wide py-4">
          <div className="flex items-center justify-between min-w-max">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                    currentStep > step.id ? "bg-green-500 text-white" : currentStep === step.id ? "bg-black dark:bg-white text-white dark:text-black" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                  }`}>
                    {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                  </div>
                  <div className="hidden sm:block">
                    <div className={`text-sm font-medium ${currentStep >= step.id ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>{step.name}</div>
                    <div className="text-xs text-zinc-500">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && <div className={`w-8 lg:w-16 h-px mx-2 lg:mx-4 ${currentStep > step.id ? "bg-green-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container-tight py-8">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            
            {currentStep === 1 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Basic Information</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Project Title *</label>
                    <input type="text" value={formData.title} onChange={(e) => updateFormData("title", e.target.value)} placeholder="e.g., AI Recipe Generator" className={`input-field ${errors.title ? "ring-2 ring-red-500" : ""}`} />
                    {errors.title && <p className="mt-1 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.title}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tagline</label>
                    <input type="text" value={formData.tagline} onChange={(e) => updateFormData("tagline", e.target.value)} placeholder="A short, catchy description" className="input-field" maxLength={100} />
                    <p className="mt-1 text-sm text-zinc-500">{formData.tagline.length}/100 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description *</label>
                    <textarea value={formData.description} onChange={(e) => updateFormData("description", e.target.value)} placeholder="Describe your project in detail..." rows={8} className={`input-field resize-none ${errors.description ? "ring-2 ring-red-500" : ""}`} />
                    {errors.description && <p className="mt-1 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.description}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Category *</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {categories.map((cat) => (
                        <button key={cat.value} type="button" onClick={() => updateFormData("category", cat.value)} className={`p-3 rounded-xl border text-left transition-all ${formData.category === cat.value ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"}`}>
                          <div className="text-2xl mb-1">{cat.icon}</div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{cat.label}</div>
                        </button>
                      ))}
                    </div>
                    {errors.category && <p className="mt-2 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.category}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tech Stack *</label>
                    {formData.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {formData.techStack.map((tech) => (
                          <span key={tech} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium">
                            {tech}<button type="button" onClick={() => removeTechStack(tech)}><X className="w-4 h-4" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {popularTechStack.filter((tech) => !formData.techStack.includes(tech)).slice(0, 15).map((tech) => (
                        <button key={tech} type="button" onClick={() => addTechStack(tech)} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700">+ {tech}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={formData.customTech} onChange={(e) => updateFormData("customTech", e.target.value)} placeholder="Add custom technology" className="input-field flex-1" onKeyDown={(e) => { if (e.key === "Enter" && formData.customTech.trim()) { e.preventDefault(); addTechStack(formData.customTech.trim()); updateFormData("customTech", ""); }}} />
                      <button type="button" onClick={() => { if (formData.customTech.trim()) { addTechStack(formData.customTech.trim()); updateFormData("customTech", ""); }}} className="btn-secondary"><Plus className="w-4 h-4" />Add</button>
                    </div>
                    {errors.techStack && <p className="mt-2 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.techStack}</p>}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Assets Included</h2>
                <p className="text-zinc-500 mb-6">Select all assets that will be transferred to the buyer</p>
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><Github className="w-5 h-5 text-green-600" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2"><span className="font-medium text-zinc-900 dark:text-zinc-100">GitHub Repository</span><span className="px-2 py-0.5 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-full">Required</span></div>
                        <input type="text" value={formData.githubRepo} onChange={(e) => updateFormData("githubRepo", e.target.value)} placeholder="github.com/username/repo" className={`input-field ${errors.githubRepo ? "ring-2 ring-red-500" : ""}`} />
                        {errors.githubRepo && <p className="mt-1 text-sm text-red-500">{errors.githubRepo}</p>}
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-start gap-2"><Lock className="w-4 h-4 text-yellow-600 mt-0.5" /><div className="text-sm"><p className="font-medium text-yellow-800 dark:text-yellow-200">Keep your repository private!</p><p className="text-yellow-700 dark:text-yellow-300 mt-1">We verify ownership via GitHub OAuth. Code stays private until sale completes. Buyers see verification only (file count, last updated).</p></div></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.category === "CRYPTO_WEB3" && (
                    <div className={`p-4 rounded-xl border ${formData.hasSmartContract ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.hasSmartContract ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}><Code className="w-5 h-5" /></div>
                        <div className="flex-1">
                          <label className="flex items-center justify-between cursor-pointer">
                            <div><span className="font-medium text-zinc-900 dark:text-zinc-100">Smart Contract</span><p className="text-sm text-zinc-500">Does this include a deployed smart contract?</p></div>
                            <input type="checkbox" checked={formData.hasSmartContract} onChange={(e) => updateFormData("hasSmartContract", e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" />
                          </label>
                          {formData.hasSmartContract && (
                            <div className="mt-4 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Blockchain *</label>
                                <div className="flex gap-2">
                                  {[{ value: "solana", label: "Solana" }, { value: "ethereum", label: "Ethereum/EVM" }, { value: "other", label: "Other" }].map((opt) => (
                                    <button key={opt.value} type="button" onClick={() => updateFormData("smartContractType", opt.value)} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium ${formData.smartContractType === opt.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700" : "border-zinc-200 dark:border-zinc-700"}`}>{opt.label}</button>
                                  ))}
                                </div>
                                {errors.smartContractType && <p className="mt-1 text-sm text-red-500">{errors.smartContractType}</p>}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Program/Contract ID (if deployed)</label>
                                <input type="text" value={formData.smartContractProgramId} onChange={(e) => updateFormData("smartContractProgramId", e.target.value)} placeholder="Program ID or contract address" className="input-field" />
                                <p className="mt-1 text-sm text-zinc-500">We'll verify this exists on-chain</p>
                              </div>
                              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><p className="text-sm text-purple-800 dark:text-purple-200"><strong>Transfer Required:</strong> Smart contract admin keys must be transferred to buyer.</p></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {[
                    { key: "hasDomain", label: "Domain Name", icon: Globe, inputKey: "domain", inputPlaceholder: "example.com" },
                    { key: "hasDatabase", label: "Database", icon: Database, inputKey: "databaseType", inputPlaceholder: "e.g., PostgreSQL on Supabase" },
                  ].map(({ key, label, icon: Icon, inputKey, inputPlaceholder }) => (
                    <div key={key} className={`p-4 rounded-xl border ${formData[key as keyof typeof formData] ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData[key as keyof typeof formData] ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}><Icon className="w-5 h-5" /></div>
                        <div className="flex-1">
                          <label className="flex items-center justify-between cursor-pointer"><span className="font-medium text-zinc-900 dark:text-zinc-100">{label}</span><input type="checkbox" checked={formData[key as keyof typeof formData] as boolean} onChange={(e) => updateFormData(key, e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" /></label>
                          {formData[key as keyof typeof formData] && <input type="text" value={formData[inputKey as keyof typeof formData] as string} onChange={(e) => updateFormData(inputKey, e.target.value)} placeholder={inputPlaceholder} className="input-field mt-3" />}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className={`p-4 rounded-xl border ${formData.hasBrandAssets ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.hasBrandAssets ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}><Palette className="w-5 h-5" /></div>
                      <div className="flex-1">
                        <label className="flex items-center justify-between cursor-pointer"><div><span className="font-medium text-zinc-900 dark:text-zinc-100">Brand Assets</span><p className="text-sm text-zinc-500">Logos, icons, color schemes, etc.</p></div><input type="checkbox" checked={formData.hasBrandAssets} onChange={(e) => updateFormData("hasBrandAssets", e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" /></label>
                        {formData.hasBrandAssets && <div className="mt-3"><textarea value={formData.brandAssetsList} onChange={(e) => updateFormData("brandAssetsList", e.target.value)} placeholder="List brand assets included..." rows={3} className={`input-field resize-none ${errors.brandAssetsList ? "ring-2 ring-red-500" : ""}`} />{errors.brandAssetsList && <p className="mt-1 text-sm text-red-500">{errors.brandAssetsList}</p>}<p className="mt-1 text-sm text-zinc-500">Required - will be part of transfer checklist</p></div>}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { key: "hasHosting", label: "Hosting Account", icon: Globe },
                      { key: "hasApiKeys", label: "API Keys & Credentials", icon: Key },
                      { key: "hasDesignFiles", label: "Design Files (Figma)", icon: Palette },
                      { key: "hasDocumentation", label: "Documentation", icon: FileText },
                      { key: "hasSocialAccounts", label: "Social Media Accounts", icon: MessageSquare },
                    ].map(({ key, label, icon: Icon }) => (
                      <label key={key} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${formData[key as keyof typeof formData] ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData[key as keyof typeof formData] ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}><Icon className="w-5 h-5" /></div>
                        <span className="flex-1 font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
                        <input type="checkbox" checked={formData[key as keyof typeof formData] as boolean} onChange={(e) => updateFormData(key, e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" />
                      </label>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Additional Assets (Optional)</label>
                    <textarea value={formData.additionalAssets} onChange={(e) => updateFormData("additionalAssets", e.target.value)} placeholder="List any other assets..." rows={3} className="input-field resize-none" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Media & Screenshots</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Screenshots (Optional)</label>
                      <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 text-center hover:border-green-500 cursor-pointer"><Upload className="w-10 h-10 text-zinc-400 mx-auto mb-3" /><p className="text-zinc-600 dark:text-zinc-400 mb-1">Drag and drop or click to upload</p><p className="text-sm text-zinc-500">PNG, JPG up to 5MB (max 10)</p></div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Sparkles className="w-5 h-5 text-purple-600" /></div>
                        <div className="flex-1">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">Generate with AI</div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">No screenshots? Let AI create a cover image.</p>
                          <div className="flex gap-2">
                            <input type="text" value={formData.aiImagePrompt} onChange={(e) => updateFormData("aiImagePrompt", e.target.value)} placeholder={formData.title ? `Image for "${formData.title}"` : "Describe your image..."} className="input-field flex-1" />
                            <button type="button" onClick={handleGenerateAiImage} disabled={isGeneratingImage} className="btn-primary whitespace-nowrap">{isGeneratingImage ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Generate</>}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Demo URL (Optional)</label><input type="url" value={formData.demoUrl} onChange={(e) => updateFormData("demoUrl", e.target.value)} placeholder="https://your-demo.com" className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Video URL (Optional)</label><input type="url" value={formData.videoUrl} onChange={(e) => updateFormData("videoUrl", e.target.value)} placeholder="https://youtube.com/watch?v=..." className="input-field" /></div>
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Project Links</h2>
                  <p className="text-zinc-500 mb-6">Add links to MVPs, test sites, socials, etc.</p>
                  <div className="space-y-4">
                    {formData.links.map((link, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                        <LinkIcon className="w-5 h-5 text-zinc-400 mt-2" />
                        <div className="flex-1 space-y-3">
                          <div className="grid md:grid-cols-2 gap-3">
                            <input type="text" value={link.label} onChange={(e) => updateLink(index, "label", e.target.value)} placeholder="Label (e.g., MVP, Twitter)" className="input-field" />
                            <input type="url" value={link.url} onChange={(e) => updateLink(index, "url", e.target.value)} placeholder="https://..." className="input-field" />
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={link.isTransferable} onChange={(e) => updateLink(index, "isTransferable", e.target.checked)} className="w-4 h-4 rounded border-zinc-300 text-green-500" /><span className="text-sm text-zinc-600 dark:text-zinc-400">This will be transferred to buyer</span></label>
                        </div>
                        {formData.links.length > 1 && <button type="button" onClick={() => removeLink(index)} className="p-2 text-zinc-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
                      </div>
                    ))}
                    <button type="button" onClick={addLink} className="w-full py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 hover:border-green-500 hover:text-green-600 flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Add Another Link</button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-8">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">AI Conversations</h2>
                  <p className="text-zinc-500 mb-6">Include AI chat exports to show development context</p>
                  <div className={`p-4 rounded-xl border ${formData.hasAiConversations ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                    <label className="flex items-center justify-between cursor-pointer mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.hasAiConversations ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}><MessageSquare className="w-5 h-5" /></div>
                        <div><span className="font-medium text-zinc-900 dark:text-zinc-100">AI Conversation Exports</span><p className="text-sm text-zinc-500">ChatGPT, Claude, or other exports</p></div>
                      </div>
                      <input type="checkbox" checked={formData.hasAiConversations} onChange={(e) => updateFormData("hasAiConversations", e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" />
                    </label>
                    {formData.hasAiConversations && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Platform</label>
                          <div className="flex gap-2">
                            {[{ value: "chatgpt", label: "ChatGPT" }, { value: "claude", label: "Claude" }, { value: "other", label: "Other" }].map((opt) => (
                              <button key={opt.value} type="button" onClick={() => updateFormData("aiConversationPlatform", opt.value)} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium ${formData.aiConversationPlatform === opt.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700" : "border-zinc-200 dark:border-zinc-700"}`}>{opt.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 text-center"><Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" /><p className="text-sm text-zinc-500">Upload exports (JSON, HTML, PDF)</p></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Business Documents</h2>
                  <div className="space-y-4">
                    {[
                      { key: "hasPitchDeck", label: "Pitch Deck", desc: "PDF or presentation", icon: Presentation, color: "blue" },
                      { key: "hasMarketingPlan", label: "Marketing Plan", desc: "Go-to-market strategy", icon: FileText, color: "orange" },
                    ].map(({ key, label, desc, icon: Icon, color }) => (
                      <div key={key} className={`p-4 rounded-xl border ${formData[key as keyof typeof formData] ? `bg-${color}-50 dark:bg-${color}-900/10 border-${color}-200 dark:border-${color}-800` : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                        <label className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData[key as keyof typeof formData] ? `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600` : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}><Icon className="w-5 h-5" /></div>
                            <div><span className="font-medium text-zinc-900 dark:text-zinc-100">{label}</span><p className="text-sm text-zinc-500">{desc}</p></div>
                          </div>
                          <input type="checkbox" checked={formData[key as keyof typeof formData] as boolean} onChange={(e) => updateFormData(key, e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" />
                        </label>
                        {formData[key as keyof typeof formData] && <div className="mt-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4 text-center"><Upload className="w-6 h-6 text-zinc-400 mx-auto mb-1" /><p className="text-sm text-zinc-500">Upload file (PDF, PPTX)</p></div>}
                      </div>
                    ))}
                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-4">Other Documents</h3>
                      {formData.otherDocuments.map((doc, index) => (
                        <div key={index} className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl mb-3">
                          <FileText className="w-5 h-5 text-zinc-400 mt-2" />
                          <div className="flex-1 space-y-3">
                            <input type="text" value={doc.description} onChange={(e) => { const newDocs = [...formData.otherDocuments]; newDocs[index].description = e.target.value; updateFormData("otherDocuments", newDocs); }} placeholder="What is this document?" className="input-field" />
                            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-3 text-center"><p className="text-sm text-zinc-500">Upload PDF</p></div>
                          </div>
                          <button type="button" onClick={() => updateFormData("otherDocuments", formData.otherDocuments.filter((_, i) => i !== index))} className="p-2 text-zinc-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={addOtherDocument} className="w-full py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-600 hover:border-green-500 hover:text-green-600 flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Add Other Document</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Pricing & Sale Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Sale Type</label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <button type="button" onClick={() => updateFormData("listingType", "AUCTION")} className={`p-4 rounded-xl border text-left ${formData.listingType === "AUCTION" ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}><div className="text-2xl mb-2">🔨</div><div className="font-semibold text-zinc-900 dark:text-zinc-100">Auction</div><p className="text-sm text-zinc-500 mt-1">Let buyers bid. Optionally add Buy Now.</p></button>
                      <button type="button" onClick={() => updateFormData("listingType", "BUY_NOW")} className={`p-4 rounded-xl border text-left ${formData.listingType === "BUY_NOW" ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-zinc-200 dark:border-zinc-800"}`}><div className="text-2xl mb-2">💰</div><div className="font-semibold text-zinc-900 dark:text-zinc-100">Fixed Price</div><p className="text-sm text-zinc-500 mt-1">Set a price. First buyer wins.</p></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Currency</label>
                    <div className="flex gap-3">
                      {["SOL", "USDC"].map((c) => (<button key={c} type="button" onClick={() => updateFormData("currency", c)} className={`flex-1 py-3 px-4 rounded-xl border text-center font-medium ${formData.currency === c ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-zinc-200 dark:border-zinc-800"}`}>{c}</button>))}
                    </div>
                  </div>
                  {formData.listingType === "AUCTION" ? (
                    <>
                      <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Starting Price *</label><div className="relative"><input type="number" value={formData.startingPrice} onChange={(e) => updateFormData("startingPrice", e.target.value)} placeholder="0" min="0" step="0.1" className={`input-field pr-16 ${errors.startingPrice ? "ring-2 ring-red-500" : ""}`} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">{formData.currency}</span></div>{errors.startingPrice && <p className="mt-1 text-sm text-red-500">{errors.startingPrice}</p>}</div>
                      <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Reserve Price (Optional)</label><div className="relative"><input type="number" value={formData.reservePrice} onChange={(e) => updateFormData("reservePrice", e.target.value)} placeholder="0" min="0" step="0.1" className="input-field pr-16" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">{formData.currency}</span></div><p className="mt-1 text-sm text-zinc-500">Hidden from buyers</p></div>
                      <div className={`p-4 rounded-xl border ${formData.buyNowEnabled ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800"}`}>
                        <label className="flex items-center justify-between cursor-pointer mb-3"><div><span className="font-medium text-zinc-900 dark:text-zinc-100">Enable Buy Now</span><p className="text-sm text-zinc-500">Allow instant purchase</p></div><input type="checkbox" checked={formData.buyNowEnabled} onChange={(e) => updateFormData("buyNowEnabled", e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-green-500" /></label>
                        {formData.buyNowEnabled && <div className="relative"><input type="number" value={formData.buyNowPrice} onChange={(e) => updateFormData("buyNowPrice", e.target.value)} placeholder="0" min="0" step="0.1" className={`input-field pr-16 ${errors.buyNowPrice ? "ring-2 ring-red-500" : ""}`} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">{formData.currency}</span>{errors.buyNowPrice && <p className="mt-1 text-sm text-red-500">{errors.buyNowPrice}</p>}</div>}
                      </div>
                      <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duration</label><div className="grid grid-cols-5 gap-3">{["1", "3", "5", "7", "14"].map((d) => (<button key={d} type="button" onClick={() => updateFormData("duration", d)} className={`py-3 px-4 rounded-xl border text-center font-medium ${formData.duration === d ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-zinc-200 dark:border-zinc-800"}`}>{d === "1" ? "24h" : `${d}d`}</button>))}</div></div>
                    </>
                  ) : (
                    <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Price *</label><div className="relative"><input type="number" value={formData.buyNowPrice} onChange={(e) => updateFormData("buyNowPrice", e.target.value)} placeholder="0" min="0" step="0.1" className={`input-field pr-16 ${errors.buyNowPrice ? "ring-2 ring-red-500" : ""}`} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">{formData.currency}</span></div>{errors.buyNowPrice && <p className="mt-1 text-sm text-red-500">{errors.buyNowPrice}</p>}</div>
                  )}
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800"><div className="flex items-start gap-3"><Info className="w-5 h-5 text-blue-500 mt-0.5" /><div><p className="font-medium text-blue-900 dark:text-blue-100">Platform Fee: 5%</p><p className="text-sm text-blue-700 dark:text-blue-300">Deducted from sale price when your project sells.</p></div></div></div>
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Review Your Listing</h2>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div><h3 className="text-sm font-medium text-zinc-500 mb-2">Project</h3><p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formData.title}</p><p className="text-zinc-500">{formData.tagline}</p><div className="flex flex-wrap gap-2 mt-2">{formData.techStack.slice(0, 4).map((tech) => (<span key={tech} className="badge-gray">{tech}</span>))}</div></div>
                    <div><h3 className="text-sm font-medium text-zinc-500 mb-2">Pricing</h3>{formData.listingType === "AUCTION" ? (<><p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Starting at {formData.startingPrice} {formData.currency}</p>{formData.buyNowEnabled && <p className="text-green-600">Buy Now: {formData.buyNowPrice} {formData.currency}</p>}<p className="text-zinc-500">{formData.duration === "1" ? "24 hour" : `${formData.duration} day`} auction</p></>) : (<p className="text-lg font-semibold text-green-600">{formData.buyNowPrice} {formData.currency}</p>)}</div>
                  </div>
                  <div><h3 className="text-sm font-medium text-zinc-500 mb-2">Assets Included</h3><div className="flex flex-wrap gap-2"><span className="badge-green">GitHub Repo</span>{formData.hasDomain && <span className="badge-green">Domain</span>}{formData.hasDatabase && <span className="badge-green">Database</span>}{formData.hasHosting && <span className="badge-green">Hosting</span>}{formData.hasApiKeys && <span className="badge-green">API Keys</span>}{formData.hasDesignFiles && <span className="badge-green">Design Files</span>}{formData.hasDocumentation && <span className="badge-green">Documentation</span>}{formData.hasBrandAssets && <span className="badge-green">Brand Assets</span>}{formData.hasSmartContract && <span className="badge-green">Smart Contract</span>}{formData.hasAiConversations && <span className="badge-green">AI Conversations</span>}{formData.hasPitchDeck && <span className="badge-green">Pitch Deck</span>}{formData.hasMarketingPlan && <span className="badge-green">Marketing Plan</span>}</div></div>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800"><label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-green-500" /><span className="text-sm text-zinc-600 dark:text-zinc-400">I confirm I own all assets and agree to the <a href="/terms" className="text-green-600 hover:underline">Terms of Service</a> and <a href="/seller-agreement" className="text-green-600 hover:underline">Seller Agreement</a>.</span></label></div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={prevStep} disabled={currentStep === 1} className={`btn-secondary ${currentStep === 1 ? "opacity-50 cursor-not-allowed" : ""}`}><ArrowLeft className="w-4 h-4" />Back</button>
          {currentStep < steps.length ? (<button onClick={nextStep} className="btn-primary">Continue<ArrowRight className="w-4 h-4" /></button>) : (<button onClick={handleSubmit} disabled={isSubmitting} className="btn-success">{isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Creating...</>) : (<><Check className="w-4 h-4" />Publish Listing</>)}</button>)}
        </div>
      </div>
    </div>
  );
}
