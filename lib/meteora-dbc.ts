/**
 * Meteora Dynamic Bonding Curve (DBC) Integration
 *
 * Powers the PATO (Post-Acquisition Token Offering) feature.
 * Handles pool creation, fee claims, and pool state queries.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  DynamicBondingCurveClient,
  TokenDecimal,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { getConnection } from "@/lib/solana";

// ============================================
// CONSTANTS
// ============================================

// Meteora DBC program
export const DBC_PROGRAM_ID = DYNAMIC_BONDING_CURVE_PROGRAM_ID;

// wSOL mint (quote token for all PATO launches)
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// ============================================
// PATO CONFIG (matches agreed parameters)
// ============================================

export const PATO_CONFIG = {
  // Bonding curve trading fee: 1% (100 bps)
  tradingFeeBps: 100,
  // Fee numerator for DBC: 1% = 10,000,000 / 1,000,000,000
  cliffFeeNumerator: new BN(10_000_000),

  // Creator gets 50% of partner's 80% share (= 0.4% of volume)
  creatorTradingFeePercentage: 50,

  // Graduation threshold: 500 SOL
  graduationThresholdSOL: 500,
  migrationQuoteThreshold: new BN(500 * LAMPORTS_PER_SOL),

  // Post-graduation: DAMM v2 with 1% fee
  migrationOption: 1, // MigrationOption.DammV2
  migrationFeeOption: 2, // MigrationFeeOption.FixedBps100 (1%)

  // LP lock: 50/50 permanently locked, 0% claimable
  partnerLockedLpPct: 50,
  creatorLockedLpPct: 50,
  partnerClaimableLpPct: 0,
  creatorClaimableLpPct: 0,

  // Token config
  totalSupply: new BN("1000000000000000000"), // 1 billion tokens with 9 decimals
  tokenDecimals: 9,

  // Activation: immediate
  activationType: 0, // ActivationType.Slot

  // Vanity suffix
  vanitySuffix: "app",
} as const;

// ============================================
// CLIENT SINGLETON
// ============================================

let _dbcClient: DynamicBondingCurveClient | null = null;

export function getDbcClient(): DynamicBondingCurveClient {
  if (!_dbcClient) {
    const connection = getConnection();
    _dbcClient = DynamicBondingCurveClient.create(connection, "confirmed");
  }
  return _dbcClient;
}

// ============================================
// CONFIG KEY MANAGEMENT
// ============================================

/**
 * Get the platform's DBC config key from environment.
 * This is the on-chain config key created once for the App Market launchpad.
 */
export function getPatoConfigKey(): PublicKey {
  const configKey = process.env.PATO_DBC_CONFIG_KEY;
  if (!configKey) {
    throw new Error(
      "PATO_DBC_CONFIG_KEY environment variable is not set. " +
        "Create a DBC config key on launch.meteora.ag or via the SDK first."
    );
  }
  return new PublicKey(configKey);
}

/**
 * Get the platform's fee claimer wallet (receives partner trading fees)
 */
export function getPatoFeeClaimer(): PublicKey {
  const feeClaimer = process.env.PATO_FEE_CLAIMER_WALLET;
  if (!feeClaimer) {
    throw new Error(
      "PATO_FEE_CLAIMER_WALLET environment variable is not set."
    );
  }
  return new PublicKey(feeClaimer);
}

// ============================================
// BUILD CONFIG PARAMETERS
// ============================================

/**
 * Build the DBC config parameters for creating the platform config key.
 * This is a one-time setup operation.
 */
export function buildPatoConfigParams() {
  return {
    // Trading fee: 1% with no decay (static fee)
    poolFees: {
      baseFee: {
        cliffFeeNumerator: PATO_CONFIG.cliffFeeNumerator,
        numberOfPeriod: 0,
        periodFrequency: new BN(0),
        reductionFactor: new BN(0),
        feeSchedulerMode: 0,
      },
      dynamicFee: null,
    },

    // Activation: immediate on creation
    activationType: PATO_CONFIG.activationType,
    activationPoint: null,

    // Migration to DAMM v2
    migrationOption: PATO_CONFIG.migrationOption,
    migrationFeeOption: PATO_CONFIG.migrationFeeOption,
    migrationQuoteThreshold: PATO_CONFIG.migrationQuoteThreshold,
    tokenDecimal: TokenDecimal.NINE,

    // Creator fee: 50% of partner's share
    creatorTradingFeePercentage: PATO_CONFIG.creatorTradingFeePercentage,

    // LP distribution: 50/50 permanently locked
    partnerLpPercentage: PATO_CONFIG.partnerClaimableLpPct,
    creatorLpPercentage: PATO_CONFIG.creatorClaimableLpPct,
    partnerLockedLpPercentage: 0,
    creatorLockedLpPercentage: 0,
    partnerPermanentLockedLpPercentage: PATO_CONFIG.partnerLockedLpPct,
    creatorPermanentLockedLpPercentage: PATO_CONFIG.creatorLockedLpPct,

    // Collect fees in SOL only
    collectFeeMode: 1, // CollectFeeMode.OnlyB (quote = SOL)
  };
}

