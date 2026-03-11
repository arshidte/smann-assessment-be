import { SemanticCacheEntry, ForwardGeocodeResponse } from '../types';
import { forwardGeocode } from './geocodingService';

const OLLAMA_EMBEDDING_URL = 'http://localhost:11434/api/embeddings';
const EMBEDDING_MODEL = 'nomic-embed-text';
const SIMILARITY_THRESHOLD = 0.92;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const EVICTION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// In-memory cache store
const cache: Map<string, SemanticCacheEntry> = new Map();

// Eviction interval handle
let evictionTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Normalize a string: lowercase, trim, collapse whitespace.
 */
function normalizeString(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Generate an embedding vector from Ollama for the given text.
 * Returns null if Ollama is unreachable.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(OLLAMA_EMBEDDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
    });

    if (!response.ok) {
      console.warn(`Ollama embedding request failed with status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  } catch (error) {
    console.warn('Ollama is unreachable, falling back to exact string matching:', (error as Error).message);
    return null;
  }
}

/**
 * Find the best matching cache entry using semantic similarity.
 * Returns the entry and similarity score if above threshold, otherwise null.
 */
function findSemanticMatch(
  queryEmbedding: number[]
): { entry: SemanticCacheEntry; similarity: number } | null {
  let bestMatch: SemanticCacheEntry | null = null;
  let bestSimilarity = 0;

  for (const entry of cache.values()) {
    if (entry.embedding.length === 0) continue;

    const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
    if (similarity >= SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    return { entry: bestMatch, similarity: bestSimilarity };
  }
  return null;
}

/**
 * Find an exact match in the cache using normalized string comparison.
 * Used as fallback when Ollama is unreachable.
 */
function findExactMatch(normalizedQuery: string): SemanticCacheEntry | null {
  for (const entry of cache.values()) {
    if (entry.normalizedQuery === normalizedQuery) {
      return entry;
    }
  }
  return null;
}

/**
 * Main entry point: look up an address in the semantic cache.
 * On hit, returns cached result. On miss, calls geocoding service and caches the result.
 */
export async function lookupWithCache(address: string): Promise<ForwardGeocodeResponse> {
  const normalizedQuery = normalizeString(address);

  // Try to generate embedding via Ollama
  const embedding = await generateEmbedding(address);

  if (embedding) {
    // Semantic matching path
    const match = findSemanticMatch(embedding);
    if (match) {
      console.log(
        `[SemanticCache] HIT for "${address}" (similarity: ${match.similarity.toFixed(4)}, matched: "${match.entry.query}")`
      );
      return { ...match.entry.result, cached: true };
    }

    console.log(`[SemanticCache] MISS for "${address}"`);

    // Cache miss — call geocoding service
    const result = await forwardGeocode(address);
    const entry: SemanticCacheEntry = {
      query: address,
      normalizedQuery,
      embedding,
      result,
      timestamp: new Date(),
    };
    cache.set(normalizedQuery, entry);

    return result;
  } else {
    // Fallback: exact normalized string matching (Ollama unreachable)
    const exactMatch = findExactMatch(normalizedQuery);
    if (exactMatch) {
      console.log(
        `[SemanticCache] HIT (exact match fallback) for "${address}"`
      );
      return { ...exactMatch.result, cached: true };
    }

    console.log(`[SemanticCache] MISS (exact match fallback) for "${address}"`);

    // Cache miss — call geocoding service
    const result = await forwardGeocode(address);
    const entry: SemanticCacheEntry = {
      query: address,
      normalizedQuery,
      embedding: [],
      result,
      timestamp: new Date(),
    };
    cache.set(normalizedQuery, entry);

    return result;
  }
}

/**
 * Evict all cache entries older than 7 days.
 */
export function evictExpiredEntries(): number {
  const now = Date.now();
  let evictedCount = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp.getTime() > TTL_MS) {
      cache.delete(key);
      evictedCount++;
    }
  }

  if (evictedCount > 0) {
    console.log(`[SemanticCache] Evicted ${evictedCount} expired entries`);
  }

  return evictedCount;
}

/**
 * Start the periodic eviction timer.
 */
export function startEvictionTimer(): void {
  if (evictionTimer) return;
  evictionTimer = setInterval(() => {
    evictExpiredEntries();
  }, EVICTION_INTERVAL_MS);
}

/**
 * Stop the periodic eviction timer.
 */
export function stopEvictionTimer(): void {
  if (evictionTimer) {
    clearInterval(evictionTimer);
    evictionTimer = null;
  }
}

/**
 * Clear all cache entries. Useful for testing.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get the current number of entries in the cache.
 */
export function getCacheSize(): number {
  return cache.size;
}

// Export internals for testing
export {
  normalizeString,
  generateEmbedding,
  findSemanticMatch,
  findExactMatch,
  SIMILARITY_THRESHOLD,
  TTL_MS,
  EVICTION_INTERVAL_MS,
  cache,
};
