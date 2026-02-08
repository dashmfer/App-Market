/**
 * One-time script to encrypt existing plaintext OAuth tokens in the database.
 *
 * Usage:
 *   ENCRYPTION_SECRET=your_secret node scripts/rotate-tokens.js
 *
 * Or if you have a .env file with ENCRYPTION_SECRET and DATABASE_URL:
 *   source .env && node scripts/rotate-tokens.js
 *
 * Safe to run multiple times — looksEncrypted() prevents double-encryption.
 */

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

const TOKEN_FIELDS = ["refresh_token", "access_token", "id_token"];

function getEncryptionSecret() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.error("ERROR: ENCRYPTION_SECRET env var is not set.");
    console.error("");
    console.error("Run with:");
    console.error("  ENCRYPTION_SECRET=your_secret node scripts/rotate-tokens.js");
    console.error("");
    console.error("Or generate one with: openssl rand -hex 32");
    process.exit(1);
  }
  return secret;
}

function encrypt(plaintext) {
  const secret = getEncryptionSecret();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(secret, salt, KEY_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  return combined.toString("base64");
}

function looksEncrypted(data) {
  try {
    const decoded = Buffer.from(data, "base64");
    return decoded.length > SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

async function rotateTokens() {
  getEncryptionSecret(); // validate early

  const accounts = await prisma.account.findMany();
  console.log(`Found ${accounts.length} accounts to process.`);

  let encryptedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const account of accounts) {
    const updates = {};
    let needsUpdate = false;

    for (const field of TOKEN_FIELDS) {
      const value = account[field];
      if (value && typeof value === "string" && !looksEncrypted(value)) {
        try {
          updates[field] = encrypt(value);
          needsUpdate = true;
        } catch (error) {
          console.error(`  Failed to encrypt ${field} for account ${account.id}:`, error);
          errorCount++;
        }
      } else if (value && looksEncrypted(value)) {
        skippedCount++;
      }
    }

    if (needsUpdate) {
      await prisma.account.update({
        where: { id: account.id },
        data: updates,
      });
      encryptedCount++;
      console.log(`  Encrypted tokens for account ${account.id}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Accounts with newly encrypted tokens: ${encryptedCount}`);
  console.log(`  Already-encrypted tokens skipped: ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);

  await prisma.$disconnect();
}

rotateTokens().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
