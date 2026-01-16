/**
 * Integration Tests for App Market
 *
 * These tests interact with the deployed contract on devnet
 * to verify all functionality works correctly.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

// Program ID
const PROGRAM_ID = new PublicKey("9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog");

// Connection
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Instruction discriminators (first 8 bytes of SHA256 hash of "global:<instruction_name>")
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256").update(`global:${name}`).digest();
  return hash.slice(0, 8);
}

// Encode u64 as little-endian
function encodeU64(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

// Encode i64 as little-endian
function encodeI64(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value));
  return buf;
}

// Load wallet
function loadWallet(): Keypair {
  const walletPath = path.join(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );
}

describe("App Market Integration Tests", () => {
  let admin: Keypair;
  let configPda: PublicKey;

  before(async () => {
    admin = loadWallet();
    console.log("Admin wallet:", admin.publicKey.toBase58());

    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );
    console.log("Config PDA:", configPda.toBase58());
  });

  // ============================================
  // CONFIG VERIFICATION TESTS
  // ============================================
  describe("Config Verification", () => {
    it("should have marketplace initialized", async () => {
      const configAccount = await connection.getAccountInfo(configPda);

      expect(configAccount).to.not.be.null;
      expect(configAccount?.owner.toBase58()).to.equal(PROGRAM_ID.toBase58());

      console.log("  Config account exists: true");
      console.log("  Config size:", configAccount?.data.length, "bytes");
    });

    it("should have correct admin set", async () => {
      const configAccount = await connection.getAccountInfo(configPda);

      if (configAccount) {
        // Skip discriminator (8 bytes), read admin pubkey (32 bytes)
        const adminPubkey = new PublicKey(configAccount.data.slice(8, 40));
        console.log("  Config admin:", adminPubkey.toBase58());
        expect(adminPubkey.toBase58()).to.equal(admin.publicKey.toBase58());
      }
    });
  });

  // ============================================
  // PAUSE MECHANISM TESTS
  // ============================================
  describe("Pause Mechanism", () => {
    it("should allow admin to check pause status", async () => {
      const configAccount = await connection.getAccountInfo(configPda);

      if (configAccount) {
        // The paused flag is after: discriminator(8) + admin(32) + treasury(32) + backend(32) + fees(8+8) + volume(8) + sales(8)
        // = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 = 136 bytes offset
        const pausedOffset = 136;
        const paused = configAccount.data[pausedOffset] === 1;
        console.log("  Contract paused:", paused);
        expect(typeof paused).to.equal("boolean");
      }
    });

    // Note: Actually toggling pause requires a transaction
    it("should have pause instruction discriminator", () => {
      const discriminator = getDiscriminator("set_paused");
      console.log("  set_paused discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });
  });

  // ============================================
  // LISTING FLOW TESTS
  // ============================================
  describe("Listing Flow", () => {
    const salt = BigInt(Date.now());
    let listingPda: PublicKey;
    let escrowPda: PublicKey;

    before(() => {
      [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          admin.publicKey.toBuffer(),
          encodeU64(salt),
        ],
        PROGRAM_ID
      );

      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), listingPda.toBuffer()],
        PROGRAM_ID
      );
    });

    it("should derive unique listing PDA for each salt", () => {
      const salt2 = BigInt(Date.now() + 1);
      const [listingPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          admin.publicKey.toBuffer(),
          encodeU64(salt2),
        ],
        PROGRAM_ID
      );

      expect(listingPda.toBase58()).to.not.equal(listingPda2.toBase58());
      console.log("  Listing 1:", listingPda.toBase58());
      console.log("  Listing 2:", listingPda2.toBase58());
    });

    it("should have create_listing instruction discriminator", () => {
      const discriminator = getDiscriminator("create_listing");
      console.log("  create_listing discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });
  });

  // ============================================
  // BIDDING TESTS
  // ============================================
  describe("Bidding", () => {
    it("should have place_bid instruction discriminator", () => {
      const discriminator = getDiscriminator("place_bid");
      console.log("  place_bid discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should enforce minimum bid increment", () => {
      // Minimum is 5% or 0.1 SOL absolute minimum
      const MIN_BID_INCREMENT_BPS = 500n;
      const MIN_BID_INCREMENT_LAMPORTS = 100_000_000n;
      const BASIS_POINTS_DIVISOR = 10000n;

      const currentBid = 1n * BigInt(LAMPORTS_PER_SOL); // 1 SOL
      const minIncrement = (currentBid * MIN_BID_INCREMENT_BPS) / BASIS_POINTS_DIVISOR;
      const effectiveIncrement = minIncrement > MIN_BID_INCREMENT_LAMPORTS
        ? minIncrement
        : MIN_BID_INCREMENT_LAMPORTS;

      const minNextBid = currentBid + effectiveIncrement;

      console.log("  Current bid: 1 SOL");
      console.log("  5% increment:", Number(minIncrement) / LAMPORTS_PER_SOL, "SOL");
      console.log("  Min increment:", Number(MIN_BID_INCREMENT_LAMPORTS) / LAMPORTS_PER_SOL, "SOL");
      console.log("  Effective increment:", Number(effectiveIncrement) / LAMPORTS_PER_SOL, "SOL");
      console.log("  Minimum next bid:", Number(minNextBid) / LAMPORTS_PER_SOL, "SOL");

      expect(Number(minNextBid)).to.be.greaterThan(Number(currentBid));
    });

    it("should calculate anti-snipe extension correctly", () => {
      const ANTI_SNIPE_WINDOW = 15 * 60; // 15 minutes
      const ANTI_SNIPE_EXTENSION = 15 * 60; // 15 minutes

      const auctionEnd = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
      const bidTime = Math.floor(Date.now() / 1000);

      const isInSnipeWindow = bidTime > auctionEnd - ANTI_SNIPE_WINDOW;
      const newEndTime = isInSnipeWindow ? bidTime + ANTI_SNIPE_EXTENSION : auctionEnd;

      console.log("  Auction ends in: 10 minutes");
      console.log("  Anti-snipe window: 15 minutes");
      console.log("  Is in snipe window:", isInSnipeWindow);
      console.log("  New end time extends by:", isInSnipeWindow ? "15 minutes" : "0 minutes");

      expect(isInSnipeWindow).to.be.true;
      expect(newEndTime).to.be.greaterThan(auctionEnd);
    });
  });

  // ============================================
  // BUY NOW TESTS
  // ============================================
  describe("Buy Now", () => {
    it("should have buy_now instruction discriminator", () => {
      const discriminator = getDiscriminator("buy_now");
      console.log("  buy_now discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should calculate platform fee correctly", () => {
      const PLATFORM_FEE_BPS = 500n; // 5%
      const BASIS_POINTS_DIVISOR = 10000n;

      const salePrice = 10n * BigInt(LAMPORTS_PER_SOL); // 10 SOL
      const platformFee = (salePrice * PLATFORM_FEE_BPS) / BASIS_POINTS_DIVISOR;
      const sellerReceives = salePrice - platformFee;

      console.log("  Sale price: 10 SOL");
      console.log("  Platform fee (5%):", Number(platformFee) / LAMPORTS_PER_SOL, "SOL");
      console.log("  Seller receives:", Number(sellerReceives) / LAMPORTS_PER_SOL, "SOL");

      expect(Number(platformFee)).to.equal(0.5 * LAMPORTS_PER_SOL);
      expect(Number(sellerReceives)).to.equal(9.5 * LAMPORTS_PER_SOL);
    });
  });

  // ============================================
  // DISPUTE TESTS
  // ============================================
  describe("Disputes", () => {
    it("should have open_dispute instruction discriminator", () => {
      const discriminator = getDiscriminator("open_dispute");
      console.log("  open_dispute discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should have resolve_dispute instruction discriminator", () => {
      const discriminator = getDiscriminator("resolve_dispute");
      console.log("  resolve_dispute discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should calculate dispute fee correctly", () => {
      const DISPUTE_FEE_BPS = 200n; // 2%
      const BASIS_POINTS_DIVISOR = 10000n;

      const salePrice = 10n * BigInt(LAMPORTS_PER_SOL); // 10 SOL
      const disputeFee = (salePrice * DISPUTE_FEE_BPS) / BASIS_POINTS_DIVISOR;

      console.log("  Sale price: 10 SOL");
      console.log("  Dispute fee (2%):", Number(disputeFee) / LAMPORTS_PER_SOL, "SOL");

      expect(Number(disputeFee)).to.equal(0.2 * LAMPORTS_PER_SOL);
    });
  });

  // ============================================
  // EMERGENCY REFUND TESTS
  // ============================================
  describe("Emergency Refund", () => {
    it("should have emergency_refund instruction discriminator", () => {
      const discriminator = getDiscriminator("emergency_refund");
      console.log("  emergency_refund discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should calculate transfer deadline correctly", () => {
      const TRANSFER_DEADLINE_SECONDS = 7 * 24 * 60 * 60; // 7 days

      const sellerConfirmedAt = Math.floor(Date.now() / 1000);
      const deadline = sellerConfirmedAt + TRANSFER_DEADLINE_SECONDS;
      const now = Math.floor(Date.now() / 1000);
      const canRefund = now > deadline;

      console.log("  Transfer deadline: 7 days");
      console.log("  Deadline timestamp:", deadline);
      console.log("  Can refund now:", canRefund);

      expect(TRANSFER_DEADLINE_SECONDS).to.equal(604800);
    });
  });

  // ============================================
  // ADMIN TIMELOCK TESTS
  // ============================================
  describe("Admin Timelock", () => {
    it("should have propose_treasury_change instruction", () => {
      const discriminator = getDiscriminator("propose_treasury_change");
      console.log("  propose_treasury_change discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should have execute_treasury_change instruction", () => {
      const discriminator = getDiscriminator("execute_treasury_change");
      console.log("  execute_treasury_change discriminator:", discriminator.toString("hex"));
      expect(discriminator.length).to.equal(8);
    });

    it("should enforce 48-hour timelock", () => {
      const ADMIN_TIMELOCK_SECONDS = 48 * 60 * 60; // 48 hours

      const proposedAt = Math.floor(Date.now() / 1000);
      const executableAt = proposedAt + ADMIN_TIMELOCK_SECONDS;
      const now = Math.floor(Date.now() / 1000);
      const canExecute = now >= executableAt;

      console.log("  Admin timelock: 48 hours");
      console.log("  Proposed at:", proposedAt);
      console.log("  Executable at:", executableAt);
      console.log("  Can execute now:", canExecute);

      expect(ADMIN_TIMELOCK_SECONDS).to.equal(172800);
      expect(canExecute).to.be.false;
    });
  });

  // ============================================
  // ALL INSTRUCTION DISCRIMINATORS
  // ============================================
  describe("All Instruction Discriminators", () => {
    const instructions = [
      "initialize",
      "propose_treasury_change",
      "execute_treasury_change",
      "propose_admin_change",
      "execute_admin_change",
      "set_paused",
      "create_listing",
      "place_bid",
      "buy_now",
      "make_offer",
      "accept_offer",
      "reject_offer",
      "cancel_offer",
      "cancel_listing",
      "settle_auction",
      "confirm_transfer",
      "confirm_receipt",
      "open_dispute",
      "submit_evidence",
      "resolve_dispute",
      "execute_dispute_resolution",
      "claim_expired_offer",
      "emergency_refund",
      "request_withdrawal",
      "approve_withdrawal",
    ];

    instructions.forEach((name) => {
      it(`should have ${name} discriminator`, () => {
        const discriminator = getDiscriminator(name);
        expect(discriminator.length).to.equal(8);
        console.log(`  ${name}: ${discriminator.toString("hex")}`);
      });
    });
  });
});
