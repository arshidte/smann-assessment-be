import {
  cosineSimilarity,
  normalizeString,
  lookupWithCache,
  clearCache,
  getCacheSize,
  evictExpiredEntries,
  cache,
  SIMILARITY_THRESHOLD,
  TTL_MS,
} from '../../src/services/semanticCache';
import { SemanticCacheEntry, ForwardGeocodeResponse } from '../../src/types';

// Mock the geocoding service
jest.mock('../../src/services/geocodingService', () => ({
  forwardGeocode: jest.fn(),
}));

// Mock global fetch for Ollama calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { forwardGeocode } = require('../../src/services/geocodingService');

const mockGeocodeResult: ForwardGeocodeResponse = {
  latitude: 18.5204,
  longitude: 73.8567,
  address: {
    street: 'FC Road',
    area: 'Deccan Gymkhana',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411004',
    displayName: 'FC Road, Deccan Gymkhana, Pune, Maharashtra 411004',
  },
  cached: false,
};

beforeEach(() => {
  clearCache();
  jest.clearAllMocks();
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('computes correct similarity for known vectors', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot = 4+10+18 = 32, normA = sqrt(14), normB = sqrt(77)
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected);
  });
});

describe('normalizeString', () => {
  it('lowercases input', () => {
    expect(normalizeString('HELLO WORLD')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(normalizeString('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeString('hello   world   test')).toBe('hello world test');
  });

  it('handles combined normalization', () => {
    expect(normalizeString('  FC  Road,  PUNE  ')).toBe('fc road, pune');
  });
});

describe('lookupWithCache', () => {
  it('returns geocoded result on cache miss with Ollama available', async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: fakeEmbedding }),
    });
    forwardGeocode.mockResolvedValueOnce(mockGeocodeResult);

    const result = await lookupWithCache('FC Road, Pune');

    expect(result).toEqual(mockGeocodeResult);
    expect(forwardGeocode).toHaveBeenCalledWith('FC Road, Pune');
    expect(getCacheSize()).toBe(1);
  });

  it('returns cached result on semantic cache hit', async () => {
    const embedding = [0.1, 0.2, 0.3];

    // First call — cache miss
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding }),
    });
    forwardGeocode.mockResolvedValueOnce(mockGeocodeResult);
    await lookupWithCache('FC Road, Pune');

    // Second call — same embedding → cache hit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding }),
    });

    const result = await lookupWithCache('FC Road Pune');
    expect(result.cached).toBe(true);
    expect(forwardGeocode).toHaveBeenCalledTimes(1); // Not called again
  });

  it('falls back to exact string matching when Ollama is unreachable', async () => {
    // First call — Ollama down, cache miss
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    forwardGeocode.mockResolvedValueOnce(mockGeocodeResult);
    await lookupWithCache('FC Road, Pune');

    // Second call — same normalized string, Ollama still down
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await lookupWithCache('  fc  road,  pune  ');

    expect(result.cached).toBe(true);
    expect(forwardGeocode).toHaveBeenCalledTimes(1);
  });

  it('calls geocoding on exact match miss when Ollama is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    forwardGeocode.mockResolvedValueOnce(mockGeocodeResult);

    const result = await lookupWithCache('Some new address');
    expect(result).toEqual(mockGeocodeResult);
    expect(forwardGeocode).toHaveBeenCalledTimes(1);
  });

  it('handles Ollama returning non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    forwardGeocode.mockResolvedValueOnce(mockGeocodeResult);

    const result = await lookupWithCache('Test address');
    expect(result).toEqual(mockGeocodeResult);
    expect(getCacheSize()).toBe(1);
  });
});

describe('evictExpiredEntries', () => {
  it('removes entries older than 7 days', () => {
    const oldEntry: SemanticCacheEntry = {
      query: 'old address',
      normalizedQuery: 'old address',
      embedding: [0.1, 0.2],
      result: mockGeocodeResult,
      timestamp: new Date(Date.now() - TTL_MS - 1000), // 7 days + 1 second ago
    };
    const freshEntry: SemanticCacheEntry = {
      query: 'fresh address',
      normalizedQuery: 'fresh address',
      embedding: [0.3, 0.4],
      result: mockGeocodeResult,
      timestamp: new Date(), // now
    };

    cache.set('old address', oldEntry);
    cache.set('fresh address', freshEntry);

    expect(getCacheSize()).toBe(2);
    const evicted = evictExpiredEntries();
    expect(evicted).toBe(1);
    expect(getCacheSize()).toBe(1);
    expect(cache.has('fresh address')).toBe(true);
    expect(cache.has('old address')).toBe(false);
  });

  it('does not remove entries within TTL', () => {
    const entry: SemanticCacheEntry = {
      query: 'recent address',
      normalizedQuery: 'recent address',
      embedding: [0.1],
      result: mockGeocodeResult,
      timestamp: new Date(Date.now() - TTL_MS + 60000), // within TTL
    };
    cache.set('recent address', entry);

    const evicted = evictExpiredEntries();
    expect(evicted).toBe(0);
    expect(getCacheSize()).toBe(1);
  });
});

describe('clearCache', () => {
  it('removes all entries', () => {
    cache.set('a', {
      query: 'a',
      normalizedQuery: 'a',
      embedding: [],
      result: mockGeocodeResult,
      timestamp: new Date(),
    });
    cache.set('b', {
      query: 'b',
      normalizedQuery: 'b',
      embedding: [],
      result: mockGeocodeResult,
      timestamp: new Date(),
    });

    expect(getCacheSize()).toBe(2);
    clearCache();
    expect(getCacheSize()).toBe(0);
  });
});
