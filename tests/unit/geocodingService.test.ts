import {
  forwardGeocode,
  reverseGeocode,
  autocomplete,
  isWithinIndiaBounds,
  normalizeAddress,
  fetchWithRetry,
  GeocodingServiceError,
  INDIA_BOUNDS,
  MAHARASHTRA_VIEWBOX,
  USER_AGENT,
} from '../../src/services/geocodingService';
import type { NominatimAddress } from '../../src/services/geocodingService';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('isWithinIndiaBounds', () => {
  it('returns true for coordinates within India', () => {
    expect(isWithinIndiaBounds(18.52, 73.85)).toBe(true); // Pune
    expect(isWithinIndiaBounds(19.07, 72.87)).toBe(true); // Mumbai
  });

  it('returns false for coordinates outside India', () => {
    expect(isWithinIndiaBounds(51.5, -0.12)).toBe(false); // London
    expect(isWithinIndiaBounds(5.0, 73.0)).toBe(false);   // Below min lat
    expect(isWithinIndiaBounds(36.0, 73.0)).toBe(false);  // Above max lat
    expect(isWithinIndiaBounds(20.0, 67.0)).toBe(false);  // Below min lng
    expect(isWithinIndiaBounds(20.0, 98.0)).toBe(false);  // Above max lng
  });

  it('returns true for boundary values', () => {
    expect(isWithinIndiaBounds(6.5, 68.1)).toBe(true);
    expect(isWithinIndiaBounds(35.7, 97.4)).toBe(true);
  });
});

describe('normalizeAddress', () => {
  it('normalizes a full Nominatim address', () => {
    const nominatim: NominatimAddress = {
      house_number: '42',
      road: 'MG Road',
      neighbourhood: 'Deccan Gymkhana',
      city: 'Pune',
      state: 'Maharashtra',
      postcode: '411004',
    };
    const result = normalizeAddress(nominatim, 'Full display name');
    expect(result).toEqual({
      street: '42 MG Road',
      area: 'Deccan Gymkhana',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411004',
      displayName: 'Full display name',
    });
  });

  it('handles missing fields gracefully', () => {
    const result = normalizeAddress({}, 'Some place');
    expect(result.street).toBe('');
    expect(result.area).toBe('');
    expect(result.city).toBe('');
    expect(result.state).toBe('');
    expect(result.postalCode).toBe('');
    expect(result.displayName).toBe('Some place');
  });

  it('uses suburb when neighbourhood is missing', () => {
    const result = normalizeAddress({ suburb: 'Kothrud' }, 'Place');
    expect(result.area).toBe('Kothrud');
  });

  it('uses town when city is missing', () => {
    const result = normalizeAddress({ town: 'Lonavala' }, 'Place');
    expect(result.city).toBe('Lonavala');
  });

  it('uses village when city and town are missing', () => {
    const result = normalizeAddress({ village: 'Lavasa' }, 'Place');
    expect(result.city).toBe('Lavasa');
  });
});

describe('fetchWithRetry', () => {
  it('returns response on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const response = await fetchWithRetry('https://example.com/test');
    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('includes User-Agent header in requests', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await fetchWithRetry('https://example.com/test');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test', {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
  });

  it('retries on 429 and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '1']]) as any,
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    // Mock headers.get
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => name === 'Retry-After' ? '0' : null },
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await fetchWithRetry('https://example.com/test');
    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries on persistent 429', async () => {
    const mock429 = {
      ok: false,
      status: 429,
      headers: { get: (name: string) => name === 'Retry-After' ? '0' : null },
    };

    mockFetch
      .mockResolvedValueOnce(mock429)
      .mockResolvedValueOnce(mock429)
      .mockResolvedValueOnce(mock429)
      .mockResolvedValueOnce(mock429);

    await expect(fetchWithRetry('https://example.com/test')).rejects.toThrow(
      'Geocoding service rate limit exceeded after maximum retries'
    );
    // Initial attempt + 3 retries = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('throws on non-429 error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
    });

    await expect(fetchWithRetry('https://example.com/test')).rejects.toThrow(
      'Nominatim API error: 500 Internal Server Error'
    );
  });

  it('respects Retry-After header value', async () => {
    const startTime = Date.now();
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => name === 'Retry-After' ? '0' : null },
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await fetchWithRetry('https://example.com/test');
    // With Retry-After: 0, should be nearly instant
    expect(Date.now() - startTime).toBeLessThan(1000);
  });
});

