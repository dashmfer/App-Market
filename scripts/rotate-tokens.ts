/**
 * One-time script to encrypt existing plaintext OAuth tokens in the database.
 *
 * Run after setting ENCRYPTION_SECRET env var:
 *   npx tsx scripts/rotate-tokens.ts
 *
 * Safe to run multiple times — looksEncrypted() prevents double-encryption.
 */

import { PrismaClient } from "@prisma/client";
import { encrypt, looksEncrypted } from "../lib/encryption";

const prisma = new PrismaClient();

const TOKEN_FIELDS = ["refresh_token", "access_token", "id_token"] as const;

async function rotateTokens() {
  if (!process.env.ENCRYPTION_SECRET) {
    console.error("ERROR: ENCRYPTION_SECRET env var is not set.");
    console.error("Generate one with: openssl rand -hex 32");
    process.exit(1);
  }

  const accounts = await prisma.account.findMany();
  console.log(`Found ${accounts.length} accounts to process.`);

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const account of accounts) {
    const updates: Record<string, string> = {};
    let needsUpdate = false;

    for (const field of TOKEN_FIELDS) {
      const value = account[field];
      if (value && typeof value === "string" && !looksEncrypted(value)) {
        try {
          updates[field] = encrypt(value);
          needsUpdate = true;
        } catch (error) {
          console.error(`  Failed to encrypt ${field} for account ${account.id}:`, error);
          errors++;
        }
      } else if (value && looksEncrypted(value)) {
        skipped++;
      }
    }

    if (needsUpdate) {
      await prisma.account.update({
        where: { id: account.id },
        data: updates,
      });
      encrypted++;
      console.log(`  Encrypted tokens for account ${account.id}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Accounts with newly encrypted tokens: ${encrypted}`);
  console.log(`  Already-encrypted tokens skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  await prisma.$disconnect();
}

rotateTokens().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
