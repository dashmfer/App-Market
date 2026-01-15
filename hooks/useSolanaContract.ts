import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  getProgram,
  getConfigPDA,
  getListingPDA,
  getEscrowPDA,
  getTransactionPDA,
  getWithdrawalPDA,
  getOfferPDA,
  getOfferEscrowPDA,
  getDisputePDA,
  PROGRAM_ID,
  solToLamports,
  lamportsToSol
} from "@/lib/solana";
import { useCallback } from "react";

export function useSolanaContract() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Create provider and program instance
  const getProvider = useCallback(() => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: "confirmed" }
    );

    return { provider, program: getProgram(provider) };
  }, [connection, wallet]);

  // Initialize marketplace (admin only)
  const initializeMarketplace = useCallback(async (
    treasuryWallet: PublicKey,
    platformTokenMint: PublicKey,
    platformFeeBps: number,
    disputeFeeBps: number,
    tokenLaunchFeeBps: number
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();

    const tx = await program.methods
      .initialize(
        treasuryWallet,
        platformTokenMint,
        platformFeeBps,
        disputeFeeBps,
        tokenLaunchFeeBps
      )
      .accounts({
        config: configPDA,
        admin: wallet.publicKey!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Create a listing
  const createListing = useCallback(async (
    listingId: string,
    startingPrice: number,
    duration: number,
    reservePrice?: number,
    buyNowPrice?: number
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();

    // Generate salt for PDA
    const salt = Math.floor(Math.random() * 1000000);
    const [listingPDA] = getListingPDA(wallet.publicKey!, salt);

    const tx = await program.methods
      .createListing(
        listingId,
        solToLamports(startingPrice),
        reservePrice ? solToLamports(reservePrice) : null,
        buyNowPrice ? solToLamports(buyNowPrice) : null,
        new BN(duration),
        new BN(salt)
      )
      .accounts({
        listing: listingPDA,
        config: configPDA,
        seller: wallet.publicKey!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, listingPDA: listingPDA.toBase58(), salt };
  }, [getProvider, wallet.publicKey]);

  // Place a bid
  const placeBid = useCallback(async (
    listingPDA: PublicKey,
    bidAmount: number
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();

    // Fetch listing data to get seller and previous bidder
    const listingAccount = await program.account.listing.fetch(listingPDA);

    const accounts: any = {
      listing: listingPDA,
      config: configPDA,
      bidder: wallet.publicKey!,
      seller: listingAccount.seller,
      systemProgram: SystemProgram.programId,
    };

    // Add previous bidder if exists
    if (listingAccount.currentBidder) {
      accounts.previousBidder = listingAccount.currentBidder;
    }

    const tx = await program.methods
      .placeBid(solToLamports(bidAmount))
      .accounts(accounts)
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Buy now (instant purchase)
  const buyNow = useCallback(async (listingPDA: PublicKey) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();
    const [escrowPDA] = getEscrowPDA(listingPDA);
    const [transactionPDA] = getTransactionPDA(listingPDA);

    // Fetch listing data
    const listingAccount = await program.account.listing.fetch(listingPDA);
    const treasuryWallet = (await program.account.config.fetch(configPDA)).treasuryWallet;

    const tx = await program.methods
      .buyNow()
      .accounts({
        listing: listingPDA,
        escrow: escrowPDA,
        transaction: transactionPDA,
        config: configPDA,
        buyer: wallet.publicKey!,
        seller: listingAccount.seller,
        treasuryWallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // End auction (seller or anyone can call after time expires)
  const endAuction = useCallback(async (listingPDA: PublicKey) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();
    const [escrowPDA] = getEscrowPDA(listingPDA);
    const [transactionPDA] = getTransactionPDA(listingPDA);

    // Fetch listing data
    const listingAccount = await program.account.listing.fetch(listingPDA);
    const treasuryWallet = (await program.account.config.fetch(configPDA)).treasuryWallet;

    const tx = await program.methods
      .endAuction()
      .accounts({
        listing: listingPDA,
        escrow: escrowPDA,
        transaction: transactionPDA,
        config: configPDA,
        caller: wallet.publicKey!,
        seller: listingAccount.seller,
        winner: listingAccount.currentBidder!,
        treasuryWallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Confirm transfer (buyer confirms receipt)
  const confirmTransfer = useCallback(async (listingPDA: PublicKey) => {
    const { program } = getProvider();
    const [escrowPDA] = getEscrowPDA(listingPDA);
    const [transactionPDA] = getTransactionPDA(listingPDA);

    // Fetch data
    const listingAccount = await program.account.listing.fetch(listingPDA);
    const transactionAccount = await program.account.transaction.fetch(transactionPDA);

    const tx = await program.methods
      .confirmTransfer()
      .accounts({
        listing: listingPDA,
        escrow: escrowPDA,
        transaction: transactionPDA,
        buyer: wallet.publicKey!,
        seller: listingAccount.seller,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Request withdrawal (seller requests payment)
  const requestWithdrawal = useCallback(async (
    listingPDA: PublicKey,
    amount: number,
    reason: string
  ) => {
    const { program } = getProvider();
    const [transactionPDA] = getTransactionPDA(listingPDA);

    // Get next withdrawal ID
    const transactionAccount = await program.account.transaction.fetch(transactionPDA);
    const withdrawalId = transactionAccount.withdrawalCount.toNumber();
    const [withdrawalPDA] = getWithdrawalPDA(listingPDA, withdrawalId);

    const tx = await program.methods
      .requestWithdrawal(solToLamports(amount), reason)
      .accounts({
        listing: listingPDA,
        transaction: transactionPDA,
        withdrawal: withdrawalPDA,
        seller: wallet.publicKey!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, withdrawalPDA: withdrawalPDA.toBase58(), withdrawalId };
  }, [getProvider, wallet.publicKey]);

  // Approve withdrawal (buyer approves seller's request)
  const approveWithdrawal = useCallback(async (
    listingPDA: PublicKey,
    withdrawalId: number
  ) => {
    const { program } = getProvider();
    const [escrowPDA] = getEscrowPDA(listingPDA);
    const [transactionPDA] = getTransactionPDA(listingPDA);
    const [withdrawalPDA] = getWithdrawalPDA(listingPDA, withdrawalId);

    // Fetch data
    const listingAccount = await program.account.listing.fetch(listingPDA);

    const tx = await program.methods
      .approveWithdrawal()
      .accounts({
        listing: listingPDA,
        escrow: escrowPDA,
        transaction: transactionPDA,
        withdrawal: withdrawalPDA,
        buyer: wallet.publicKey!,
        seller: listingAccount.seller,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Make offer (buyer makes an offer)
  const makeOffer = useCallback(async (
    listingPDA: PublicKey,
    offerAmount: number,
    message: string
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();
    const [offerPDA] = getOfferPDA(listingPDA, wallet.publicKey!);
    const [offerEscrowPDA] = getOfferEscrowPDA(offerPDA);

    // Fetch listing data
    const listingAccount = await program.account.listing.fetch(listingPDA);

    const tx = await program.methods
      .makeOffer(solToLamports(offerAmount), message)
      .accounts({
        listing: listingPDA,
        offer: offerPDA,
        offerEscrow: offerEscrowPDA,
        config: configPDA,
        buyer: wallet.publicKey!,
        seller: listingAccount.seller,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, offerPDA: offerPDA.toBase58() };
  }, [getProvider, wallet.publicKey]);

  // Accept offer (seller accepts buyer's offer)
  const acceptOffer = useCallback(async (
    listingPDA: PublicKey,
    buyerPublicKey: PublicKey
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();
    const [offerPDA] = getOfferPDA(listingPDA, buyerPublicKey);
    const [offerEscrowPDA] = getOfferEscrowPDA(offerPDA);
    const [escrowPDA] = getEscrowPDA(listingPDA);
    const [transactionPDA] = getTransactionPDA(listingPDA);

    // Fetch config for treasury wallet
    const configAccount = await program.account.config.fetch(configPDA);

    const tx = await program.methods
      .acceptOffer()
      .accounts({
        listing: listingPDA,
        offer: offerPDA,
        offerEscrow: offerEscrowPDA,
        escrow: escrowPDA,
        transaction: transactionPDA,
        config: configPDA,
        seller: wallet.publicKey!,
        buyer: buyerPublicKey,
        treasuryWallet: configAccount.treasuryWallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Cancel offer (buyer cancels their offer)
  const cancelOffer = useCallback(async (listingPDA: PublicKey) => {
    const { program } = getProvider();
    const [offerPDA] = getOfferPDA(listingPDA, wallet.publicKey!);
    const [offerEscrowPDA] = getOfferEscrowPDA(offerPDA);

    const tx = await program.methods
      .cancelOffer()
      .accounts({
        listing: listingPDA,
        offer: offerPDA,
        offerEscrow: offerEscrowPDA,
        buyer: wallet.publicKey!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Raise dispute (buyer raises a dispute)
  const raiseDispute = useCallback(async (
    listingPDA: PublicKey,
    reason: string,
    evidence: string
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();
    const [transactionPDA] = getTransactionPDA(listingPDA);
    const [disputePDA] = getDisputePDA(transactionPDA);

    // Fetch listing data
    const listingAccount = await program.account.listing.fetch(listingPDA);

    const tx = await program.methods
      .raiseDispute(reason, evidence)
      .accounts({
        listing: listingPDA,
        transaction: transactionPDA,
        dispute: disputePDA,
        config: configPDA,
        buyer: wallet.publicKey!,
        seller: listingAccount.seller,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, disputePDA: disputePDA.toBase58() };
  }, [getProvider, wallet.publicKey]);

  // Resolve dispute (admin resolves dispute)
  const resolveDispute = useCallback(async (
    listingPDA: PublicKey,
    refundBuyer: boolean,
    resolution: string
  ) => {
    const { program } = getProvider();
    const [configPDA] = getConfigPDA();
    const [escrowPDA] = getEscrowPDA(listingPDA);
    const [transactionPDA] = getTransactionPDA(listingPDA);
    const [disputePDA] = getDisputePDA(transactionPDA);

    // Fetch data
    const listingAccount = await program.account.listing.fetch(listingPDA);
    const transactionAccount = await program.account.transaction.fetch(transactionPDA);

    const tx = await program.methods
      .resolveDispute(refundBuyer, resolution)
      .accounts({
        listing: listingPDA,
        escrow: escrowPDA,
        transaction: transactionPDA,
        dispute: disputePDA,
        config: configPDA,
        admin: wallet.publicKey!,
        buyer: transactionAccount.buyer,
        seller: listingAccount.seller,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Cancel listing (seller cancels listing)
  const cancelListing = useCallback(async (listingPDA: PublicKey) => {
    const { program } = getProvider();

    // Fetch listing to get previous bidder if any
    const listingAccount = await program.account.listing.fetch(listingPDA);

    const accounts: any = {
      listing: listingPDA,
      seller: wallet.publicKey!,
      systemProgram: SystemProgram.programId,
    };

    // Add previous bidder if exists for refund
    if (listingAccount.currentBidder) {
      accounts.previousBidder = listingAccount.currentBidder;
    }

    const tx = await program.methods
      .cancelListing()
      .accounts(accounts)
      .rpc();

    return tx;
  }, [getProvider, wallet.publicKey]);

  // Fetch listing data
  const fetchListing = useCallback(async (listingPDA: PublicKey) => {
    const { program } = getProvider();
    const listing = await program.account.listing.fetch(listingPDA);

    return {
      seller: listing.seller,
      listingId: listing.listingId,
      startingPrice: lamportsToSol(listing.startingPrice),
      reservePrice: listing.reservePrice ? lamportsToSol(listing.reservePrice) : null,
      buyNowPrice: listing.buyNowPrice ? lamportsToSol(listing.buyNowPrice) : null,
      currentBid: lamportsToSol(listing.currentBid),
      currentBidder: listing.currentBidder,
      startTime: listing.startTime.toNumber(),
      endTime: listing.endTime.toNumber(),
      status: listing.status,
      bump: listing.bump,
    };
  }, [getProvider]);

  // Fetch transaction data
  const fetchTransaction = useCallback(async (transactionPDA: PublicKey) => {
    const { program } = getProvider();
    const transaction = await program.account.transaction.fetch(transactionPDA);

    return {
      listing: transaction.listing,
      buyer: transaction.buyer,
      seller: transaction.seller,
      amount: lamportsToSol(transaction.amount),
      platformFee: lamportsToSol(transaction.platformFee),
      status: transaction.status,
      createdAt: transaction.createdAt.toNumber(),
      completedAt: transaction.completedAt ? transaction.completedAt.toNumber() : null,
      withdrawalCount: transaction.withdrawalCount.toNumber(),
      bump: transaction.bump,
    };
  }, [getProvider]);

  // Fetch offer data
  const fetchOffer = useCallback(async (offerPDA: PublicKey) => {
    const { program } = getProvider();
    const offer = await program.account.offer.fetch(offerPDA);

    return {
      listing: offer.listing,
      buyer: offer.buyer,
      seller: offer.seller,
      amount: lamportsToSol(offer.amount),
      message: offer.message,
      status: offer.status,
      createdAt: offer.createdAt.toNumber(),
      expiresAt: offer.expiresAt.toNumber(),
      bump: offer.bump,
    };
  }, [getProvider]);

  // Fetch all listings for a seller
  const fetchSellerListings = useCallback(async (sellerPublicKey: PublicKey) => {
    const { program } = getProvider();
    const listings = await program.account.listing.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: sellerPublicKey.toBase58(),
        },
      },
    ]);

    return listings.map(({ publicKey, account }) => ({
      publicKey: publicKey.toBase58(),
      ...account,
      startingPrice: lamportsToSol(account.startingPrice),
      currentBid: lamportsToSol(account.currentBid),
      reservePrice: account.reservePrice ? lamportsToSol(account.reservePrice) : null,
      buyNowPrice: account.buyNowPrice ? lamportsToSol(account.buyNowPrice) : null,
      startTime: account.startTime.toNumber(),
      endTime: account.endTime.toNumber(),
    }));
  }, [getProvider]);

  // Fetch all active listings
  const fetchActiveListings = useCallback(async () => {
    const { program } = getProvider();
    const listings = await program.account.listing.all([
      {
        memcmp: {
          offset: 8 + 32 + 64 + 1, // discriminator + seller pubkey + listingId (estimate)
          bytes: Buffer.from([0]).toString('base64'), // ListingStatus::Active = 0
        },
      },
    ]);

    return listings.map(({ publicKey, account }) => ({
      publicKey: publicKey.toBase58(),
      ...account,
      startingPrice: lamportsToSol(account.startingPrice),
      currentBid: lamportsToSol(account.currentBid),
      reservePrice: account.reservePrice ? lamportsToSol(account.reservePrice) : null,
      buyNowPrice: account.buyNowPrice ? lamportsToSol(account.buyNowPrice) : null,
      startTime: account.startTime.toNumber(),
      endTime: account.endTime.toNumber(),
    }));
  }, [getProvider]);

  return {
    // Initialization
    initializeMarketplace,

    // Listing operations
    createListing,
    cancelListing,
    fetchListing,
    fetchSellerListings,
    fetchActiveListings,

    // Bidding operations
    placeBid,
    buyNow,
    endAuction,

    // Transaction operations
    confirmTransfer,
    requestWithdrawal,
    approveWithdrawal,
    fetchTransaction,

    // Offer operations
    makeOffer,
    acceptOffer,
    cancelOffer,
    fetchOffer,

    // Dispute operations
    raiseDispute,
    resolveDispute,
  };
}