describe('forwardGeocode', () => {
  it('returns geocoded result for a valid address', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          place_id: 12345,
          display_name: 'Pune, Maharashtra, India',
          lat: '18.5204',
          lon: '73.8567',
          address: {
            city: 'Pune',
            state: 'Maharashtra',
            postcode: '411001',
            road: 'FC Road',
          },
        },
      ],
    });

    const result = await forwardGeocode('Pune');
    expect(result.latitude).toBe(18.5204);
    expect(result.longitude).toBe(73.8567);
    expect(result.address.city).toBe('Pune');
    expect(result.address.state).toBe('Maharashtra');
    expect(result.cached).toBe(false);
  });

  it('throws 404 when no results found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await expect(forwardGeocode('xyznonexistent')).rejects.toThrow(
      'No results found for the entered address'
    );
  });

  it('throws 400 for empty address', async () => {
    await expect(forwardGeocode('')).rejects.toThrow('Address query is required');
  });

  it('includes countrycodes=in in the request URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          place_id: 1,
          display_name: 'Test',
          lat: '18.0',
          lon: '73.0',
          address: { city: 'Test', state: 'Maharashtra' },
        },
      ],
    });

    await forwardGeocode('Test address');
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('countrycodes=in');
  });
});

describe('reverseGeocode', () => {
  it('returns structured address for valid India coordinates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        place_id: 12345,
        display_name: 'FC Road, Deccan, Pune, Maharashtra, 411004, India',
        lat: '18.5204',
        lon: '73.8567',
        address: {
          road: 'FC Road',
          neighbourhood: 'Deccan',
          city: 'Pune',
          state: 'Maharashtra',
          postcode: '411004',
        },
      }),
    });

    const result = await reverseGeocode(18.5204, 73.8567);
    expect(result.latitude).toBe(18.5204);
    expect(result.longitude).toBe(73.8567);
    expect(result.address.city).toBe('Pune');
    expect(result.address.state).toBe('Maharashtra');
  });

  it('throws error for coordinates outside India', async () => {
    await expect(reverseGeocode(51.5, -0.12)).rejects.toThrow(
      'Location detected is outside the supported region'
    );
  });

  it('throws error for NaN coordinates', async () => {
    await expect(reverseGeocode(NaN, 73.0)).rejects.toThrow(
      'Valid latitude and longitude are required'
    );
  });
});

describe('autocomplete', () => {
  it('returns suggestions scoped to Maharashtra', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          place_id: 1,
          display_name: 'Pune, Maharashtra, India',
          lat: '18.52',
          lon: '73.85',
        },
        {
          place_id: 2,
          display_name: 'Pundlik Nagar, Pune, Maharashtra, India',
          lat: '18.50',
          lon: '73.87',
        },
      ],
    });

    const result = await autocomplete('Pun');
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0].displayName).toBe('Pune, Maharashtra, India');
    expect(result.suggestions[0].placeId).toBe('1');
  });

  it('includes Maharashtra viewbox in request URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await autocomplete('Test');
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('viewbox=');
    expect(calledUrl).toContain('bounded=1');
    expect(calledUrl).toContain('countrycodes=in');
  });

  it('throws 400 for empty query', async () => {
    await expect(autocomplete('')).rejects.toThrow('Search query is required');
  });

  it('returns empty suggestions when no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await autocomplete('xyznonexistent');
    expect(result.suggestions).toHaveLength(0);
  });
});
