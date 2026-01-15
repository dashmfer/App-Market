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
      params.requiredGithubUsername
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

  const tx = await program.methods
    .buyNow()
    .accounts({
      listing: params.listing,
      escrow,
      transaction,
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
  const [config] = getConfigPDA();

  const tx = await program.methods
    .settleAuction()
    .accounts({
      listing: params.listing,
      transaction,
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
}

export async function makeOffer(params: MakeOfferParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [offer] = getOfferPDA(params.listing, buyer);
  const [offerEscrow] = getOfferEscrowPDA(offer);
  const [config] = getConfigPDA();

  const tx = await program.methods
    .makeOffer(solToLamports(params.amount), new BN(params.expiresIn))
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
}

export async function cancelOffer(params: CancelOfferParams): Promise<string> {
  const program = getProgram(params.provider);
  const buyer = params.provider.wallet.publicKey;

  const [offer] = getOfferPDA(params.listing, buyer);
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
}

export async function acceptOffer(params: AcceptOfferParams): Promise<string> {
  const program = getProgram(params.provider);
  const seller = params.provider.wallet.publicKey;

  const [offer] = getOfferPDA(params.listing, params.buyer);
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
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// ============================================
// ADMIN ACTIONS
// ============================================

export interface ResolveDisputeParams {
  provider: AnchorProvider;
  listing: PublicKey;
  seller: PublicKey;
  buyer: PublicKey;
  treasury: PublicKey;
  resolution: "RefundBuyer" | "ReleaseSeller" | "Split";
  sellerAmount: number; // in SOL (for Split resolution)
  buyerAmount: number; // in SOL (for Split resolution)
}

export async function resolveDispute(params: ResolveDisputeParams): Promise<string> {
  const program = getProgram(params.provider);
  const admin = params.provider.wallet.publicKey;

  const [transaction] = getTransactionPDA(params.listing);
  const [dispute] = getDisputePDA(transaction);
  const [escrow] = getEscrowPDA(params.listing);
  const [config] = getConfigPDA();

  let resolutionEnum: any;
  if (params.resolution === "RefundBuyer") {
    resolutionEnum = { refundBuyer: {} };
  } else if (params.resolution === "ReleaseSeller") {
    resolutionEnum = { releaseSeller: {} };
  } else {
    resolutionEnum = { split: {} };
  }

  const tx = await program.methods
    .resolveDispute(
      resolutionEnum,
      solToLamports(params.sellerAmount),
      solToLamports(params.buyerAmount)
    )
    .accounts({
      dispute,
      transaction,
      escrow,
      listing: params.listing,
      seller: params.seller,
      buyer: params.buyer,
      treasury: params.treasury,
      config,
      admin,
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

export async function fetchOffer(connection: Connection, listing: PublicKey, buyer: PublicKey): Promise<any> {
  const program = new Program(IDL, PROGRAM_ID, { connection } as any);
  const [offer] = getOfferPDA(listing, buyer);
  return await program.account.offer.fetch(offer);
}