// ============================================
// POOL CREATION
// ============================================

/**
 * Build the transaction to create a PATO pool for an acquired business.
 *
 * @param tokenName - Name for the token (e.g., the business name)
 * @param tokenSymbol - Token ticker symbol
 * @param tokenUri - Metaplex metadata URI (image, description, etc.)
 * @param creatorWallet - The buyer/creator's wallet public key
 * @param vanityMintKeypair - Pre-ground keypair ending in 'app'
 * @param payerWallet - Who pays for the transaction (usually same as creator)
 * @returns Transaction to create the pool
 */
export async function buildCreatePoolTransaction(params: {
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
  creatorWallet: PublicKey;
  vanityMintKeypair: Keypair;
  payerWallet: PublicKey;
}): Promise<{
  createPoolTx: Transaction;
  poolAddress: PublicKey;
  mintAddress: PublicKey;
}> {
  const client = getDbcClient();
  const configKey = getPatoConfigKey();

  // SDK expects PublicKey for baseMint; the keypair is used as a signer
  // when the transaction is submitted client-side
  const createPoolTx = await client.pool.createPool({
    name: params.tokenName,
    symbol: params.tokenSymbol,
    uri: params.tokenUri,
    config: configKey,
    payer: params.payerWallet,
    poolCreator: params.creatorWallet,
    baseMint: params.vanityMintKeypair.publicKey,
  });

  // Derive pool address from the mint
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      configKey.toBuffer(),
      params.vanityMintKeypair.publicKey.toBuffer(),
    ],
    DBC_PROGRAM_ID
  );

  return {
    createPoolTx,
    poolAddress,
    mintAddress: params.vanityMintKeypair.publicKey,
  };
}

/**
 * Build the transaction to create a pool with an initial buy (optional).
 */
export async function buildCreatePoolWithFirstBuyTransaction(params: {
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
  creatorWallet: PublicKey;
  vanityMintKeypair: Keypair;
  payerWallet: PublicKey;
  initialBuyAmountSOL: number;
}): Promise<{
  createPoolTx: Transaction;
  swapBuyTx: Transaction | undefined;
  poolAddress: PublicKey;
  mintAddress: PublicKey;
}> {
  const client = getDbcClient();
  const configKey = getPatoConfigKey();

  const result = await client.pool.createPoolWithFirstBuy({
    createPoolParam: {
      name: params.tokenName,
      symbol: params.tokenSymbol,
      uri: params.tokenUri,
      config: configKey,
      payer: params.payerWallet,
      poolCreator: params.creatorWallet,
      baseMint: params.vanityMintKeypair.publicKey,
    },
    firstBuyParam: {
      buyer: params.creatorWallet,
      buyAmount: new BN(
        Math.floor(params.initialBuyAmountSOL * LAMPORTS_PER_SOL)
      ),
      minimumAmountOut: new BN(0), // No minimum for initial buy
      referralTokenAccount: null,
    },
  });

  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      configKey.toBuffer(),
      params.vanityMintKeypair.publicKey.toBuffer(),
    ],
    DBC_PROGRAM_ID
  );

  return {
    createPoolTx: result.createPoolTx,
    swapBuyTx: result.swapBuyTx,
    poolAddress,
    mintAddress: params.vanityMintKeypair.publicKey,
  };
}

// ============================================
// SWAP (BUY/SELL)
// ============================================

/**
 * Build a swap transaction (buy tokens with SOL or sell tokens for SOL)
 */
export async function buildSwapTransaction(params: {
  owner: PublicKey;
  poolAddress: PublicKey;
  amountIn: BN;
  minimumAmountOut: BN;
  swapBaseForQuote: boolean; // true = sell tokens for SOL, false = buy tokens with SOL
}): Promise<Transaction> {
  const client = getDbcClient();

  return client.pool.swap({
    owner: params.owner,
    pool: params.poolAddress,
    amountIn: params.amountIn,
    minimumAmountOut: params.minimumAmountOut,
    swapBaseForQuote: params.swapBaseForQuote,
    referralTokenAccount: null,
  });
}

