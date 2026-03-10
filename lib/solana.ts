import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, BN, Idl } from "@coral-xyz/anchor";
import {
  PLATFORM_CONFIG,
  calculatePlatformFee as _configCalcPlatformFee,
  calculateDisputeFee as _configCalcDisputeFee,
  calculateSellerProceeds as _configCalcSellerProceeds,
} from "@/lib/config";

// SECURITY: Solana addresses must come from environment variables.
// Hardcoded fallbacks risk routing funds to wrong addresses if env vars are missing at build time.
// env-validation.ts requires these in production; in development, throw if missing.
// Uses lazy proxy to defer resolution until first access, avoiding throws during Next.js build.
function lazyPublicKey(envVar: string, name: string): PublicKey {
  let cached: PublicKey | undefined;
  function resolve(): PublicKey {
    if (!cached) {
      const value = process.env[envVar];
      if (!value) {
        throw new Error(`${envVar} must be set. ${name} cannot use a hardcoded fallback.`);
      }
      cached = new PublicKey(value);
    }
    return cached;
  }
  return new Proxy({} as PublicKey, {
    get(_, prop) {
      const key = resolve();
      const val = (key as any)[prop];
      return typeof val === "function" ? val.bind(key) : val;
    },
  });
}

// Program ID from deployed/generated smart contract
export const PROGRAM_ID = lazyPublicKey("NEXT_PUBLIC_PROGRAM_ID", "Program ID");

// Platform treasury wallet - receives fees
export const TREASURY_WALLET = lazyPublicKey("NEXT_PUBLIC_TREASURY_WALLET", "Treasury wallet");

// Platform token mint ($APP) - mainnet address
export const PLATFORM_TOKEN_MINT = lazyPublicKey("NEXT_PUBLIC_APP_TOKEN_MINT", "APP token mint");

// USDC mint (mainnet)
export const USDC_MINT = lazyPublicKey("NEXT_PUBLIC_USDC_MINT", "USDC mint");

// Token decimals
export const TOKEN_DECIMALS = {
  SOL: 9,
  APP: 9,
  USDC: 6,
} as const;

// Token mints mapping
export const TOKEN_MINTS = {
  APP: PLATFORM_TOKEN_MINT,
  USDC: USDC_MINT,
} as const;

// Fee constants — single source of truth in config.ts to prevent inconsistency
export const PLATFORM_FEE_BPS = PLATFORM_CONFIG.fees.platformFeeBps;
export const APP_FEE_BPS = PLATFORM_CONFIG.fees.appFeeBps;
export const DISPUTE_FEE_BPS = PLATFORM_CONFIG.fees.disputeFeeBps;
export const TOKEN_LAUNCH_FEE_BPS = PLATFORM_CONFIG.fees.tokenLaunchSupplyBps;

// Connection to Solana
export const getConnection = () => {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL must be set in production");
    }
    // Only fall back to devnet in development
    return new Connection("https://api.devnet.solana.com", "confirmed");
  }
  return new Connection(rpcUrl, "confirmed");
};

// PDA derivation functions
export const getConfigPDA = () => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
};

export const getListingPDA = (seller: PublicKey, salt: number) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), seller.toBuffer(), new BN(salt).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
};

export const getEscrowPDA = (listing: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), listing.toBuffer()],
    PROGRAM_ID
  );
};

export const getTransactionPDA = (listing: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("transaction"), listing.toBuffer()],
    PROGRAM_ID
  );
};

export const getWithdrawalPDA = (listing: PublicKey, withdrawalId: number) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("withdrawal"), listing.toBuffer(), new BN(withdrawalId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
};

export const getOfferPDA = (listing: PublicKey, buyer: PublicKey, offerSeed: number) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), listing.toBuffer(), buyer.toBuffer(), new BN(offerSeed).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
};

export const getOfferEscrowPDA = (offer: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("offer_escrow"), offer.toBuffer()],
    PROGRAM_ID
  );
};

export const getDisputePDA = (transaction: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dispute"), transaction.toBuffer()],
    PROGRAM_ID
  );
};

// Convert SOL to lamports
export const solToLamports = (sol: number): BN => {
  // Use string conversion to avoid floating-point precision loss
  const [whole, decimal = ""] = sol.toString().split(".");
  const paddedDecimal = decimal.padEnd(9, "0").slice(0, 9);
  return new BN(whole + paddedDecimal);
};

// Convert lamports to SOL
export const lamportsToSol = (lamports: number | BN): number => {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / LAMPORTS_PER_SOL;
};

