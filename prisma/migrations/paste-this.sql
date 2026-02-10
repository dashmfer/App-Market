DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TokenLaunchType') THEN
        CREATE TYPE "TokenLaunchType" AS ENUM ('PATO', 'FAIR_LAUNCH', 'PRESALE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TokenLaunchStatus') THEN
        CREATE TYPE "TokenLaunchStatus" AS ENUM ('PENDING', 'LAUNCHING', 'LIVE', 'GRADUATED', 'COMPLETED', 'FAILED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BondingCurveStatus') THEN
        CREATE TYPE "BondingCurveStatus" AS ENUM ('PENDING', 'ACTIVE', 'GRADUATING', 'GRADUATED', 'FAILED');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PATO_LAUNCHED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
        ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PATO_LAUNCHED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PATO_GRADUATED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
        ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PATO_GRADUATED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PATO_FEES_AVAILABLE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
        ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PATO_FEES_AVAILABLE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PATO_LAUNCH_FAILED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
        ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PATO_LAUNCH_FAILED';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TokenLaunch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tokenName" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenMint" TEXT,
    "tokenImage" TEXT,
    "tokenDescription" TEXT,
    "totalSupply" BIGINT NOT NULL,
    "launchType" "TokenLaunchType" NOT NULL DEFAULT 'PATO',
    "dbcPoolAddress" TEXT,
    "dbcConfigKey" TEXT,
    "bondingCurveStatus" "BondingCurveStatus" NOT NULL DEFAULT 'PENDING',
    "graduationThreshold" DECIMAL(18, 8) NOT NULL DEFAULT 85,
    "graduatedAt" TIMESTAMP(3),
    "dammPoolAddress" TEXT,
    "migrationFeeOption" INTEGER NOT NULL DEFAULT 2,
    "tradingFeeBps" INTEGER NOT NULL DEFAULT 100,
    "creatorFeePct" INTEGER NOT NULL DEFAULT 50,
    "partnerLockedLpPct" INTEGER NOT NULL DEFAULT 50,
    "creatorLockedLpPct" INTEGER NOT NULL DEFAULT 50,
    "creatorWallet" TEXT,
    "vanityKeypair" TEXT,
    "totalBondingCurveFeesSOL" DECIMAL(18, 8) NOT NULL DEFAULT 0,
    "totalPostGradFeesSOL" DECIMAL(18, 8) NOT NULL DEFAULT 0,
    "creatorFeesClaimedSOL" DECIMAL(18, 8) NOT NULL DEFAULT 0,
    "platformFeesClaimedSOL" DECIMAL(18, 8) NOT NULL DEFAULT 0,
    "status" "TokenLaunchStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "website" TEXT,
    "twitter" TEXT,
    "telegram" TEXT,
    "discord" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchedAt" TIMESTAMP(3),
    CONSTRAINT "TokenLaunch_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TokenLaunch_transactionId_key') THEN
        ALTER TABLE "TokenLaunch" ADD CONSTRAINT "TokenLaunch_transactionId_key" UNIQUE ("transactionId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TokenLaunch_transactionId_fkey') THEN
        ALTER TABLE "TokenLaunch" ADD CONSTRAINT "TokenLaunch_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TokenLaunch_listingId_fkey') THEN
        ALTER TABLE "TokenLaunch" ADD CONSTRAINT "TokenLaunch_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TokenLaunch_status_idx" ON "TokenLaunch"("status");
CREATE INDEX IF NOT EXISTS "TokenLaunch_transactionId_idx" ON "TokenLaunch"("transactionId");
CREATE INDEX IF NOT EXISTS "TokenLaunch_listingId_idx" ON "TokenLaunch"("listingId");
CREATE INDEX IF NOT EXISTS "TokenLaunch_bondingCurveStatus_idx" ON "TokenLaunch"("bondingCurveStatus");
CREATE INDEX IF NOT EXISTS "TokenLaunch_tokenMint_idx" ON "TokenLaunch"("tokenMint");
CREATE INDEX IF NOT EXISTS "TokenLaunch_creatorWallet_idx" ON "TokenLaunch"("creatorWallet");

SELECT table_name, column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'TokenLaunch' ORDER BY ordinal_position;
