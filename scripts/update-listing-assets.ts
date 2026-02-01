/**
 * Script to update existing listings with proper asset boolean fields
 * Run with: npx ts-node scripts/update-listing-assets.ts
 * Or: npx tsx scripts/update-listing-assets.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all listings...');

  const listings = await prisma.listing.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      hasDomain: true,
      domain: true,
      hasDatabase: true,
      databaseType: true,
      hasHosting: true,
      hostingProvider: true,
      hasApiKeys: true,
      hasDesignFiles: true,
      hasDocumentation: true,
      githubRepo: true,
    },
  });

  console.log(`Found ${listings.length} listings\n`);

  for (const listing of listings) {
    const updates: Record<string, boolean> = {};

    // If domain is set but hasDomain is false, set it to true
    if (listing.domain && !listing.hasDomain) {
      updates.hasDomain = true;
    }

    // If databaseType is set but hasDatabase is false, set it to true
    if (listing.databaseType && !listing.hasDatabase) {
      updates.hasDatabase = true;
    }

    // If hostingProvider is set but hasHosting is false, set it to true
    if (listing.hostingProvider && !listing.hasHosting) {
      updates.hasHosting = true;
    }

    // If there are updates to make
    if (Object.keys(updates).length > 0) {
      console.log(`Updating listing: ${listing.title} (${listing.slug})`);
      console.log(`  Changes: ${JSON.stringify(updates)}`);

      await prisma.listing.update({
        where: { id: listing.id },
        data: updates,
      });

      console.log('  Updated!\n');
    } else {
      console.log(`No updates needed for: ${listing.title}`);
    }
  }

  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
