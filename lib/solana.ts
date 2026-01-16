import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, BN, Idl } from "@coral-xyz/anchor";

// Program ID from deployed/generated smart contract
export const PROGRAM_ID = new PublicKey("FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ");

// Platform treasury wallet - receives fees
export const TREASURY_WALLET = new PublicKey("TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// Platform token mint (for future auto-buyback feature)
export const PLATFORM_TOKEN_MINT = new PublicKey("APPMktTokenXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// Fee constants (basis points)
export const PLATFORM_FEE_BPS = 500; // 5%
export const DISPUTE_FEE_BPS = 200; // 2%
export const TOKEN_LAUNCH_FEE_BPS = 100; // 1% of token supply

// Connection to Solana
export const getConnection = () => {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
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
  return new BN(sol * LAMPORTS_PER_SOL);
};

// Convert lamports to SOL
export const lamportsToSol = (lamports: number | BN): number => {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / LAMPORTS_PER_SOL;
};

// Calculate platform fee
export const calculatePlatformFee = (amount: number): number => {
  return (amount * PLATFORM_FEE_BPS) / 10000;
};

// Calculate dispute fee
export const calculateDisputeFee = (amount: number): number => {
  return (amount * DISPUTE_FEE_BPS) / 10000;
};

// Calculate seller proceeds after fees
export const calculateSellerProceeds = (salePrice: number): { fee: number; proceeds: number } => {
  const fee = calculatePlatformFee(salePrice);
  return {
    fee,
    proceeds: salePrice - fee,
  };
};

// Listing status enum (matches on-chain)
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

// Transaction status enum
export enum TransactionStatus {
  Pending = "PENDING",
  Paid = "PAID",
  InEscrow = "IN_ESCROW",
  TransferPending = "TRANSFER_PENDING",
  TransferInProgress = "TRANSFER_IN_PROGRESS",
  AwaitingConfirmation = "AWAITING_CONFIRMATION",
  Disputed = "DISPUTED",
  Completed = "COMPLETED",
  Refunded = "REFUNDED",
  Cancelled = "CANCELLED",
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

// IDL placeholder - replace with generated IDL after building Solana program with `anchor build`
// The actual IDL will be at target/idl/app_market.json after build
export const IDL: Idl = {
  version: "0.1.0",
  name: "app_market",
  instructions: [],
  accounts: [],
  types: [],
  events: [],
  errors: [],
} as Idl;

// Create program instance
export const getProgram = (provider: AnchorProvider): Program => {
  return new Program(IDL, PROGRAM_ID, provider);
};
