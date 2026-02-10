/**
 * Solana Smart Contract Interactions
 *
 * This file contains functions to interact with the App Market Solana smart contract.
 * All escrow, auction, and marketplace logic runs on-chain for security and transparency.
 */

import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  IDL,
  getProgram,
  getConfigPDA,
  getListingPDA,
  getEscrowPDA,
  getTransactionPDA,
  getOfferPDA,
  getOfferEscrowPDA,
  getWithdrawalPDA,
  getDisputePDA,
  solToLamports
} from "./solana";

// ============================================
// LISTING CREATION
// ============================================

export interface CreateListingParams {
  provider: AnchorProvider;
  salt: number;
  listingType: "Auction" | "BuyNow";
  startingPrice: number; // in SOL
  reservePrice?: number; // in SOL
  buyNowPrice?: number; // in SOL
  durationSeconds: number;
  requiresGithub: boolean;
  requiredGithubUsername: string;
  paymentMint?: PublicKey; // Optional: APP token mint for 3% fee discount, null for SOL (5%)
}

export async function createListing(params: CreateListingParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [listing] = getListingPDA(seller, params.salt);
  const [escrow] = getEscrowPDA(listing);
  const [config] = getConfigPDA();

  const listingTypeEnum = params.listingType === "Auction"
    ? { auction: {} }
    : { buyNow: {} };

  const tx = await program.methods
    .createListing(
      new BN(params.salt),
      listingTypeEnum,
      solToLamports(params.startingPrice),
      params.reservePrice ? solToLamports(params.reservePrice) : null,
      params.buyNowPrice ? solToLamports(params.buyNowPrice) : null,
      new BN(params.durationSeconds),
      params.requiresGithub,
      params.requiredGithubUsername,
      params.paymentMint || null // Pass payment mint for fee calculation (APP = 3%, SOL = 5%)
    )
    .accounts({
      listing,
      escrow,
      seller,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// BIDDING
// ============================================

export interface PlaceBidParams {
  provider: AnchorProvider;
  listing: PublicKey;
  amount: number; // in SOL
  withdrawalCount: number; // Current withdrawal count from listing account
}

export async function placeBid(params: PlaceBidParams): Promise<string> {
  const program = getProgram(params.provider);
  const bidder = params.provider.wallet.publicKey;

  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();
  const [pendingWithdrawal] = getWithdrawalPDA(params.listing, params.withdrawalCount + 1);

  const tx = await program.methods
    .placeBid(solToLamports(params.amount))
    .accounts({
      listing: params.listing,
      escrow,
      bidder,
      pendingWithdrawal,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// WITHDRAWAL
// ============================================

export interface WithdrawFundsParams {
  provider: AnchorProvider;
  listing: PublicKey;
  withdrawalId: number;
}

export async function withdrawFunds(params: WithdrawFundsParams): Promise<string> {
  const program = getProgram(params.provider);
  const bidder = params.provider.wallet.publicKey;

  const [pendingWithdrawal] = getWithdrawalPDA(params.listing, params.withdrawalId);
  const [escrow] = getEscrowPDA(params.listing);

  const tx = await program.methods
    .withdrawFunds()
    .accounts({
      pendingWithdrawal,
      escrow,
      bidder,
      listing: params.listing,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// BUY NOW
// ============================================

export interface BuyNowParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function buyNow(params: BuyNowParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [escrow] = getEscrowPDA(params.listing);
  const [transaction] = getTransactionPDA(params.listing);
  const [config] = getConfigPDA();
  // SECURITY: Include pending_withdrawal account required by on-chain program
  const listing = await program.account.listing.fetch(params.listing);
  const withdrawalCount = (listing as any).withdrawalCount ?? 0;
  const [pendingWithdrawal] = getWithdrawalPDA(params.listing, withdrawalCount + 1);

  const tx = await program.methods
    .buyNow()
    .accounts({
      listing: params.listing,
      escrow,
      transaction,
      pendingWithdrawal,
      buyer,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// SETTLE AUCTION
// ============================================

export interface SettleAuctionParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function settleAuction(params: SettleAuctionParams): Promise<string> {
  const program = getProgram(params.provider);
  const bidder = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .settleAuction()
    .accounts({
      listing: params.listing,
      transaction,
      escrow,
      config,
      bidder,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// SELLER ACTIONS
// ============================================

export interface SellerConfirmTransferParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function sellerConfirmTransfer(params: SellerConfirmTransferParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .sellerConfirmTransfer()
    .accounts({
      transaction,
      listing: params.listing,
      seller,
      config,
    })
    .rpc();

  return tx;
}

// ============================================
// BUYER ACTIONS
// ============================================

export interface ConfirmReceiptParams {
  provider: AnchorProvider;
  listing: PublicKey;
  seller: PublicKey;
  treasury: PublicKey;
}

export async function confirmReceipt(params: ConfirmReceiptParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .confirmReceipt()
    .accounts({
      transaction,
      escrow,
      listing: params.listing,
      buyer,
      seller: params.seller,
      treasury: params.treasury,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// OFFERS
// ============================================

export interface MakeOfferParams {
  provider: AnchorProvider;
  listing: PublicKey;
  amount: number; // in SOL
  expiresIn: number; // in seconds
  offerSeed: number; // Must match listing.offer_count
}

export async function makeOffer(params: MakeOfferParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [offer] = getOfferPDA(params.listing, buyer, params.offerSeed);
  const [offerEscrow] = getOfferEscrowPDA(offer);
  const [config] = getConfigPDA();

  const deadline = Math.floor(Date.now() / 1000) + params.expiresIn;

  const tx = await program.methods
    .makeOffer(solToLamports(params.amount), new BN(deadline), new BN(params.offerSeed))
    .accounts({
      listing: params.listing,
      offer,
      offerEscrow,
      buyer,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export interface CancelOfferParams {
  provider: AnchorProvider;
  listing: PublicKey;
  offerSeed: number; // The seed used when creating the offer
}

export async function cancelOffer(params: CancelOfferParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [offer] = getOfferPDA(params.listing, buyer, params.offerSeed);
  const [offerEscrow] = getOfferEscrowPDA(offer);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .cancelOffer()
    .accounts({
      offer,
      offerEscrow,
      buyer,
      listing: params.listing,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export interface AcceptOfferParams {
  provider: AnchorProvider;
  listing: PublicKey;
  buyer: PublicKey;
  offerSeed: number; // The seed used when creating the offer
}

export async function acceptOffer(params: AcceptOfferParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [offer] = getOfferPDA(params.listing, params.buyer, params.offerSeed);
  const [offerEscrow] = getOfferEscrowPDA(offer);
  const [escrow] = getEscrowPDA(params.listing);
  const [transaction] = getTransactionPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .acceptOffer()
    .accounts({
      offer,
      offerEscrow,
      listing: params.listing,
      transaction,
      escrow,
      seller,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// DISPUTES
// ============================================

export interface OpenDisputeParams {
  provider: AnchorProvider;
  listing: PublicKey;
  treasury: PublicKey;
  reason: string;
}

export async function openDispute(params: OpenDisputeParams): Promise<string> {
  const program = getProgram(params.provider);
  const initiator = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [dispute] = getDisputePDA(transaction);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .openDispute(params.reason)
    .accounts({
      transaction,
      dispute,
      listing: params.listing,
      initiator,
      treasury: params.treasury,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN ACTIONS
// ============================================

export interface ProposeDisputeResolutionParams {
  provider: AnchorProvider;
  listing: PublicKey;
  resolution: "FullRefund" | "ReleaseToSeller" | "PartialRefund";
  sellerAmount: number; // in SOL (for PartialRefund resolution)
  buyerAmount: number; // in SOL (for PartialRefund resolution)
  notes: string;
}

export async function proposeDisputeResolution(params: ProposeDisputeResolutionParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [dispute] = getDisputePDA(transaction);
  const [config] = getConfigPDA();

  let resolutionEnum: any;
  if (params.resolution === "FullRefund") {
    resolutionEnum = { fullRefund: {} };
  } else if (params.resolution === "ReleaseToSeller") {
    resolutionEnum = { releaseToSeller: {} };
  } else {
    resolutionEnum = {
      partialRefund: {
        buyerAmount: solToLamports(params.buyerAmount),
        sellerAmount: solToLamports(params.sellerAmount)
      }
    };
  }

  const tx = await program.methods
    .proposeDisputeResolution(resolutionEnum, params.notes)
    .accounts({
      dispute,
      transaction,
      listing: params.listing,
      config,
      admin,
    })
    .rpc();

  return tx;
}

export interface ContestDisputeResolutionParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function contestDisputeResolution(params: ContestDisputeResolutionParams): Promise<string> {
  const program = getProgram(params.provider);
  const caller = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [dispute] = getDisputePDA(transaction);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .contestDisputeResolution()
    .accounts({
      dispute,
      transaction,
      listing: params.listing,
      config,
      caller,
    })
    .rpc();

  return tx;
}

export interface ExecuteDisputeResolutionParams {
  provider: AnchorProvider;
  listing: PublicKey;
  seller: PublicKey;
  buyer: PublicKey;
  treasury: PublicKey;
}

export async function executeDisputeResolution(params: ExecuteDisputeResolutionParams): Promise<string> {
  const program = getProgram(params.provider);
  const caller = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [dispute] = getDisputePDA(transaction);
  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .executeDisputeResolution()
    .accounts({
      dispute,
      transaction,
      escrow,
      listing: params.listing,
      seller: params.seller,
      buyer: params.buyer,
      treasury: params.treasury,
      config,
      caller,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// CANCELLATION
// ============================================

export interface CancelListingParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function cancelListing(params: CancelListingParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [config] = getConfigPDA();

  const tx = await program.methods
    .cancelListing()
    .accounts({
      listing: params.listing,
      seller,
      config,
    })
    .rpc();

  return tx;
}

// ============================================
// EMERGENCY VERIFICATION (Backend Fallback)
// ============================================

export interface EmergencyAutoVerifyParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

// Buyer can auto-verify after 30 days if backend is unresponsive
export async function emergencyAutoVerify(params: EmergencyAutoVerifyParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .emergencyAutoVerify()
    .accounts({
      transaction,
      config,
      buyer,
    })
    .rpc();

  return tx;
}

export interface AdminEmergencyVerifyParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

// Admin can verify after 30 days if backend is unresponsive
export async function adminEmergencyVerify(params: AdminEmergencyVerifyParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .adminEmergencyVerify()
    .accounts({
      transaction,
      config,
      admin,
    })
    .rpc();

  return tx;
}

// ============================================
// CANCEL AUCTION (Seller - no bids only)
// ============================================

export interface CancelAuctionParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function cancelAuction(params: CancelAuctionParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .cancelAuction()
    .accounts({
      listing: params.listing,
      escrow,
      seller,
      config,
    })
    .rpc();

  return tx;
}

// ============================================
// EXPIRE LISTING (Anyone can call after deadline)
// ============================================

export interface ExpireListingParams {
  provider: AnchorProvider;
  listing: PublicKey;
}

export async function expireListing(params: ExpireListingParams): Promise<string> {
  const program = getProgram(params.provider);

  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .expireListing()
    .accounts({
      listing: params.listing,
      escrow,
      config,
    })
    .rpc();

  return tx;
}

// ============================================
// EXPIRE OFFER (Anyone can call after deadline)
// ============================================

export interface ExpireOfferParams {
  provider: AnchorProvider;
  listing: PublicKey;
  buyer: PublicKey;
  offerSeed: number;
}

export async function expireOffer(params: ExpireOfferParams): Promise<string> {
  const program = getProgram(params.provider);

  const [offer] = getOfferPDA(params.listing, params.buyer, params.offerSeed);
  const [offerEscrow] = getOfferEscrowPDA(offer);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .expireOffer()
    .accounts({
      offer,
      offerEscrow,
      listing: params.listing,
      buyer: params.buyer,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// VERIFY UPLOADS (Backend authority only)
// ============================================

export interface VerifyUploadsParams {
  provider: AnchorProvider;
  listing: PublicKey;
  verificationHash: string;
}

export async function verifyUploads(params: VerifyUploadsParams): Promise<string> {
  const program = getProgram(params.provider);
  const backendAuthority = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .verifyUploads(params.verificationHash)
    .accounts({
      transaction,
      config,
      backendAuthority,
    })
    .rpc();

  return tx;
}

// ============================================
// FINALIZE TRANSACTION (Seller - after verification)
// ============================================

export interface FinalizeTransactionParams {
  provider: AnchorProvider;
  listing: PublicKey;
  buyer: PublicKey;
  treasury: PublicKey;
}

export async function finalizeTransaction(params: FinalizeTransactionParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .finalizeTransaction()
    .accounts({
      transaction,
      escrow,
      listing: params.listing,
      seller,
      buyer: params.buyer,
      treasury: params.treasury,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// EMERGENCY REFUND (Anyone - after 30 days of no activity)
// ============================================

export interface EmergencyRefundParams {
  provider: AnchorProvider;
  listing: PublicKey;
  buyer: PublicKey;
}

export async function emergencyRefund(params: EmergencyRefundParams): Promise<string> {
  const program = getProgram(params.provider);
  const caller = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .emergencyRefund()
    .accounts({
      transaction,
      escrow,
      listing: params.listing,
      buyer: params.buyer,
      config,
      caller,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN: SET PAUSED
// ============================================

export interface SetPausedParams {
  provider: AnchorProvider;
  paused: boolean;
}

export async function setPaused(params: SetPausedParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [config] = getConfigPDA();

  const tx = await program.methods
    .setPaused(params.paused)
    .accounts({
      config,
      admin,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN: PROPOSE TREASURY CHANGE
// ============================================

export interface ProposeTreasuryChangeParams {
  provider: AnchorProvider;
  newTreasury: PublicKey;
}

export async function proposeTreasuryChange(params: ProposeTreasuryChangeParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [config] = getConfigPDA();

  const tx = await program.methods
    .proposeTreasuryChange(params.newTreasury)
    .accounts({
      config,
      admin,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN: EXECUTE TREASURY CHANGE (after 48h timelock)
// ============================================

export interface ExecuteTreasuryChangeParams {
  provider: AnchorProvider;
}

export async function executeTreasuryChange(params: ExecuteTreasuryChangeParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [config] = getConfigPDA();

  const tx = await program.methods
    .executeTreasuryChange()
    .accounts({
      config,
      admin,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN: PROPOSE ADMIN CHANGE
// ============================================

export interface ProposeAdminChangeParams {
  provider: AnchorProvider;
  newAdmin: PublicKey;
}

export async function proposeAdminChange(params: ProposeAdminChangeParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [config] = getConfigPDA();

  const tx = await program.methods
    .proposeAdminChange(params.newAdmin)
    .accounts({
      config,
      admin,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN: EXECUTE ADMIN CHANGE (after 48h timelock)
// ============================================

export interface ExecuteAdminChangeParams {
  provider: AnchorProvider;
}

export async function executeAdminChange(params: ExecuteAdminChangeParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [config] = getConfigPDA();

  const tx = await program.methods
    .executeAdminChange()
    .accounts({
      config,
      admin,
    })
    .rpc();

  return tx;
}

// ============================================
// QUERY FUNCTIONS
// ============================================

export async function fetchListing(connection: Connection, listing: PublicKey): Promise<any> {
  const program = new Program(IDL, PROGRAM_ID, { connection } as any);
  return await program.account.listing.fetch(listing);
}

export async function fetchEscrow(connection: Connection, listing: PublicKey): Promise<any> {
  const program = new Program(IDL, PROGRAM_ID, { connection } as any);
  const [escrow] = getEscrowPDA(listing);
  return await program.account.escrow.fetch(escrow);
}

export async function fetchTransaction(connection: Connection, listing: PublicKey): Promise<any> {
  const program = new Program(IDL, PROGRAM_ID, { connection } as any);
  const [transaction] = getTransactionPDA(listing);
  return await program.account.transaction.fetch(transaction);
}

export async function fetchConfig(connection: Connection): Promise<any> {
  const program = new Program(IDL, PROGRAM_ID, { connection } as any);
  const [config] = getConfigPDA();
  return await program.account.marketConfig.fetch(config);
}

export async function fetchOffer(connection: Connection, listing: PublicKey, buyer: PublicKey, offerSeed: number): Promise<any> {
  const program = new Program(IDL, PROGRAM_ID, { connection } as any);
  const [offer] = getOfferPDA(listing, buyer, offerSeed);
  return await program.account.offer.fetch(offer);
}