// ============================================
// FEE CLAIMING
// ============================================

/**
 * Build transaction for the platform (partner) to claim trading fees.
 * Works for both bonding curve phase and post-graduation locked LP fees.
 */
export async function buildClaimPartnerTradingFeeTransaction(params: {
  poolAddress: PublicKey;
  feeClaimerWallet: PublicKey;
  feeReceiverWallet: PublicKey;
}): Promise<Transaction> {
  const client = getDbcClient();

  return client.partner.claimPartnerTradingFee({
    pool: params.poolAddress,
    feeClaimer: params.feeClaimerWallet,
    payer: params.feeClaimerWallet,
    maxBaseAmount: new BN("18446744073709551615"), // u64::MAX - claim all
    maxQuoteAmount: new BN("18446744073709551615"),
  });
}

/**
 * Build transaction for the creator to claim their trading fees.
 */
export async function buildClaimCreatorTradingFeeTransaction(params: {
  poolAddress: PublicKey;
  creatorWallet: PublicKey;
}): Promise<Transaction> {
  const client = getDbcClient();

  return client.creator.claimCreatorTradingFee({
    pool: params.poolAddress,
    creator: params.creatorWallet,
    payer: params.creatorWallet,
    maxBaseAmount: new BN("18446744073709551615"),
    maxQuoteAmount: new BN("18446744073709551615"),
  });
}

// ============================================
// STATE QUERIES
// ============================================

/**
 * Get the current state of a PATO pool
 */
export async function getPoolState(poolAddress: PublicKey) {
  const client = getDbcClient();
  return client.state.getPool(poolAddress);
}

/**
 * Get the config state
 */
export async function getConfigState(configAddress: PublicKey) {
  const client = getDbcClient();
  return client.state.getPoolConfig(configAddress);
}

/**
 * Get the bonding curve progress (0 to 1)
 */
export async function getCurveProgress(poolAddress: PublicKey): Promise<number> {
  const client = getDbcClient();
  return client.state.getPoolCurveProgress(poolAddress);
}

/**
 * Get fee metrics for a pool
 */
export async function getPoolFeeMetrics(poolAddress: PublicKey) {
  const client = getDbcClient();
  return client.state.getPoolFeeMetrics(poolAddress);
}

/**
 * Get a swap quote for a pool (preview before executing)
 */
export async function getSwapQuote(params: {
  poolAddress: PublicKey;
  amountIn: BN;
  swapBaseForQuote: boolean;
  slippageBps?: number;
}) {
  const client = getDbcClient();

  const virtualPool = await client.state.getPool(params.poolAddress);
  const config = await client.state.getPoolConfig(virtualPool.config);

  return client.pool.swapQuote({
    virtualPool,
    config,
    swapBaseForQuote: params.swapBaseForQuote,
    amountIn: params.amountIn,
    slippageBps: params.slippageBps ?? 100,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint: new BN(0),
  });
}

/**
 * Check if a pool has graduated (migrated to DAMM v2)
 */
export async function hasPoolGraduated(poolAddress: PublicKey): Promise<boolean> {
  try {
    const progress = await getCurveProgress(poolAddress);
    return progress >= 1;
  } catch {
    return false;
  }
}

// ============================================
// FEE CALCULATIONS
// ============================================

/**
 * Calculate the fee breakdown for a given trade amount
 */
export function calculateFeeBreakdown(tradeAmountSOL: number) {
  const totalFeePct = PATO_CONFIG.tradingFeeBps / 100; // 1%
  const totalFee = tradeAmountSOL * (totalFeePct / 100);
  const meteoraCut = totalFee * 0.2; // 20% to Meteora
  const partnerPool = totalFee * 0.8; // 80% to partner pool
  const creatorCut =
    partnerPool * (PATO_CONFIG.creatorTradingFeePercentage / 100);
  const platformCut = partnerPool - creatorCut;

  return {
    tradeAmount: tradeAmountSOL,
    totalFee,
    totalFeePct,
    meteoraCut,
    meteoraPct: 0.2,
    partnerPool,
    creatorCut,
    creatorPctOfVolume: (creatorCut / tradeAmountSOL) * 100,
    platformCut,
    platformPctOfVolume: (platformCut / tradeAmountSOL) * 100,
  };
}
