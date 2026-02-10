import { put } from "@vercel/blob";

/**
 * Metaplex-standard token metadata JSON
 * https://docs.metaplex.com/programs/token-metadata/token-standard
 */
interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  properties: {
    category: string;
    creators: { address: string; share: number }[];
  };
  extensions?: Record<string, string>;
}

/**
 * Upload token metadata JSON to Vercel Blob and return a permanent public URL.
 * This URL is used as the `tokenUri` in Metaplex token metadata on-chain.
 *
 * For maximum permanence, consider migrating to Arweave (via Irys) in the future.
 */
export async function uploadTokenMetadata(params: {
  tokenLaunchId: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription?: string | null;
  tokenImage?: string | null;
  creatorWallet: string;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  discord?: string | null;
}): Promise<string> {
  const metadata: TokenMetadata = {
    name: params.tokenName,
    symbol: params.tokenSymbol,
    description: params.tokenDescription || "",
    image: params.tokenImage || "",
    external_url: params.website || "",
    properties: {
      category: "token",
      creators: [
        {
          address: params.creatorWallet,
          share: 100,
        },
      ],
    },
    extensions: {
      ...(params.twitter && { twitter: params.twitter }),
      ...(params.telegram && { telegram: params.telegram }),
      ...(params.discord && { discord: params.discord }),
      ...(params.website && { website: params.website }),
    },
  };

  const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });

  const blob = await put(
    `pato/metadata/${params.tokenLaunchId}.json`,
    jsonBlob,
    { access: "public" }
  );

  return blob.url;
}
