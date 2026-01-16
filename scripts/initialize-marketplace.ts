import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, BN, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// Program ID (deployed to devnet)
const PROGRAM_ID = new PublicKey("9rJdJg5NNNk7iELme83LXMDRasqtsdBdaGqWyPGQK93Y");

// Treasury wallet to receive platform fees
const TREASURY_WALLET = new PublicKey("3BU9NRDpXqw7h8wed1aTxERk4cg5hajsbH4nFfVgYkJ6");

// Fee settings (basis points)
const PLATFORM_FEE_BPS = 500; // 5%
const DISPUTE_FEE_BPS = 200;  // 2%

// Load IDL
const IDL = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../target/idl/app_market.json"),
    "utf8"
  )
);

async function main() {
  console.log("🚀 Initializing App Market on Devnet...\n");

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  console.log("✅ Connected to Solana devnet");

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

  const wallet = new Wallet(walletKeypair);
  console.log(`✅ Loaded wallet: ${wallet.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`   Balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log("\n⚠️  Low balance! Requesting airdrop...");
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log("✅ Airdrop complete!");
  }

  // Create provider
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Create program instance
  const program = new Program(IDL, PROGRAM_ID, provider);
  console.log(`✅ Program loaded: ${PROGRAM_ID.toBase58()}`);

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log(`\n📍 Config PDA: ${configPda.toBase58()}`);

  // Check if already initialized
  try {
    const existingConfig = await program.account.marketConfig.fetch(configPda);
    console.log("\n⚠️  Marketplace is already initialized!");
    console.log("   Admin:", existingConfig.admin.toBase58());
    console.log("   Treasury:", existingConfig.treasury.toBase58());
    console.log("   Platform Fee:", existingConfig.platformFeeBps.toString(), "bps");
    console.log("   Dispute Fee:", existingConfig.disputeFeeBps.toString(), "bps");
    console.log("   Total Volume:", existingConfig.totalVolume.toString());
    console.log("   Total Sales:", existingConfig.totalSales.toString());
    console.log("   Paused:", existingConfig.paused);
    return;
  } catch (e) {
    // Not initialized yet, continue
    console.log("   Config account not found - proceeding with initialization");
  }

  // Backend authority (using admin wallet for now - you can change this)
  const backendAuthority = wallet.publicKey;

  console.log("\n📝 Initialization Parameters:");
  console.log("   Admin:", wallet.publicKey.toBase58());
  console.log("   Treasury:", TREASURY_WALLET.toBase58());
  console.log("   Backend Authority:", backendAuthority.toBase58());
  console.log("   Platform Fee:", PLATFORM_FEE_BPS, "bps (5%)");
  console.log("   Dispute Fee:", DISPUTE_FEE_BPS, "bps (2%)");

  // Initialize the marketplace
  console.log("\n⏳ Sending initialize transaction...");

  try {
    const tx = await program.methods
      .initialize(
        new BN(PLATFORM_FEE_BPS),
        new BN(DISPUTE_FEE_BPS),
        backendAuthority
      )
      .accounts({
        config: configPda,
        treasury: TREASURY_WALLET,
        admin: wallet.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc();

    console.log("\n✅ Marketplace initialized successfully!");
    console.log("   Transaction:", tx);
    console.log("   Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");

    // Fetch and display the config
    const config = await program.account.marketConfig.fetch(configPda);
    console.log("\n📊 Marketplace Config:");
    console.log("   Admin:", config.admin.toBase58());
    console.log("   Treasury:", config.treasury.toBase58());
    console.log("   Backend Authority:", config.backendAuthority.toBase58());
    console.log("   Platform Fee:", config.platformFeeBps.toString(), "bps");
    console.log("   Dispute Fee:", config.disputeFeeBps.toString(), "bps");
    console.log("   Paused:", config.paused);

  } catch (error: any) {
    console.error("\n❌ Error initializing marketplace:");
    console.error(error.message || error);

    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main().catch(console.error);
