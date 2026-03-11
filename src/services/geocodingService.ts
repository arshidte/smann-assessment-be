import {
  StructuredAddress,
  ForwardGeocodeResponse,
  ReverseGeocodeResponse,
  AutocompleteResponse,
  AddressSuggestion,
} from '../types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'PWADeliveryTracker/1.0 (delivery-tracker-app)';
const MAX_RETRIES = 3;

// Nominatim requires max 1 request/second. This queue ensures compliance.
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100; // slightly over 1s for safety

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// India bounding box
const INDIA_BOUNDS = {
  minLat: 6.5,
  maxLat: 35.7,
  minLng: 68.1,
  maxLng: 97.4,
};

// Maharashtra bounding box for autocomplete scoping
const MAHARASHTRA_VIEWBOX = {
  minLon: 72.6,
  maxLon: 80.9,
  minLat: 15.6,
  maxLat: 22.1,
};

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface NominatimReverseResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

export class GeocodingServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'GeocodingServiceError';
  }
}

function isWithinIndiaBounds(lat: number, lon: number): boolean {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lon >= INDIA_BOUNDS.minLng &&
    lon <= INDIA_BOUNDS.maxLng
  );
}

function normalizeAddress(nominatim: NominatimAddress, displayName: string): StructuredAddress {
  const street = [nominatim.house_number, nominatim.road].filter(Boolean).join(' ') || '';
  const area = nominatim.neighbourhood || nominatim.suburb || '';
  const city = nominatim.city || nominatim.town || nominatim.village || '';
  const state = nominatim.state || '';
  const postalCode = nominatim.postcode || '';

  return {
    street,
    area,
    city,
    state,
    postalCode,
    displayName,
  };
}

async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      if (attempt >= retries) {
        throw new GeocodingServiceError(
          'Geocoding service rate limit exceeded after maximum retries',
          503
        );
      }

      const retryAfter = response.headers.get('Retry-After');
      const delaySeconds = retryAfter ? parseInt(retryAfter, 10) : 2;
      const delayMs = (isNaN(delaySeconds) ? 2 : Math.max(delaySeconds, 2)) * 1000;

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (!response.ok) {
      lastError = new GeocodingServiceError(
        `Nominatim API error: ${response.status} ${response.statusText}`,
        503
      );
      throw lastError;
    }

    return response;
  }

  throw lastError || new GeocodingServiceError('Unexpected error in fetch retry logic', 500);
}

export async function forwardGeocode(address: string): Promise<ForwardGeocodeResponse> {
  if (!address || address.trim().length === 0) {
    throw new GeocodingServiceError('Address query is required', 400);
  }

  const params = new URLSearchParams({
    q: address,
    format: 'json',
    countrycodes: 'in',
    limit: '5',
    addressdetails: '1',
  });

  const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
  const response = await fetchWithRetry(url);
  const results = (await response.json()) as NominatimSearchResult[];

  if (!results || results.length === 0) {
    throw new GeocodingServiceError('No results found for the entered address', 404);
  }

  const top = results[0];
  const lat = parseFloat(top.lat);
  const lon = parseFloat(top.lon);
  const structuredAddress = normalizeAddress(top.address || {}, top.display_name);

  return {
    latitude: lat,
    longitude: lon,
    address: structuredAddress,
    cached: false,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResponse> {
  if (isNaN(lat) || isNaN(lon)) {
    throw new GeocodingServiceError('Valid latitude and longitude are required', 400);
  }

  if (!isWithinIndiaBounds(lat, lon)) {
    throw new GeocodingServiceError('Location detected is outside the supported region', 400);
  }

  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    addressdetails: '1',
  });

  const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;
  const response = await fetchWithRetry(url);
  const result = (await response.json()) as NominatimReverseResult;

  if (!result || !result.address) {
    throw new GeocodingServiceError('No results found for the given coordinates', 404);
  }

  const structuredAddress = normalizeAddress(result.address, result.display_name);

  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    address: structuredAddress,
  };
}

export async function autocomplete(
  query: string,
  userLat?: number,
  userLon?: number
): Promise<AutocompleteResponse> {
  if (!query || query.trim().length === 0) {
    throw new GeocodingServiceError('Search query is required', 400);
  }

  // If user location is provided, build a ~25 km viewbox around them for proximity bias.
  // Otherwise fall back to the Maharashtra viewbox.
  let viewbox: string;
  if (userLat !== undefined && userLon !== undefined && !isNaN(userLat) && !isNaN(userLon)) {
    const offset = 0.25; // ~25 km at Indian latitudes
    viewbox = `${userLon - offset},${userLat + offset},${userLon + offset},${userLat - offset}`;
  } else {
    viewbox = `${MAHARASHTRA_VIEWBOX.minLon},${MAHARASHTRA_VIEWBOX.maxLat},${MAHARASHTRA_VIEWBOX.maxLon},${MAHARASHTRA_VIEWBOX.minLat}`;
  }

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: 'in',
    limit: '5',
    addressdetails: '1',
    viewbox,
    bounded: '0',
  });

  const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
  const response = await fetchWithRetry(url);
  const results = (await response.json()) as NominatimSearchResult[];

  const suggestions: AddressSuggestion[] = (results || []).map((r) => ({
    displayName: r.display_name,
    placeId: r.place_id.toString(),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));

  return { suggestions };
}

// Exported for testing
export {
  isWithinIndiaBounds,
  normalizeAddress,
  fetchWithRetry,
  throttle,
  INDIA_BOUNDS,
  MAHARASHTRA_VIEWBOX,
  MAX_RETRIES,
  MIN_REQUEST_INTERVAL_MS,
  NOMINATIM_BASE_URL,
  USER_AGENT,
};
export type { NominatimAddress, NominatimSearchResult, NominatimReverseResult };
