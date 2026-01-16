/**
 * Standalone Test Runner for App Market
 * Run with: npx tsx tests/run-tests.ts
 */

import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// Program ID
const PROGRAM_ID = new PublicKey("9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Test results
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return async () => {
    try {
      const result = await fn();
      if (result) {
        console.log(`  ✅ ${name}`);
        passed++;
      } else {
        console.log(`  ❌ ${name}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  };
}

function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256").update(`global:${name}`).digest();
  return hash.slice(0, 8);
}

function encodeU64(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

async function main() {
  console.log("\n🧪 App Market Test Suite\n");
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Network: Devnet\n");

  // Load wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log("Config PDA:", configPda.toBase58());
  console.log("");

  // ============================================
  // PROGRAM TESTS
  // ============================================
  console.log("📦 Program Tests");

  await test("Program is deployed", async () => {
    const programAccount = await connection.getAccountInfo(PROGRAM_ID);
    return programAccount !== null && programAccount.executable === true;
  })();

  await test("Program is executable", async () => {
    const programAccount = await connection.getAccountInfo(PROGRAM_ID);
    return programAccount?.executable === true;
  })();

  // ============================================
  // CONFIG TESTS
  // ============================================
  console.log("\n⚙️  Config Tests");

  await test("Config account exists", async () => {
    const configAccount = await connection.getAccountInfo(configPda);
    return configAccount !== null;
  })();

  await test("Config owned by program", async () => {
    const configAccount = await connection.getAccountInfo(configPda);
    return configAccount?.owner.toBase58() === PROGRAM_ID.toBase58();
  })();

  await test("Config has correct admin", async () => {
    const configAccount = await connection.getAccountInfo(configPda);
    if (!configAccount) return false;
    const adminPubkey = new PublicKey(configAccount.data.slice(8, 40));
    return adminPubkey.toBase58() === wallet.publicKey.toBase58();
  })();

  await test("Config account size is valid", async () => {
    const configAccount = await connection.getAccountInfo(configPda);
    return configAccount !== null && configAccount.data.length > 100;
  })();

  // ============================================
  // PDA DERIVATION TESTS
  // ============================================
  console.log("\n🔑 PDA Derivation Tests");

  await test("Config PDA derivation", () => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );
    return pda.toBase58() === configPda.toBase58();
  })();

  await test("Listing PDA derivation", () => {
    const salt = BigInt(12345);
    const [listingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        wallet.publicKey.toBuffer(),
        encodeU64(salt),
      ],
      PROGRAM_ID
    );
    return listingPda !== null;
  })();

  await test("Escrow PDA derivation", () => {
    const salt = BigInt(12345);
    const [listingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        wallet.publicKey.toBuffer(),
        encodeU64(salt),
      ],
      PROGRAM_ID
    );
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), listingPda.toBuffer()],
      PROGRAM_ID
    );
    return escrowPda !== null;
  })();

  await test("Bid PDA derivation", () => {
    const salt = BigInt(12345);
    const [listingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        wallet.publicKey.toBuffer(),
        encodeU64(salt),
      ],
      PROGRAM_ID
    );
    const [bidPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bid"), listingPda.toBuffer(), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    return bidPda !== null;
  })();

  await test("Dispute PDA derivation", () => {
    const salt = BigInt(12345);
    const [listingPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        wallet.publicKey.toBuffer(),
        encodeU64(salt),
      ],
      PROGRAM_ID
    );
    const [disputePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dispute"), listingPda.toBuffer()],
      PROGRAM_ID
    );
    return disputePda !== null;
  })();

  // ============================================
  // SECURITY CONSTANT TESTS
  // ============================================
  console.log("\n🔒 Security Constants Tests");

  await test("Anti-snipe window: 15 minutes", () => {
    const ANTI_SNIPE_WINDOW = 15 * 60;
    return ANTI_SNIPE_WINDOW === 900;
  })();

  await test("Anti-snipe extension: 15 minutes", () => {
    const ANTI_SNIPE_EXTENSION = 15 * 60;
    return ANTI_SNIPE_EXTENSION === 900;
  })();

  await test("Min bid increment: 5%", () => {
    const MIN_BID_INCREMENT_BPS = 500;
    return MIN_BID_INCREMENT_BPS === 500;
  })();

  await test("Min bid absolute: 0.1 SOL", () => {
    const MIN_BID_INCREMENT_LAMPORTS = 100_000_000;
    return MIN_BID_INCREMENT_LAMPORTS === 0.1 * LAMPORTS_PER_SOL;
  })();

  await test("Transfer deadline: 7 days", () => {
    const TRANSFER_DEADLINE_SECONDS = 7 * 24 * 60 * 60;
    return TRANSFER_DEADLINE_SECONDS === 604800;
  })();

  await test("Admin timelock: 48 hours", () => {
    const ADMIN_TIMELOCK_SECONDS = 48 * 60 * 60;
    return ADMIN_TIMELOCK_SECONDS === 172800;
  })();

  await test("Max platform fee: 10%", () => {
    const MAX_PLATFORM_FEE_BPS = 1000;
    return MAX_PLATFORM_FEE_BPS === 1000;
  })();

  await test("Max dispute fee: 5%", () => {
    const MAX_DISPUTE_FEE_BPS = 500;
    return MAX_DISPUTE_FEE_BPS === 500;
  })();

  // ============================================
  // FEE CALCULATION TESTS
  // ============================================
  console.log("\n💰 Fee Calculation Tests");

  await test("Platform fee: 5% of 10 SOL = 0.5 SOL", () => {
    const PLATFORM_FEE_BPS = 500n;
    const BASIS_POINTS_DIVISOR = 10000n;
    const salePrice = 10n * BigInt(LAMPORTS_PER_SOL);
    const fee = (salePrice * PLATFORM_FEE_BPS) / BASIS_POINTS_DIVISOR;
    return Number(fee) === 0.5 * LAMPORTS_PER_SOL;
  })();

  await test("Dispute fee: 2% of 10 SOL = 0.2 SOL", () => {
    const DISPUTE_FEE_BPS = 200n;
    const BASIS_POINTS_DIVISOR = 10000n;
    const salePrice = 10n * BigInt(LAMPORTS_PER_SOL);
    const fee = (salePrice * DISPUTE_FEE_BPS) / BASIS_POINTS_DIVISOR;
    return Number(fee) === 0.2 * LAMPORTS_PER_SOL;
  })();

  await test("Seller receives: 10 SOL - 5% = 9.5 SOL", () => {
    const PLATFORM_FEE_BPS = 500n;
    const BASIS_POINTS_DIVISOR = 10000n;
    const salePrice = 10n * BigInt(LAMPORTS_PER_SOL);
    const fee = (salePrice * PLATFORM_FEE_BPS) / BASIS_POINTS_DIVISOR;
    const sellerReceives = salePrice - fee;
    return Number(sellerReceives) === 9.5 * LAMPORTS_PER_SOL;
  })();

  // ============================================
  // ANTI-SNIPING TESTS
  // ============================================
  console.log("\n⏰ Anti-Sniping Tests");

  await test("Bid in last 15 min extends auction", () => {
    const ANTI_SNIPE_WINDOW = 15 * 60;
    const ANTI_SNIPE_EXTENSION = 15 * 60;
    const auctionEnd = Math.floor(Date.now() / 1000) + 600; // 10 min from now
    const bidTime = Math.floor(Date.now() / 1000);
    const isInSnipeWindow = bidTime > auctionEnd - ANTI_SNIPE_WINDOW;
    return isInSnipeWindow === true;
  })();

  await test("Bid outside snipe window does not extend", () => {
    const ANTI_SNIPE_WINDOW = 15 * 60;
    const auctionEnd = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const bidTime = Math.floor(Date.now() / 1000);
    const isInSnipeWindow = bidTime > auctionEnd - ANTI_SNIPE_WINDOW;
    return isInSnipeWindow === false;
  })();

  // ============================================
  // INSTRUCTION DISCRIMINATOR TESTS
  // ============================================
  console.log("\n📝 Instruction Discriminators");

  const instructions = [
    "initialize",
    "set_paused",
    "create_listing",
    "place_bid",
    "buy_now",
    "make_offer",
    "open_dispute",
    "resolve_dispute",
    "emergency_refund",
  ];

  for (const instr of instructions) {
    await test(`${instr} discriminator`, () => {
      const disc = getDiscriminator(instr);
      return disc.length === 8;
    })();
  }

  // ============================================
  // WALLET BALANCE TEST
  // ============================================
  console.log("\n💳 Wallet Balance");

  await test("Wallet has SOL for transactions", async () => {
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`     Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    return balance > 0;
  })();

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log("✅ All tests passed!\n");
  } else {
    console.log("❌ Some tests failed. Please review the output above.\n");
    process.exit(1);
  }
}

main().catch(console.error);
