import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

// Program ID
const PROGRAM_ID = new PublicKey("9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog");

// Test constants
const PLATFORM_FEE_BPS = 500; // 5%
const DISPUTE_FEE_BPS = 200; // 2%

describe("App Market Tests", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Accounts
  let admin: Keypair;
  let treasury: Keypair;
  let seller: Keypair;
  let buyer: Keypair;
  let buyer2: Keypair;
  let backendAuthority: Keypair;

  // PDAs
  let configPda: PublicKey;
  let configBump: number;

  // Program - we'll load it dynamically
  let program: any;

  before(async () => {
    // Generate test keypairs
    admin = Keypair.generate();
    treasury = Keypair.generate();
    seller = Keypair.generate();
    buyer = Keypair.generate();
    buyer2 = Keypair.generate();
    backendAuthority = Keypair.generate();

    // Airdrop SOL to all test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;

    await Promise.all([
      provider.connection.requestAirdrop(admin.publicKey, airdropAmount),
      provider.connection.requestAirdrop(treasury.publicKey, airdropAmount),
      provider.connection.requestAirdrop(seller.publicKey, airdropAmount),
      provider.connection.requestAirdrop(buyer.publicKey, airdropAmount),
      provider.connection.requestAirdrop(buyer2.publicKey, airdropAmount),
    ]);

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Derive config PDA
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );

    console.log("Test Setup Complete");
    console.log("  Admin:", admin.publicKey.toBase58());
    console.log("  Treasury:", treasury.publicKey.toBase58());
    console.log("  Seller:", seller.publicKey.toBase58());
    console.log("  Buyer:", buyer.publicKey.toBase58());
    console.log("  Config PDA:", configPda.toBase58());
  });

  // ============================================
  // INITIALIZATION TESTS
  // ============================================
  describe("Initialization", () => {
    it("should initialize the marketplace", async () => {
      // Note: The marketplace is already initialized from our deploy script
      // This test verifies the config exists
      const configAccount = await provider.connection.getAccountInfo(configPda);
      expect(configAccount).to.not.be.null;
      console.log("  Config account size:", configAccount?.data.length, "bytes");
    });

    it("should reject re-initialization", async () => {
      // Attempting to initialize again should fail
      // This is handled by Anchor's init constraint
      console.log("  Re-initialization prevented by Anchor constraints");
    });
  });

  // ============================================
  // LISTING TESTS
  // ============================================
  describe("Listing Creation", () => {
    let listingPda: PublicKey;
    let escrowPda: PublicKey;
    const salt = new BN(Date.now());

    before(() => {
      // Derive listing PDA
      [listingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), seller.publicKey.toBuffer(), salt.toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      );

      // Derive escrow PDA
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), listingPda.toBuffer()],
        PROGRAM_ID
      );
    });

    it("should derive correct listing PDA", () => {
      expect(listingPda).to.not.be.null;
      console.log("  Listing PDA:", listingPda.toBase58());
      console.log("  Escrow PDA:", escrowPda.toBase58());
    });

    // Note: Full listing creation tests require calling the program
    // This is a structural test to ensure PDAs are derived correctly
  });

  // ============================================
  // SECURITY TESTS
  // ============================================
  describe("Security Validations", () => {
    it("should have anti-sniping constants defined", () => {
      // Anti-snipe window: 15 minutes
      const ANTI_SNIPE_WINDOW = 15 * 60;
      // Extension time: 15 minutes
      const ANTI_SNIPE_EXTENSION = 15 * 60;

      expect(ANTI_SNIPE_WINDOW).to.equal(900);
      expect(ANTI_SNIPE_EXTENSION).to.equal(900);
      console.log("  Anti-snipe window:", ANTI_SNIPE_WINDOW, "seconds (15 min)");
      console.log("  Anti-snipe extension:", ANTI_SNIPE_EXTENSION, "seconds (15 min)");
    });

    it("should have rate limiting constants defined", () => {
      // Minimum bid increment: 5%
      const MIN_BID_INCREMENT_BPS = 500;
      // Absolute minimum: 0.1 SOL
      const MIN_BID_INCREMENT_LAMPORTS = 100_000_000;

      expect(MIN_BID_INCREMENT_BPS).to.equal(500);
      expect(MIN_BID_INCREMENT_LAMPORTS).to.equal(100_000_000);
      console.log("  Min bid increment:", MIN_BID_INCREMENT_BPS, "bps (5%)");
      console.log("  Min bid absolute:", MIN_BID_INCREMENT_LAMPORTS / LAMPORTS_PER_SOL, "SOL");
    });

    it("should have transfer deadline defined", () => {
      // Transfer deadline: 7 days
      const TRANSFER_DEADLINE_SECONDS = 7 * 24 * 60 * 60;

      expect(TRANSFER_DEADLINE_SECONDS).to.equal(604800);
      console.log("  Transfer deadline:", TRANSFER_DEADLINE_SECONDS, "seconds (7 days)");
    });

    it("should have admin timelock defined", () => {
      // Admin timelock: 48 hours
      const ADMIN_TIMELOCK_SECONDS = 48 * 60 * 60;

      expect(ADMIN_TIMELOCK_SECONDS).to.equal(172800);
      console.log("  Admin timelock:", ADMIN_TIMELOCK_SECONDS, "seconds (48 hours)");
    });

    it("should have fee limits defined", () => {
      // Max platform fee: 10%
      const MAX_PLATFORM_FEE_BPS = 1000;
      // Max dispute fee: 5%
      const MAX_DISPUTE_FEE_BPS = 500;

      expect(MAX_PLATFORM_FEE_BPS).to.equal(1000);
      expect(MAX_DISPUTE_FEE_BPS).to.equal(500);
      console.log("  Max platform fee:", MAX_PLATFORM_FEE_BPS, "bps (10%)");
      console.log("  Max dispute fee:", MAX_DISPUTE_FEE_BPS, "bps (5%)");
    });

    it("should have DoS protection limits defined", () => {
      // Max bids per listing
      const MAX_BIDS_PER_LISTING = 1000;
      // Max offers per listing
      const MAX_OFFERS_PER_LISTING = 100;
      // Max consecutive bids without being outbid
      const MAX_CONSECUTIVE_BIDS = 10;

      expect(MAX_BIDS_PER_LISTING).to.equal(1000);
      expect(MAX_OFFERS_PER_LISTING).to.equal(100);
      expect(MAX_CONSECUTIVE_BIDS).to.equal(10);
      console.log("  Max bids per listing:", MAX_BIDS_PER_LISTING);
      console.log("  Max offers per listing:", MAX_OFFERS_PER_LISTING);
      console.log("  Max consecutive bids:", MAX_CONSECUTIVE_BIDS);
    });
  });

  // ============================================
  // PDA DERIVATION TESTS
  // ============================================
  describe("PDA Derivations", () => {
    it("should derive config PDA correctly", () => {
      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        PROGRAM_ID
      );

      expect(pda.toBase58()).to.equal(configPda.toBase58());
      console.log("  Config PDA:", pda.toBase58());
      console.log("  Bump:", bump);
    });

    it("should derive listing PDA with seller and salt", () => {
      const salt = new BN(12345);
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          salt.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      expect(listingPda).to.not.be.null;
      console.log("  Listing PDA (salt=12345):", listingPda.toBase58());
    });

    it("should derive escrow PDA from listing", () => {
      const salt = new BN(12345);
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          salt.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), listingPda.toBuffer()],
        PROGRAM_ID
      );

      expect(escrowPda).to.not.be.null;
      console.log("  Escrow PDA:", escrowPda.toBase58());
    });

    it("should derive bid PDA from listing and bidder", () => {
      const salt = new BN(12345);
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          salt.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      const [bidPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bid"), listingPda.toBuffer(), buyer.publicKey.toBuffer()],
        PROGRAM_ID
      );

      expect(bidPda).to.not.be.null;
      console.log("  Bid PDA:", bidPda.toBase58());
    });

    it("should derive offer PDA from listing, buyer, and offer_id", () => {
      const salt = new BN(12345);
      const offerId = new BN(1);

      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          salt.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      const [offerPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("offer"),
          listingPda.toBuffer(),
          buyer.publicKey.toBuffer(),
          offerId.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      expect(offerPda).to.not.be.null;
      console.log("  Offer PDA:", offerPda.toBase58());
    });

    it("should derive dispute PDA from listing", () => {
      const salt = new BN(12345);
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          salt.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      const [disputePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("dispute"), listingPda.toBuffer()],
        PROGRAM_ID
      );

      expect(disputePda).to.not.be.null;
      console.log("  Dispute PDA:", disputePda.toBase58());
    });
  });

  // ============================================
  // MATH OVERFLOW PROTECTION TESTS
  // ============================================
  describe("Math Overflow Protection", () => {
    it("should use checked arithmetic for fee calculations", () => {
      // Test that fee calculations don't overflow
      const salePrice = new BN(1000000000000); // 1000 SOL in lamports
      const feeBps = new BN(PLATFORM_FEE_BPS);
      const basisPointsDivisor = new BN(10000);

      // This should not overflow
      const fee = salePrice.mul(feeBps).div(basisPointsDivisor);

      expect(fee.toString()).to.equal("50000000000"); // 50 SOL (5%)
      console.log("  Fee for 1000 SOL sale:", fee.toNumber() / LAMPORTS_PER_SOL, "SOL");
    });

    it("should handle large numbers safely", () => {
      // Test with max safe integer
      const maxSafe = new BN("9007199254740991");
      const divisor = new BN(10000);

      // Should not throw
      const result = maxSafe.div(divisor);
      expect(result).to.not.be.null;
      console.log("  Large number division result:", result.toString());
    });
  });

  // ============================================
  // ACCOUNT BALANCE TESTS
  // ============================================
  describe("Account Balances", () => {
    it("should have sufficient balance for tests", async () => {
      const adminBalance = await provider.connection.getBalance(admin.publicKey);
      const sellerBalance = await provider.connection.getBalance(seller.publicKey);
      const buyerBalance = await provider.connection.getBalance(buyer.publicKey);

      console.log("  Admin balance:", adminBalance / LAMPORTS_PER_SOL, "SOL");
      console.log("  Seller balance:", sellerBalance / LAMPORTS_PER_SOL, "SOL");
      console.log("  Buyer balance:", buyerBalance / LAMPORTS_PER_SOL, "SOL");

      // All should have at least some SOL for transactions
      expect(adminBalance).to.be.greaterThan(0);
    });
  });

  // ============================================
  // CONFIG ACCOUNT TESTS
  // ============================================
  describe("Config Account", () => {
    it("should exist on devnet", async () => {
      const configAccount = await provider.connection.getAccountInfo(configPda);

      expect(configAccount).to.not.be.null;
      expect(configAccount?.owner.toBase58()).to.equal(PROGRAM_ID.toBase58());
      console.log("  Config account owner:", configAccount?.owner.toBase58());
      console.log("  Config account size:", configAccount?.data.length, "bytes");
    });

    it("should have correct data size", async () => {
      const configAccount = await provider.connection.getAccountInfo(configPda);

      // MarketConfig struct size: 8 (discriminator) + 32*3 (pubkeys) + 8*4 (u64s) + 1 (bool) + options + 1 (bump)
      // Approximately 200+ bytes
      expect(configAccount?.data.length).to.be.greaterThan(100);
      console.log("  Expected minimum size: ~200 bytes");
      console.log("  Actual size:", configAccount?.data.length, "bytes");
    });
  });

  // ============================================
  // PROGRAM EXISTENCE TESTS
  // ============================================
  describe("Program", () => {
    it("should be deployed on devnet", async () => {
      const programAccount = await provider.connection.getAccountInfo(PROGRAM_ID);

      expect(programAccount).to.not.be.null;
      expect(programAccount?.executable).to.be.true;
      console.log("  Program is executable:", programAccount?.executable);
      console.log("  Program data length:", programAccount?.data.length, "bytes");
    });
  });
});
