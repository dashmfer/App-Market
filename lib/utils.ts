import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format SOL amount
export function formatSol(amount: number, decimals: number = 2): string {
  return `${amount.toFixed(decimals)} SOL`;
}

// Format large numbers (1K, 1M, etc.)
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// Format date
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

// Generate slug from string
export function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Truncate string
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

// Format wallet address
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validate GitHub URL
export function isValidGitHubUrl(url: string): boolean {
  const githubRegex = /^(https?:\/\/)?(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  return githubRegex.test(url);
}

// Parse GitHub URL to get owner and repo
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Get category label
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    SAAS: "SaaS",
    AI_ML: "AI & ML",
    MOBILE_APP: "Mobile App",
    WEB_APP: "Web App",
    BROWSER_EXTENSION: "Browser Extension",
    CRYPTO_WEB3: "Crypto & Web3",
    ECOMMERCE: "E-commerce",
    DEVELOPER_TOOLS: "Developer Tools",
    API: "API Service",
    MARKETPLACE: "Marketplace",
    SOCIAL: "Social",
    PRODUCTIVITY: "Productivity",
    FINTECH: "FinTech",
    GAMING: "Gaming",
    OTHER: "Other",
  };
  
  return labels[category] || category;
}

// Get status label and color
export function getStatusInfo(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "gray" },
    PENDING_REVIEW: { label: "Pending Review", color: "yellow" },
    ACTIVE: { label: "Active", color: "green" },
    ENDED: { label: "Ended", color: "gray" },
    SOLD: { label: "Sold", color: "blue" },
    CANCELLED: { label: "Cancelled", color: "red" },
    EXPIRED: { label: "Expired", color: "gray" },
    PENDING: { label: "Pending", color: "yellow" },
    PAID: { label: "Paid", color: "blue" },
    IN_ESCROW: { label: "In Escrow", color: "blue" },
    TRANSFER_PENDING: { label: "Transfer Pending", color: "yellow" },
    TRANSFER_IN_PROGRESS: { label: "Transferring", color: "yellow" },
    AWAITING_CONFIRMATION: { label: "Awaiting Confirmation", color: "yellow" },
    DISPUTED: { label: "Disputed", color: "red" },
    COMPLETED: { label: "Completed", color: "green" },
    REFUNDED: { label: "Refunded", color: "red" },
  };
  
  return statusMap[status] || { label: status, color: "gray" };
}
