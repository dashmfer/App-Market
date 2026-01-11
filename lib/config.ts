/**
 * Platform Configuration
 * 
 * This file contains all platform-wide configuration including:
 * - Fee structures
 * - Auto-buyback settings
 * - Token launch settings
 * - Future monetization features
 */

export const PLATFORM_CONFIG = {
  // ============================================
  // FEE STRUCTURE (Tier 1 - Launch)
  // ============================================
  fees: {
    // Platform fee on all sales (5%)
    platformFeeBps: 500,
    
    // Dispute resolution fee charged to losing party (2%)
    disputeFeeBps: 200,
    
    // Token launch fee - 1% of token supply goes to platform wallet
    tokenLaunchSupplyBps: 100,
    
    // Flat fee for token launch (in SOL)
    tokenLaunchFlatFee: 1,
  },

  // ============================================
  // AUTO-BUYBACK CONFIGURATION
  // ============================================
  // When enabled, platform revenue is automatically used to buy
  // the platform token from the open market
  autoBuyback: {
    // Master switch for auto-buyback feature
    enabled: process.env.ENABLE_AUTO_BUYBACK === "true",
    
    // Percentage of revenue used for buyback (0-100)
    buybackPercentage: parseInt(process.env.BUYBACK_PERCENTAGE || "20"),
    
    // Minimum SOL accumulated before executing buyback
    minimumBuybackAmount: 1, // SOL
    
    // DEX to use for buyback (raydium, jupiter, etc.)
    dexProvider: "jupiter",
    
    // What to do with bought tokens
    buybackDestination: "burn", // "burn" | "treasury" | "stakers"
    
    // Slippage tolerance for buyback swaps
    slippageBps: 100, // 1%
  },

  // ============================================
  // REVENUE DISTRIBUTION
  // ============================================
  // How platform revenue is distributed
  revenueDistribution: {
    // If auto-buyback is enabled, this is what remains after buyback
    operations: 50, // 50% to operations/team
    treasury: 30,   // 30% to treasury (or stakers if token launched)
    buyback: 20,    // 20% for buyback (when enabled)
  },

  // ============================================
  // TOKEN LAUNCH SETTINGS
  // ============================================
  tokenLaunch: {
    // Platform receives 1% of all token launches
    platformAllocationBps: 100,
    
    // Supported launch types
    launchTypes: ["FAIR_LAUNCH", "PRESALE"],
    
    // Integration provider (pump.fun, etc.)
    provider: "pump.fun",
    
    // Minimum liquidity required for launch
    minimumLiquidity: 5, // SOL
  },

  // ============================================
  // FUTURE FEATURES (Tier 2-3)
  // ============================================
  futureFeatures: {
    // Featured Listings (Tier 2)
    featuredListings: {
      enabled: false,
      pricing: {
        topOfCategory: 0.5,    // SOL per 7 days
        homepageFeatured: 1,   // SOL per 7 days
        searchBoost: 0.25,     // SOL per 7 days
        newsletter: 0.3,       // SOL per feature
      },
    },
    
    // Verified Seller Badges (Tier 3)
    verifiedBadges: {
      enabled: false,
      price: 2, // SOL (one-time)
      requirements: {
        minSales: 3,
        minRating: 4.5,
        minAccountAge: 30, // days
      },
    },
    
    // Pro Subscriptions (Tier 3)
    subscriptions: {
      enabled: false,
      tiers: {
        proSeller: {
          price: 29, // USD/month
          feeBps: 300, // 3% vs 5%
          features: ["analytics", "priority_support", "unlimited_listings"],
        },
        proBuyer: {
          price: 19, // USD/month
          features: ["early_access", "price_alerts", "advanced_filters"],
        },
        agency: {
          price: 99, // USD/month
          features: ["white_label", "api_access", "bulk_operations"],
        },
      },
    },
  },

  // ============================================
  // WALLET ADDRESSES
  // ============================================
  wallets: {
    // Platform treasury (receives fees)
    treasury: process.env.PLATFORM_TREASURY_WALLET || "TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    
    // Platform token mint (when launched)
    tokenMint: process.env.PLATFORM_TOKEN_MINT || null,
    
    // Buyback wallet (holds SOL for buybacks)
    buybackWallet: process.env.BUYBACK_WALLET || null,
    
    // Burn address
    burnAddress: "11111111111111111111111111111111",
  },

  // ============================================
  // DISPUTES & PROTECTION
  // ============================================
  disputes: {
    // Fee charged to losing party (2%)
    feeRateBps: 200,
    
    // Time to resolve disputes (days)
    resolutionDeadlineDays: 14,
    
    // Buyer must deposit this % of purchase price into escrow to claim non-receipt
    // This prevents fraudulent denial claims
    buyerDenialDepositPercent: 10,
    
    // If buyer loses dispute, deposit goes to treasury
    // Note: Could create conflict of interest - monitor and adjust
    depositGoesToTreasury: true,
    
    // Minimum deposit amount (SOL)
    minimumDeposit: 0.5,
  },

  // ============================================
  // ESCROW SETTINGS
  // ============================================
  escrow: {
    // Time buyer has to confirm transfer (in days)
    transferDeadlineDays: 7,
    
    // Auto-release after deadline if no dispute
    autoReleaseEnabled: true,
    
    // Extension allowed in dispute resolution
    maxExtensionDays: 7,
  },

  // ============================================
  // REFERRAL SYSTEM
  // ============================================
  referral: {
    // Commission rate for referrals (2% of sale)
    commissionRateBps: 200,
    
    // Minimum payout amount (SOL)
    minimumPayout: 0.5,
    
    // Who earns: referrer gets commission when their referred user SELLS
    // This incentivizes bringing quality sellers to the platform
    earnOnSellerSale: true,
    
    // Also earn when referred user BUYS (optional, disabled by default)
    earnOnBuyerPurchase: false,
    
    // Referral code format
    codeMinLength: 3,
    codeMaxLength: 20,
    
    // How long referral tracking lasts (days)
    // If someone clicks your link, you get credit for X days
    trackingDurationDays: 30,
  },

  // ============================================
  // AUCTION SETTINGS
  // ============================================
  auction: {
    // Minimum listing duration (days)
    minDuration: 1,
    
    // Maximum listing duration (days)
    maxDuration: 30,
    
    // Default duration (days)
    defaultDuration: 7,
    
    // Minimum starting price (SOL)
    minStartingPrice: 0.1,
    
    // Anti-snipe: extend auction if bid placed in last X minutes
    antiSnipeMinutes: 5,
    antiSnipeExtension: 10, // minutes to extend
  },
};