// Get fee rate based on currency (APP gets discounted 3%, others 5%)
export const getFeeRateBps = (currency?: string): number => {
  return currency === "APP" ? APP_FEE_BPS : PLATFORM_FEE_BPS;
};

/**
 * Fee calculations delegate to lib/config.ts (single source of truth)
 * to prevent divergent behavior from duplicate implementations.
 */
export const calculatePlatformFee = _configCalcPlatformFee;
export const calculateDisputeFee = _configCalcDisputeFee;
export const calculateSellerProceeds = (salePrice: number, currency?: string): { fee: number; proceeds: number; feeBps: number } => {
  const result = _configCalcSellerProceeds(salePrice, currency);
  return { fee: result.fee, proceeds: result.proceeds, feeBps: result.feeBps };
};

// Listing status enum (matches on-chain - 9 statuses)
export enum ListingStatus {
  Active = 0,
  Ended = 1,
  Sold = 2,
  Cancelled = 3,
  InEscrow = 4,
  TransferPending = 5,
  Disputed = 6,
  Completed = 7,
  Refunded = 8,
}

// Transaction status enum (matches on-chain - 10 statuses)
export enum TransactionStatus {
  Pending = 0,
  Paid = 1,
  InEscrow = 2,
  TransferPending = 3,
  TransferInProgress = 4,
  AwaitingConfirmation = 5,
  Disputed = 6,
  Completed = 7,
  Refunded = 8,
  Cancelled = 9,
}

// Types for on-chain data
export interface OnChainListing {
  seller: PublicKey;
  listingId: string;
  startingPrice: BN;
  reservePrice: BN | null;
  buyNowPrice: BN | null;
  currentBid: BN;
  currentBidder: PublicKey | null;
  startTime: BN;
  endTime: BN;
  status: ListingStatus;
  lastOfferBuyer: PublicKey | null;
  consecutiveOfferCount: BN;
  bump: number;
}

export interface OnChainEscrow {
  listing: PublicKey;
  buyer: PublicKey;
  seller: PublicKey;
  amount: BN;
  platformFee: BN;
  status: number;
  createdAt: BN;
  deadline: BN;
  bump: number;
}

// Utility to format wallet address
export const formatWalletAddress = (address: string | PublicKey, chars = 4): string => {
  const addr = typeof address === "string" ? address : address.toBase58();
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
};

// Check if auction has ended
export const isAuctionEnded = (endTime: number | BN): boolean => {
  const end = typeof endTime === "number" ? endTime : endTime.toNumber();
  return Date.now() / 1000 > end;
};

// Get time remaining for auction
export const getTimeRemaining = (endTime: number | BN): { days: number; hours: number; minutes: number; seconds: number } => {
  const end = typeof endTime === "number" ? endTime : endTime.toNumber();
  const now = Date.now() / 1000;
  const diff = Math.max(0, end - now);
  
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: Math.floor(diff % 60),
  };
};

// WARNING: The IDL at idl/app_market.json may be incomplete.
// Run `anchor build` in the programs/ directory to generate a complete IDL.
// Until then, direct contract calls may fail.
import AppMarketIDL from "@/idl/app_market.json";

export const IDL: Idl = AppMarketIDL as Idl;

// Create program instance
export const getProgram = (provider: AnchorProvider): Program => {
  return new Program(IDL, PROGRAM_ID, provider);
};

// Convert token amount to raw units based on decimals
// SECURITY: Uses string parsing to avoid floating-point multiplication errors
export const toTokenUnits = (amount: number, currency: "SOL" | "APP" | "USDC"): BN => {
  const decimals = TOKEN_DECIMALS[currency];
  const [whole, decimal = ""] = amount.toString().split(".");
  const paddedDecimal = decimal.padEnd(decimals, "0").slice(0, decimals);
  return new BN(whole + paddedDecimal);
};

// Convert raw units to token amount
export const fromTokenUnits = (units: number | BN, currency: "SOL" | "APP" | "USDC"): number => {
  const decimals = TOKEN_DECIMALS[currency];
  const value = typeof units === "number" ? units : units.toNumber();
  return value / Math.pow(10, decimals);
};

// Get token mint for currency
export const getTokenMint = (currency: "APP" | "USDC"): PublicKey => {
  return TOKEN_MINTS[currency];
};

// Format currency amount for display
export const formatTokenAmount = (amount: number, currency: string): string => {
  if (currency === "SOL") {
    return `${amount.toFixed(4)} SOL`;
  } else if (currency === "APP") {
    return `${amount.toFixed(2)} APP`;
  } else if (currency === "USDC") {
    return `${amount.toFixed(2)} USDC`;
  }
  return `${amount} ${currency}`;
};
