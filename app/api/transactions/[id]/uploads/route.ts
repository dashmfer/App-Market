import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';
import { PublicKey, Keypair, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { verifyUploads } from '@/lib/solana-contract';
import { getConnection } from '@/lib/solana';
import { z } from "zod";

const uploadSchema = z.object({
  type: z.string().min(1),
  url: z.string().url().optional().nullable(),
  fileKey: z.string().optional().nullable(),
  fileName: z.string().max(500).optional().nullable(),
  fileSize: z.number().int().positive().max(100_000_000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const uploadsArraySchema = z.array(uploadSchema).min(1).max(20);

// Types for upload validation
interface UploadData {
  type: 'GITHUB' | 'FILE' | 'CREDENTIALS' | 'DOCUMENTATION' | 'DOMAIN' | 'DATABASE' | 'HOSTING' | 'SOCIAL_ACCOUNT' | 'API_KEYS' | 'DESIGN_FILES';
  url?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  metadata?: any;
}

interface ValidationResult {
  verified: boolean;
  error?: string;
  details?: any;
}

/**
 * POST /api/transactions/[id]/uploads
 *
 * Seller uploads required assets for a transaction
 * Validates that ALL required assets from listing are provided
 * Calls smart contract verify_uploads if all validations pass
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = params.id;
    const body = await req.json();
    const parseResult = uploadsArraySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid upload data", details: parseResult.error.issues },
        { status: 400 }
      );
    }
    const uploads: UploadData[] = parseResult.data as UploadData[];

    // 1. Get transaction and listing details
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        seller: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // 2. Verify user is the seller
    if (transaction.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Only seller can upload assets' }, { status: 403 });
    }

    // 3. Verify seller has confirmed transfer
    if (!transaction.sellerConfirmedTransfer) {
      return NextResponse.json({
        error: 'Must call seller_confirm_transfer first'
      }, { status: 400 });
    }

    // 4. Check if already verified
    if (transaction.uploadsVerified) {
      return NextResponse.json({
        error: 'Uploads already verified for this transaction'
      }, { status: 400 });
    }

    // 5. Validate ALL required assets are uploaded
    const validationResults = await validateRequiredAssets(
      transaction.listing,
      uploads,
      transaction.seller
    );

    // 6. Check if all required assets passed validation
    const allPassed = validationResults.every(r => r.verified);
    if (!allPassed) {
      const failures = validationResults.filter(r => !r.verified);
      return NextResponse.json({
        error: 'Upload verification failed',
        failures,
      }, { status: 400 });
    }

    // 7. Store uploads in database
    await prisma.upload.createMany({
      data: uploads.map(upload => ({
        transactionId,
        type: upload.type,
        url: upload.url,
        fileKey: upload.fileKey,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        metadata: upload.metadata,
        verified: true,
      })),
    });

    // 8. Generate verification hash (for smart contract)
    const verificationHash = generateVerificationHash(uploads, validationResults);

    // 9. Call smart contract verify_uploads instruction
    // This marks the transaction as verified on-chain, enabling finalization
    const listing = await prisma.listing.findUnique({
      where: { id: transaction.listingId },
      select: { escrowAddress: true },
    });

    if (listing?.escrowAddress) {
      try {
        // Backend authority keypair from environment
        const backendSecretKey = process.env.BACKEND_AUTHORITY_SECRET_KEY;
        if (!backendSecretKey) {
          console.error('BACKEND_AUTHORITY_SECRET_KEY not configured');
          // Continue without on-chain verification - will need manual verification
        } else {
          const keypairBytes = JSON.parse(backendSecretKey);
          const backendKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairBytes));
          const connection = getConnection();

          const wallet: Wallet = {
            publicKey: backendKeypair.publicKey,
            payer: backendKeypair,
            signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
              if (tx instanceof VersionedTransaction) {
                tx.sign([backendKeypair]);
              } else {
                (tx as Transaction).partialSign(backendKeypair);
              }
              return tx;
            },
            signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
              txs.forEach(tx => {
                if (tx instanceof VersionedTransaction) {
                  tx.sign([backendKeypair]);
                } else {
                  (tx as Transaction).partialSign(backendKeypair);
                }
              });
              return txs;
            },
          };

          const provider = new AnchorProvider(connection, wallet, {
            commitment: 'confirmed',
          });

          await verifyUploads({
            provider,
            listing: new PublicKey(listing.escrowAddress),
            verificationHash,
          });
        }
      } catch (onChainError) {
        console.error('On-chain verification failed:', onChainError);
        // Don't fail the request - uploads are stored, just not verified on-chain
        // Admin can manually verify later or buyer can use emergency verification after 30 days
      }
    }

    // 10. Update transaction in database
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        uploadsVerified: true,
        verificationHash,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'All uploads verified successfully',
      verificationHash,
      validationResults,
    });

  } catch (error) {
    console.error('Upload verification error:', error);
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Validate that all required assets from listing are provided
 */
async function validateRequiredAssets(
  listing: any,
  uploads: UploadData[],
  seller: any
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. REQUIRED: GitHub Repository (always required)
  if (listing.githubRepo) {
    const githubUpload = uploads.find(u => u.type === 'GITHUB');
    if (!githubUpload) {
      results.push({
        verified: false,
        error: 'GitHub repository is required (listed in assets included)',
      });
    } else {
      const githubResult = await verifyGithubRepo(
        githubUpload.url!,
        seller.githubUsername,
        seller.githubVerified,
        seller
      );
      results.push(githubResult);
    }
  }

  // 2. OPTIONAL: Domain (if hasDomain = true)
  if (listing.hasDomain) {
    const domainUpload = uploads.find(u => u.type === 'DOMAIN');
    if (!domainUpload) {
      results.push({
        verified: false,
        error: 'Domain credentials required (listed in assets included)',
      });
    } else {
      results.push({
        verified: true,
        details: { domain: listing.domain, provided: true },
      });
    }
  }

  // 3. OPTIONAL: Database (if hasDatabase = true)
  if (listing.hasDatabase) {
    const dbUpload = uploads.find(u => u.type === 'DATABASE');
    if (!dbUpload) {
      results.push({
        verified: false,
        error: `Database credentials required (${listing.databaseType} listed in assets included)`,
      });
    } else {
      results.push({
        verified: true,
        details: { databaseType: listing.databaseType, provided: true },
      });
    }
  }

  // 4. OPTIONAL: Hosting (if hasHosting = true)
  if (listing.hasHosting) {
    const hostingUpload = uploads.find(u => u.type === 'HOSTING');
    if (!hostingUpload) {
      results.push({
        verified: false,
        error: `Hosting credentials required (${listing.hostingProvider} listed in assets included)`,
      });
    } else {
      results.push({
        verified: true,
        details: { hostingProvider: listing.hostingProvider, provided: true },
      });
    }
  }

  // 5. OPTIONAL: Social Accounts (if hasSocialAccounts = true)
  if (listing.hasSocialAccounts) {
    const socialUpload = uploads.find(u => u.type === 'SOCIAL_ACCOUNT');
    if (!socialUpload) {
      results.push({
        verified: false,
        error: 'Social account credentials required (listed in assets included)',
      });
    } else {
      const socialResult = verifySocialAccountsFormat(socialUpload.metadata);
      results.push(socialResult);
    }
  }

  // 6. OPTIONAL: API Keys (if hasApiKeys = true)
  if (listing.hasApiKeys) {
    const apiKeysUpload = uploads.find(u => u.type === 'API_KEYS');
    if (!apiKeysUpload) {
      results.push({
        verified: false,
        error: 'API keys required (listed in assets included)',
      });
    } else {
      results.push({
        verified: true,
        details: { apiKeys: 'provided', note: 'Buyer should test functionality' },
      });
    }
  }

  // 7. OPTIONAL: Design Files (if hasDesignFiles = true)
  if (listing.hasDesignFiles) {
    const designUpload = uploads.find(u => u.type === 'DESIGN_FILES');
    if (!designUpload) {
      results.push({
        verified: false,
        error: 'Design files required (listed in assets included)',
      });
    } else {
      results.push({
        verified: true,
        details: { fileName: designUpload.fileName, fileSize: designUpload.fileSize },
      });
    }
  }

  // 8. REQUIRED: Documentation (if hasDocumentation = true)
  if (listing.hasDocumentation) {
    const docUpload = uploads.find(u => u.type === 'DOCUMENTATION');
    if (!docUpload) {
      results.push({
        verified: false,
        error: 'Documentation required (listed in assets included)',
      });
    } else {
      results.push({
        verified: true,
        details: { documentation: 'provided' },
      });
    }
  }

  return results;
}

/**
 * Verify GitHub repository ownership
 */
async function verifyGithubRepo(
  repoUrl: string,
  sellerGithubUsername: string | null,
  githubVerified: boolean,
  seller: any
): Promise<ValidationResult> {
  // 1. Seller must have verified GitHub
  if (!githubVerified || !sellerGithubUsername) {
    return {
      verified: false,
      error: 'Seller must verify GitHub account before uploading repository',
    };
  }

  // 2. Parse repo URL
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return {
      verified: false,
      error: 'Invalid GitHub URL format',
    };
  }

  const [_, repoOwner, repoName] = match;

  // 3. Verify repo owner matches seller's verified GitHub
  if (repoOwner.toLowerCase() !== sellerGithubUsername.toLowerCase()) {
    return {
      verified: false,
      error: `GitHub repo must belong to your verified account (${sellerGithubUsername}). Repo owner: ${repoOwner}`,
    };
  }

  // 4. Verify repo exists and seller has access
  try {
    // Get GitHub token from seller's account
    const account = await prisma.account.findFirst({
      where: {
        userId: seller.id,
        provider: 'github',
      },
    });

    if (!account?.access_token) {
      return {
        verified: false,
        error: 'GitHub access token not found. Please reconnect GitHub.',
      };
    }

    const octokit = new Octokit({ auth: account.access_token });
    const { data } = await octokit.repos.get({
      owner: repoOwner,
      repo: repoName.replace('.git', ''),
    });

    // 5. Verify seller is the owner
    if (data.owner.login.toLowerCase() !== sellerGithubUsername.toLowerCase()) {
      return {
        verified: false,
        error: 'You must be the owner of this repository',
      };
    }

    return {
      verified: true,
      details: {
        repoOwner,
        repoName,
        repoUrl: data.html_url,
        isPrivate: data.private,
        stars: data.stargazers_count,
      },
    };
  } catch (error) {
    return {
      verified: false,
      error: 'Cannot access GitHub repo. Ensure it exists and you have access.',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify social accounts format
 */
function verifySocialAccountsFormat(metadata: any): ValidationResult {
  if (!metadata || !Array.isArray(metadata.accounts)) {
    return {
      verified: false,
      error: 'Invalid social accounts format',
    };
  }

  for (const account of metadata.accounts) {
    if (!account.platform || !account.username || !account.password) {
      return {
        verified: false,
        error: 'Missing platform, username, or password for social account',
      };
    }

    // Basic format validation
    if (account.platform === 'twitter' && !/^@?[A-Za-z0-9_]{1,15}$/.test(account.username)) {
      return {
        verified: false,
        error: `Invalid Twitter username format: ${account.username}`,
      };
    }
  }

  return {
    verified: true,
    details: {
      count: metadata.accounts.length,
      note: 'Buyer should verify account access after transfer',
    },
  };
}

/**
 * Generate verification hash for smart contract
 */
function generateVerificationHash(
  uploads: UploadData[],
  validationResults: ValidationResult[]
): string {
  const data = {
    uploads: uploads.map(u => ({ type: u.type, url: u.url, fileName: u.fileName })),
    validationResults,
    timestamp: Date.now(),
  };

  const { createHash } = require('crypto');
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