// Helper functions for config
export function calculatePlatformFee(amount: number): number {
  return (amount * PLATFORM_CONFIG.fees.platformFeeBps) / 10000;
}

export function calculateDisputeFee(amount: number): number {
  return (amount * PLATFORM_CONFIG.fees.disputeFeeBps) / 10000;
}

export function calculateTokenLaunchAllocation(totalSupply: bigint): bigint {
  return (totalSupply * BigInt(PLATFORM_CONFIG.fees.tokenLaunchSupplyBps)) / BigInt(10000);
}

export function calculateBuybackAmount(revenue: number): number {
  if (!PLATFORM_CONFIG.autoBuyback.enabled) return 0;
  return (revenue * PLATFORM_CONFIG.autoBuyback.buybackPercentage) / 100;
}

export function getRevenueDistribution(totalRevenue: number): {
  operations: number;
  treasury: number;
  buyback: number;
} {
  const { revenueDistribution, autoBuyback } = PLATFORM_CONFIG;
  
  if (autoBuyback.enabled) {
    return {
      operations: (totalRevenue * revenueDistribution.operations) / 100,
      treasury: (totalRevenue * revenueDistribution.treasury) / 100,
      buyback: (totalRevenue * revenueDistribution.buyback) / 100,
    };
  }
  
  // If buyback disabled, split between operations and treasury
  return {
    operations: (totalRevenue * 60) / 100,
    treasury: (totalRevenue * 40) / 100,
    buyback: 0,
  };
}

export default PLATFORM_CONFIG;
