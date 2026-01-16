import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Program ID (deployed to devnet)
const PROGRAM_ID = new PublicKey("9udUgupraga6dj92zfLec8bAdXUZsU3FGNN3Lf8XGzog");

// Treasury wallet to receive platform fees
const TREASURY_WALLET = new PublicKey("3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6");

// Fee settings (basis points)
const PLATFORM_FEE_BPS = 500; // 5%
const DISPUTE_FEE_BPS = 200;  // 2%

// Calculate Anchor instruction discriminator (first 8 bytes of SHA256 hash of "global:<instruction_name>")
function getInstructionDiscriminator(name: string): Buffer {
  const preimage = `global:${name}`;
  const hash = crypto.createHash("sha256").update(preimage).digest();
  return hash.slice(0, 8);
}

// Encode a u64 as little-endian bytes
function encodeU64(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

async function main() {
  console.log("Initializing App Market on Devnet...\n");

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  console.log("Connected to Solana devnet");

  // Load wallet from default Solana CLI location
  const walletPath = path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    ".config/solana/id.json"
  );

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}. Please run 'solana-keygen new' first.`);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );

  console.log(`Loaded wallet: ${walletKeypair.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`   Balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log("\nLow balance! Requesting airdrop...");
    const sig = await connection.requestAirdrop(walletKeypair.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log("Airdrop complete!");
  }

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log(`\nConfig PDA: ${configPda.toBase58()}`);

  // Check if already initialized by checking if account exists
  const configAccount = await connection.getAccountInfo(configPda);
  if (configAccount !== null) {
    console.log("\nMarketplace is already initialized!");
    console.log("   Config account exists with", configAccount.data.length, "bytes");
    return;
  }

  console.log("   Config account not found - proceeding with initialization");

  // Backend authority (using admin wallet for now)
  const backendAuthority = walletKeypair.publicKey;

  console.log("\nInitialization Parameters:");
  console.log("   Admin:", walletKeypair.publicKey.toBase58());
  console.log("   Treasury:", TREASURY_WALLET.toBase58());
  console.log("   Backend Authority:", backendAuthority.toBase58());
  console.log("   Platform Fee:", PLATFORM_FEE_BPS, "bps (5%)");
  console.log("   Dispute Fee:", DISPUTE_FEE_BPS, "bps (2%)");

  // Build the instruction data
  // Format: [8-byte discriminator][u64 platform_fee_bps][u64 dispute_fee_bps][32-byte backend_authority]
  const discriminator = getInstructionDiscriminator("initialize");
  const instructionData = Buffer.concat([
    discriminator,
    encodeU64(PLATFORM_FEE_BPS),
    encodeU64(DISPUTE_FEE_BPS),
    backendAuthority.toBuffer(),
  ]);

  // Create the instruction
  const initializeIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: TREASURY_WALLET, isSigner: false, isWritable: false },
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });

  // Create and send transaction
  console.log("\nSending initialize transaction...");

  try {
    const transaction = new Transaction().add(initializeIx);
    transaction.feePayer = walletKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    transaction.sign(walletKeypair);

    const txSignature = await connection.sendRawTransaction(transaction.serialize());
    console.log("\nTransaction sent:", txSignature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txSignature, "confirmed");

    if (confirmation.value.err) {
      console.error("\nTransaction failed:", confirmation.value.err);
      return;
    }

    console.log("\nMarketplace initialized successfully!");
    console.log("   Transaction:", txSignature);
    console.log("   Explorer: https://explorer.solana.com/tx/" + txSignature + "?cluster=devnet");

    // Verify the account was created
    const newConfigAccount = await connection.getAccountInfo(configPda);
    if (newConfigAccount) {
      console.log("\nConfig account created with", newConfigAccount.data.length, "bytes");
    }

  } catch (error: any) {
    console.error("\nError initializing marketplace:");
    console.error(error.message || error);

    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
