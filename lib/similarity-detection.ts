/**
 * Similar Listing Detection System
 *
 * Uses perceptual hashing for images and text similarity for descriptions
 * to detect potentially duplicate or similar listings.
 *
 * Thresholds:
 * - Soft flag: 70% similarity (yellow warning)
 * - Hard flag: 90% similarity (blocks listing, requires manual review)
 */

import crypto from "crypto";

// Simple string similarity using Jaccard index on word tokens
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Normalize and tokenize
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Calculate Jaccard similarity
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// Calculate n-gram similarity for more robust text comparison
export function calculateNGramSimilarity(
  text1: string,
  text2: string,
  n: number = 3
): number {
  if (!text1 || !text2) return 0;

  const getNGrams = (text: string, n: number): Set<string> => {
    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ngrams = new Set<string>();
    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.slice(i, i + n));
    }
    return ngrams;
  };

  const ngrams1 = getNGrams(text1, n);
  const ngrams2 = getNGrams(text2, n);

  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  const intersection = new Set([...ngrams1].filter((x) => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);

  return intersection.size / union.size;
}

// Calculate title similarity (weighted more heavily)
export function calculateTitleSimilarity(title1: string, title2: string): number {
  // Exact match
  if (title1.toLowerCase().trim() === title2.toLowerCase().trim()) {
    return 1.0;
  }

  // N-gram similarity
  const ngramSim = calculateNGramSimilarity(title1, title2, 2);

  // Word overlap
  const words1 = title1.toLowerCase().split(/\s+/);
  const words2 = title2.toLowerCase().split(/\s+/);
  const wordSet1 = new Set(words1);
  const wordSet2 = new Set(words2);
  const wordOverlap = [...wordSet1].filter((w) => wordSet2.has(w)).length;
  const wordSim = wordOverlap / Math.max(wordSet1.size, wordSet2.size);

  // Combined score
  return ngramSim * 0.5 + wordSim * 0.5;
}

// Simple perceptual hash for thumbnails (placeholder - would use actual image hashing lib)
export function calculateImageHash(imageUrl: string): string {
  // In production, this would:
  // 1. Download the image
  // 2. Resize to 8x8 or 16x16
  // 3. Convert to grayscale
  // 4. Calculate average brightness
  // 5. Generate hash based on pixel comparisons

  // For now, return a hash of the URL as placeholder
  return crypto.createHash("sha256").update(imageUrl).digest("hex").slice(0, 16);
}

// Calculate hamming distance between two hashes
export function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  const len = Math.min(hash1.length, hash2.length);

  for (let i = 0; i < len; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

// Calculate image similarity based on perceptual hash
export function calculateImageSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 0;

  const distance = hammingDistance(hash1, hash2);
  const maxDistance = Math.max(hash1.length, hash2.length);

  return 1 - distance / maxDistance;
}

// Calculate tech stack similarity
export function calculateTechStackSimilarity(
  stack1: string[],
  stack2: string[]
): number {
  if (!stack1?.length || !stack2?.length) return 0;

  const set1 = new Set(stack1.map((s) => s.toLowerCase()));
  const set2 = new Set(stack2.map((s) => s.toLowerCase()));

  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return intersection / union;
}

export interface SimilarityResult {
  overallSimilarity: number;
  titleSimilarity: number;
  descriptionSimilarity: number;
  techStackSimilarity: number;
  imageSimilarity: number;
  flagLevel: "none" | "soft" | "hard";
  reasons: string[];
}

export interface ListingForComparison {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  thumbnailUrl?: string | null;
  sellerId: string;
}

// Main similarity calculation
export function calculateListingSimilarity(
  listing1: ListingForComparison,
  listing2: ListingForComparison
): SimilarityResult {
  // Skip if same seller (they can have similar listings)
  if (listing1.sellerId === listing2.sellerId) {
    return {
      overallSimilarity: 0,
      titleSimilarity: 0,
      descriptionSimilarity: 0,
      techStackSimilarity: 0,
      imageSimilarity: 0,
      flagLevel: "none",
      reasons: [],
    };
  }

  const titleSim = calculateTitleSimilarity(listing1.title, listing2.title);
  const descSim = calculateNGramSimilarity(listing1.description, listing2.description);
  const techSim = calculateTechStackSimilarity(listing1.techStack, listing2.techStack);

  // Image similarity (placeholder)
  // SECURITY [M22]: Screenshot comparison uses URL-based hashing, not perceptual hashing.
  // The same image served from a different URL will not be detected as similar.
  // Consider implementing perceptual hashing (e.g., pHash) for robust detection.
  let imageSim = 0;
  if (listing1.thumbnailUrl && listing2.thumbnailUrl) {
    const hash1 = calculateImageHash(listing1.thumbnailUrl);
    const hash2 = calculateImageHash(listing2.thumbnailUrl);
    imageSim = calculateImageSimilarity(hash1, hash2);
  }

  // Weighted overall similarity
  // Title: 30%, Description: 40%, Tech Stack: 20%, Image: 10%
  const overallSimilarity =
    titleSim * 0.3 + descSim * 0.4 + techSim * 0.2 + imageSim * 0.1;

  // Determine flag level
  let flagLevel: "none" | "soft" | "hard" = "none";
  const reasons: string[] = [];

  if (overallSimilarity >= 0.9) {
    flagLevel = "hard";
    reasons.push(`Overall similarity is ${(overallSimilarity * 100).toFixed(0)}% (threshold: 90%)`);
  } else if (overallSimilarity >= 0.7) {
    flagLevel = "soft";
    reasons.push(`Overall similarity is ${(overallSimilarity * 100).toFixed(0)}% (threshold: 70%)`);
  }

  // Additional specific flags
  if (titleSim >= 0.85) {
    if (flagLevel === "none") flagLevel = "soft";
    reasons.push(`Title similarity is ${(titleSim * 100).toFixed(0)}%`);
  }

  if (descSim >= 0.8) {
    if (flagLevel === "none") flagLevel = "soft";
    reasons.push(`Description similarity is ${(descSim * 100).toFixed(0)}%`);
  }

  return {
    overallSimilarity,
    titleSimilarity: titleSim,
    descriptionSimilarity: descSim,
    techStackSimilarity: techSim,
    imageSimilarity: imageSim,
    flagLevel,
    reasons,
  };
}

// Find similar listings for a given listing
export async function findSimilarListings(
  targetListing: ListingForComparison,
  allListings: ListingForComparison[],
  minSimilarity: number = 0.5
): Promise<
  Array<{
    listing: ListingForComparison;
    result: SimilarityResult;
  }>
> {
  const results: Array<{
    listing: ListingForComparison;
    result: SimilarityResult;
  }> = [];

  for (const listing of allListings) {
    // Skip self
    if (listing.id === targetListing.id) continue;

    const result = calculateListingSimilarity(targetListing, listing);

    if (result.overallSimilarity >= minSimilarity) {
      results.push({ listing, result });
    }
  }

  // Sort by similarity (highest first)
  results.sort((a, b) => b.result.overallSimilarity - a.result.overallSimilarity);

  return results;
}
