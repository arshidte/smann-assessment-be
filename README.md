# PWA Delivery Tracker — Full Application Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Frontend](#frontend)
6. [Backend](#backend)
7. [Data Models & Type Definitions](#data-models--type-definitions)
8. [API Reference](#api-reference)
9. [WebSocket Protocol](#websocket-protocol)
10. [Semantic Cache](#semantic-cache)
11. [Agent Simulator](#agent-simulator)
12. [PWA Configuration](#pwa-configuration)
13. [Error Handling](#error-handling)
14. [Testing](#testing)
15. [Configuration & Environment Variables](#configuration--environment-variables)
16. [Running the Application](#running-the-application)

---

## Overview

PWA Delivery Tracker is a production-ready Progressive Web App for delivery tracking in the Maharashtra region of India. It consists of two core user flows:

1. **Address Lookup** — Users provide or auto-detect their address via browser geolocation, view it on an interactive Leaflet map, and get structured, editable address fields. A semantic cache backed by Ollama LLM embeddings reduces redundant geocoding API calls.

2. **Live Delivery Agent Tracking** — Users observe a simulated delivery agent's real-time position on a Leaflet map, streamed via WebSockets. The agent follows a predefined route through Pune, Maharashtra with realistic speed variations.

The application is a classic client-server split: a **Next.js 14 PWA frontend** communicates with a standalone **Express TypeScript backend** over REST (geocoding) and WebSocket (tracking).

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────┐
│              Frontend — Next.js 14 PWA              │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Address Page  │  │ Tracking Page│  │  Service   │ │
│  │   (/)        │  │  (/tracking) │  │  Worker    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┘ │
│         │                 │                         │
│  ┌──────┴───────┐  ┌──────┴───────┐                │
│  │ TypeaheadInput│  │ LeafletMap   │                │
│  │ ExpandedFields│  │ (tracking)   │                │
│  │ LeafletMap    │  │              │                │
│  │ (address)     │  │              │                │
│  └──────┬───────┘  └──────┬───────┘                │
│         │ REST             │ WebSocket              │
└─────────┼─────────────────┼────────────────────────┘
          │                 │
┌─────────┼─────────────────┼────────────────────────┐
│         ▼                 ▼                         │
│  ┌─────────────┐  ┌──────────────┐                 │
│  │  REST API   │  │  WebSocket   │                 │
│  │  Routes     │  │  Server      │                 │
│  └──────┬──────┘  └──────┬───────┘                 │
│         │                │                          │
│  ┌──────┴──────┐  ┌──────┴───────┐                 │
│  │  Semantic   │  │    Agent     │                 │
│  │  Cache      │  │  Simulator   │                 │
│  └──────┬──────┘  └──────────────┘                 │
│         │                                           │
│  ┌──────┴──────┐                                   │
│  │  Geocoding  │                                   │
│  │  Service    │                                   │
│  └──────┬──────┘                                   │
│         │          Backend — Express TypeScript     │
└─────────┼──────────────────────────────────────────┘
          │
    ┌─────┴──────────────────────┐
    │     External Services      │
    │                            │
    │  ┌──────────────────────┐  │
    │  │ OpenStreetMap        │  │
    │  │ Nominatim API        │  │
    │  └──────────────────────┘  │
    │  ┌──────────────────────┐  │
    │  │ Ollama (local LLM)   │  │
    │  │ nomic-embed-text     │  │
    │  └──────────────────────┘  │
    └────────────────────────────┘
```

### Communication Flow

- **Address Lookup Flow**: User enters address or grants geolocation → Frontend calls REST API → Backend checks semantic cache → On miss, calls Nominatim → Returns structured address + coordinates → Frontend renders on Leaflet map
- **Tracking Flow**: Frontend opens WebSocket to `/ws/tracking` → Backend agent simulator ticks every 2 seconds → Broadcasts `AgentLocationUpdate` JSON → Frontend animates marker + draws polyline trail

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.2+ | React framework with App Router, SSR/SSG |
| React | 18.3+ | UI library |
| Leaflet | 1.9.4 | Interactive map rendering |
| react-leaflet | 4.2.1 | React bindings for Leaflet |
| next-pwa | 5.6.0 | PWA service worker generation |
| TypeScript | 5.3+ | Type safety |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express | 4.21+ | HTTP server framework |
| ws | 8.18+ | WebSocket server |
| TypeScript | 5.3+ | Type safety |
| ts-node | 10.9+ | TypeScript execution for development |

### External Services
| Service | Purpose |
|---|---|
| OpenStreetMap Nominatim | Geocoding (forward, reverse, autocomplete) |
| Ollama (local) | LLM embedding generation for semantic cache (`nomic-embed-text` model) |

### Testing
| Tool | Purpose |
|---|---|
| Jest | Test runner (v29 frontend, v30 backend) |
| ts-jest | TypeScript transform for Jest |
| fast-check | Property-based testing |
| @testing-library/react | React component testing |
| @testing-library/jest-dom | DOM assertion matchers |

---

## Project Structure

```
pwa-delivery-tracker/
├── .kiro/                          # Kiro IDE specs and steering
│   └── specs/pwa-delivery-tracker/
│       ├── requirements.md         # 14 formal requirements
│       ├── design.md               # Architecture, data models, 18 correctness properties
│       └── tasks.md                # Implementation plan with task tracking
├── backend/                        # Express TypeScript backend
│   ├── src/
│   │   ├── index.ts                # App entry point, Express setup, server boot
│   │   ├── types.ts                # Backend type definitions
│   │   ├── routes/
│   │   │   └── geocodeRoutes.ts    # REST API route handlers
│   │   ├── services/
│   │   │   ├── geocodingService.ts # Nominatim API integration
│   │   │   ├── semanticCache.ts    # LLM-powered semantic cache
│   │   │   └── agentSimulator.ts   # Delivery agent route simulator
│   │   └── ws/
│   │       └── trackingServer.ts   # WebSocket server for live tracking
│   ├── tests/unit/                 # Backend unit tests
│   │   ├── agentSimulator.test.ts
│   │   ├── geocodingService.test.ts
│   │   ├── semanticCache.test.ts
│   │   └── trackingServer.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
├── frontend/                       # Next.js PWA frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout with Leaflet CSS, metadata, manifest
│   │   │   ├── page.tsx            # Address Lookup page (home)
│   │   │   ├── globals.css         # Global styles
│   │   │   └── tracking/
│   │   │       └── page.tsx        # Live Tracking page
│   │   ├── components/
│   │   │   ├── TypeaheadInput.tsx  # Debounced address autocomplete input
│   │   │   ├── ExpandedAddressFields.tsx # Editable structured address fields
│   │   │   ├── LeafletMap.tsx      # Dynamic import wrapper (SSR disabled)
│   │   │   └── LeafletMapInner.tsx # Actual Leaflet map implementation
│   │   ├── services/
│   │   │   └── api.ts              # Backend API client functions
│   │   ├── types.ts                # Frontend type definitions
│   │   └── utils/
│   │       ├── backoff.ts          # Exponential backoff calculator
│   │       └── backoff.test.ts     # Backoff unit tests
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   ├── sw.js                   # Generated service worker
│   │   ├── workbox-*.js            # Workbox runtime
│   │   └── icons/
│   │       ├── icon-192x192.png    # PWA icon (small)
│   │       └── icon-512x512.png    # PWA icon (large)
│   ├── tests/
│   │   └── .gitkeep
│   ├── package.json                # Frontend dependencies
│   ├── next.config.js              # Next.js + PWA configuration
│   ├── tsconfig.json               # Frontend TypeScript config
│   └── jest.config.js              # Frontend Jest config
└── DOCUMENTATION.md
```

---

## Frontend

### Pages

#### Address Lookup Page (`src/app/page.tsx` — route: `/`)

The home page of the application. Handles the full address lookup flow:

1. **Geolocation on mount**: Requests the browser's Geolocation API on page load with a 10-second timeout.
   - **Permission granted**: Obtains lat/lng, calls reverse geocode API, populates address fields and map.
   - **Permission denied**: Shows the TypeaheadInput for manual address entry without an error state.
   - **Timeout/unavailable**: Shows TypeaheadInput + an informational banner: "Automatic location detection is unavailable."

2. **Address search**: Users type into the TypeaheadInput, select a suggestion, which triggers forward geocoding.

3. **Map display**: A Leaflet map centers on the resolved coordinates with a marker and popup showing the full address.

4. **Editable fields**: The ExpandedAddressFields component shows street, area, city, state, and postal code as editable inputs. An "Update Location" button re-geocodes the combined edited address.

5. **Navigation**: A link at the bottom navigates to the Live Tracking page.

**State management**:
- `coords: LatLng | null` — Current map coordinates
- `address: StructuredAddress | null` — Resolved structured address
- `loading: boolean` — Loading indicator
- `error: string | null` — Error message display
- `geoStatus: 'pending' | 'granted' | 'denied' | 'unavailable'` — Geolocation permission state

#### Live Tracking Page (`src/app/tracking/page.tsx` — route: `/tracking`)

Real-time delivery agent tracking page:

1. **WebSocket connection**: Establishes a WebSocket connection to `ws://{backend}/ws/tracking` on mount.

2. **Live updates**: Parses incoming `AgentLocationUpdate` JSON messages and updates:
   - Agent marker position on the map
   - Polyline trail (accumulated path)
   - Speed display (km/h)
   - Last update timestamp

3. **Connection status**: Shows a colored indicator:
   - Green: "Connected — receiving live updates"
   - Orange: "Reconnecting..."

4. **Reconnection**: On disconnect, uses exponential backoff (1s → 2s → 4s → ... → 30s max) to reconnect. On reconnect, resumes live updates from the latest position.

5. **Cleanup**: Properly closes WebSocket and clears timers on unmount.

**State management**:
- `agentPosition: LatLng` — Current agent position (default: Pune center)
- `path: LatLng[]` — Accumulated polyline trail
- `speed: number` — Current agent speed in km/h
- `lastUpdate: Date | null` — Timestamp of last received update
- `connected: boolean` — WebSocket connection status

#### Root Layout (`src/app/layout.tsx`)

- Sets HTML lang to `en`
- Loads Leaflet CSS from CDN with integrity hash
- Configures metadata: title "Delivery Tracker", description, manifest link, theme color `#1976d2`

### Components

#### TypeaheadInput (`src/components/TypeaheadInput.tsx`)

A debounced autocomplete input for address search.

**Props**:
- `onSelect: (suggestion: AddressSuggestion) => void` — Callback when a suggestion is selected
- `disabled?: boolean` — Disables input during loading
- `userLocation?: { lat: number; lng: number } | null` — Optional user location for proximity-biased results

**Behavior**:
- Debounces keystrokes by **300ms** before sending API requests
- Only sends requests when input length ≥ **3 characters**
- Handles paste events as search queries (prevents default, triggers debounced fetch)
- Displays a dropdown suggestion list with hover highlighting
- Closes dropdown when clicking outside the component
- Shows a "Loading…" indicator during API calls
- Uses ARIA attributes: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`

#### ExpandedAddressFields (`src/components/ExpandedAddressFields.tsx`)

Renders structured address fields as editable inputs.

**Props**:
- `address: StructuredAddress` — The address to display
- `onChange: (field: string, value: string) => void` — Callback on field edit
- `onUpdate: () => void` — Callback for the "Update Location" button

**Fields rendered**:
| Field | Label | Maps to |
|---|---|---|
| `street` | Street / Building | `address.street` |
| `area` | Area / Locality | `address.area` |
| `city` | City | `address.city` |
| `state` | State | `address.state` |
| `postalCode` | Postal Code | `address.postalCode` |

Each field has a proper `<label>` with `htmlFor` and `aria-label` for accessibility.

#### LeafletMap (`src/components/LeafletMap.tsx`)

A dynamic import wrapper that loads `LeafletMapInner` with `ssr: false` (Leaflet requires `window`/`document`). Shows a "Loading map…" placeholder during load.

#### LeafletMapInner (`src/components/LeafletMapInner.tsx`)

The actual Leaflet map implementation using `react-leaflet`.

**Props** (`LeafletMapProps`):
- `center: LatLng` — Map center coordinates
- `markers: MapMarker[]` — Array of markers to display
- `polyline?: LatLng[]` — Optional polyline path (tracking mode)
- `mode: 'address' | 'tracking'` — Display mode

**Modes**:
- **Address mode**: Zoom level 15, default blue marker icon, `setView` on center change
- **Tracking mode**: Zoom level 16, red agent marker icon, `panTo` on center change, draws blue polyline trail (`#1976d2`, weight 4, opacity 0.7)

**Features**:
- Uses OpenStreetMap tile layer
- `RecenterMap` helper component auto-pans/recenters when `center` prop changes
- Skips recentering on first render to avoid jarring initial animation
- Marker icons loaded from CDN (unpkg for default, GitHub for red agent marker)

### Services

#### API Client (`src/services/api.ts`)

Wraps backend REST endpoints with error handling.

**Functions**:
- `forwardGeocode(address: string): Promise<ForwardGeocodeResponse>` — Calls `GET /api/geocode/forward?address={query}`
- `reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResponse>` — Calls `GET /api/geocode/reverse?lat={lat}&lon={lon}`
- `autocomplete(query: string, lat?: number, lon?: number): Promise<AutocompleteResponse>` — Calls `GET /api/address/autocomplete?q={query}[&lat={lat}&lon={lon}]`

**Error handling**: All functions catch network errors and non-OK responses, throwing user-facing `Error` messages:
- Network failure: "Geocoding service is temporarily unavailable. Please try again."
- 404: "No results found for the entered address."
- Other errors: Extracts `message` from JSON error body or falls back to generic message

**Configuration**: Backend URL from `NEXT_PUBLIC_BACKEND_URL` env var, defaults to `http://localhost:3001`.

### Utilities

#### Exponential Backoff (`src/utils/backoff.ts`)

```typescript
calculateBackoff(attempt: number): number
```

Returns `min(2^(attempt-1) * 1000, 30000)` milliseconds.

| Attempt | Delay |
|---|---|
| 1 | 1,000ms |
| 2 | 2,000ms |
| 3 | 4,000ms |
| 4 | 8,000ms |
| 5 | 16,000ms |
| 6+ | 30,000ms (cap) |

### Global Styles (`src/app/globals.css`)

Minimal reset: `box-sizing: border-box`, zero margins/padding, system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`), light gray background (`#f5f5f5`), blue links (`#1976d2`).

---

## Backend

### Entry Point (`backend/src/index.ts`)

Bootstraps the Express application:

1. Creates Express app with CORS (allowing `FRONTEND_ORIGIN`, default `http://localhost:3000`) and JSON body parsing
2. Registers `GET /health` endpoint returning `{ status: 'ok' }`
3. Mounts geocoding routes under `/api`
4. Registers the geocoding error handler middleware
5. Starts HTTP server on `PORT` (default `3001`)
6. On server start:
   - Starts the semantic cache eviction timer
   - Creates the WebSocket tracking server attached to the HTTP server
   - Starts the agent simulator, wiring its output to the WebSocket broadcast function

### Routes (`backend/src/routes/geocodeRoutes.ts`)

Three REST endpoints on an Express Router:

#### `GET /api/geocode/forward?address={query}`
- Validates `address` query parameter (400 if missing/empty)
- Calls `lookupWithCache(address)` from the semantic cache service
- Returns `ForwardGeocodeResponse` JSON with `cached: boolean` flag

#### `GET /api/geocode/reverse?lat={lat}&lon={lon}`
- Validates `lat` and `lon` query parameters (400 if missing or non-numeric)
- Calls `reverseGeocode(lat, lon)` from the geocoding service
- Returns `ReverseGeocodeResponse` JSON

#### `GET /api/address/autocomplete?q={query}[&lat={lat}&lon={lon}]`
- Validates `q` query parameter (400 if missing/empty)
- Optionally accepts `lat`/`lon` for proximity-biased results
- Calls `autocomplete(query, lat, lon)` from the geocoding service
- Returns `AutocompleteResponse` JSON

#### Error Handler Middleware (`geocodingErrorHandler`)
- Catches `GeocodingServiceError` instances and returns appropriate HTTP status + `ErrorResponse` JSON
- Catches unhandled errors, logs full details server-side, returns generic 500 `ErrorResponse`
- Passes through if headers already sent

### Services

#### Geocoding Service (`backend/src/services/geocodingService.ts`)

Wraps the OpenStreetMap Nominatim API for all geocoding operations.

**Constants**:
- `NOMINATIM_BASE_URL`: `https://nominatim.openstreetmap.org`
- `USER_AGENT`: `PWADeliveryTracker/1.0 (delivery-tracker-app)`
- `MAX_RETRIES`: 3
- `INDIA_BOUNDS`: lat 6.5–35.7, lng 68.1–97.4
- `MAHARASHTRA_VIEWBOX`: lon 72.6–80.9, lat 15.6–22.1

**Functions**:

| Function | Description |
|---|---|
| `forwardGeocode(address)` | Searches Nominatim with `countrycodes=in`, limit 5, returns top result as `ForwardGeocodeResponse` |
| `reverseGeocode(lat, lon)` | Validates India bounds, calls Nominatim reverse, returns `ReverseGeocodeResponse` |
| `autocomplete(query, userLat?, userLon?)` | Searches with Maharashtra viewbox (or 25km radius around user), returns up to 5 `AddressSuggestion`s |
| `fetchWithRetry(url, retries)` | Fetches with User-Agent header, retries on HTTP 429 respecting `Retry-After`, max 3 retries |
| `isWithinIndiaBounds(lat, lon)` | Validates coordinates are within India's bounding box |
| `normalizeAddress(nominatim, displayName)` | Converts Nominatim address fields to `StructuredAddress` |

**Error handling**:
- Empty/missing address → `GeocodingServiceError` (400)
- No results → `GeocodingServiceError` (404)
- Out-of-bounds coordinates → `GeocodingServiceError` (400)
- NaN coordinates → `GeocodingServiceError` (400)
- Rate limited (429) → Retries up to 3 times, then `GeocodingServiceError` (503)
- API errors → `GeocodingServiceError` (503)

**Address normalization logic**:
- `street`: `house_number` + `road`
- `area`: `neighbourhood` → `suburb` (fallback chain)
- `city`: `city` → `town` → `village` (fallback chain)
- `state`: `state`
- `postalCode`: `postcode`

#### Semantic Cache (`backend/src/services/semanticCache.ts`)

An in-memory caching layer that uses LLM-generated embeddings to avoid redundant geocoding API calls for semantically similar addresses.

**How it works**:
1. On lookup, generates a vector embedding of the query string via Ollama (`nomic-embed-text` model)
2. Computes cosine similarity against all cached embeddings
3. If similarity ≥ **0.92** (threshold), returns cached result (cache hit)
4. On miss, calls the geocoding service, stores result + embedding + timestamp

**Fallback**: When Ollama is unreachable, falls back to exact normalized string matching (lowercase, trim, collapse whitespace).

**Configuration**:
| Constant | Value | Description |
|---|---|---|
| `OLLAMA_EMBEDDING_URL` | `http://localhost:11434/api/embeddings` | Ollama API endpoint |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model name |
| `SIMILARITY_THRESHOLD` | 0.92 | Cosine similarity threshold for cache hits |
| `TTL_MS` | 7 days (604,800,000ms) | Cache entry time-to-live |
| `EVICTION_INTERVAL_MS` | 1 hour (3,600,000ms) | How often expired entries are purged |

**Functions**:
| Function | Description |
|---|---|
| `lookupWithCache(address)` | Main entry point — checks cache, falls back to geocoding |
| `cosineSimilarity(a, b)` | Computes cosine similarity between two vectors |
| `normalizeString(input)` | Lowercase, trim, collapse whitespace |
| `generateEmbedding(text)` | Calls Ollama API, returns `number[]` or `null` on failure |
| `findSemanticMatch(embedding)` | Finds best cache entry above threshold |
| `findExactMatch(normalizedQuery)` | Exact normalized string lookup (fallback) |
| `evictExpiredEntries()` | Removes entries older than 7 days, returns count evicted |
| `startEvictionTimer()` | Starts hourly eviction interval |
| `stopEvictionTimer()` | Stops eviction interval |
| `clearCache()` | Removes all entries (testing) |
| `getCacheSize()` | Returns current entry count |

**Observability**: Logs cache hits with similarity score and matched query, logs misses, logs eviction counts.

#### Agent Simulator (`backend/src/services/agentSimulator.ts`)

Simulates a delivery agent moving along a predefined route through Pune, Maharashtra.

**Route**: 25 waypoints covering major Pune landmarks:
Shivajinagar → FC Road → Deccan Gymkhana → JM Road → Sambhaji Park → Prabhat Road → Law College Road → Swargate → Pune Station → MG Road → Koregaon Park → Boat Club Road → Bund Garden → Yerawada → Aga Khan Palace → Nagar Road → Viman Nagar → Kalyani Nagar → back toward Shivajinagar

**Speed variation**: Each segment has a predefined speed alternating between:
- Walking: ~5 km/h (at landmarks, parks, tourist spots)
- Driving: ~28–40 km/h (on main roads)

**Behavior**:
- Ticks every **2 seconds** (`TICK_INTERVAL_MS = 2000`)
- Advances one waypoint per tick
- Loops back to start when route ends (`index = tickCount % routeLength`)
- Agent ID: `agent-001`

**Functions**:
| Function | Description |
|---|---|
| `tick()` | Advances one step, returns `AgentLocationUpdate` |
| `start(callback)` | Starts interval, calls callback with update every 2s |
| `stop()` | Stops the interval |
| `getState()` | Returns current `AgentSimulatorState` |
| `reset()` | Stops and resets tick count to 0 (testing) |

### WebSocket Server (`backend/src/ws/trackingServer.ts`)

Manages real-time communication for live tracking.

**Path**: `/ws/tracking`

**Functions**:
| Function | Description |
|---|---|
| `createTrackingServer(httpServer)` | Creates and attaches WebSocket server to HTTP server |
| `broadcast(update)` | Sends `AgentLocationUpdate` JSON to all connected clients |
| `getClientCount()` | Returns number of currently connected clients |

**Lifecycle**:
- Logs client connections and disconnections with total client count
- Handles client errors by terminating the connection
- Broadcasts only to clients in `OPEN` ready state
- Logs broadcast send errors

---

## Data Models & Type Definitions

### Shared Types (both `src/types.ts` and `backend/src/types.ts`)

```typescript
interface StructuredAddress {
  street: string;       // Street/Building name (e.g., "42 MG Road")
  area: string;         // Area/Locality (e.g., "Deccan Gymkhana")
  city: string;         // City (e.g., "Pune")
  state: string;        // State (e.g., "Maharashtra")
  postalCode: string;   // PIN code (e.g., "411004")
  displayName: string;  // Full single-line address
}

interface LatLng {
  lat: number;
  lng: number;
}

interface AddressSuggestion {
  displayName: string;  // Full address text
  placeId: string;      // Nominatim place ID
  lat: number;
  lon: number;
}

interface ForwardGeocodeResponse {
  latitude: number;
  longitude: number;
  address: StructuredAddress;
  cached: boolean;      // Whether result came from semantic cache
}

interface ReverseGeocodeResponse {
  latitude: number;
  longitude: number;
  address: StructuredAddress;
}

interface AutocompleteResponse {
  suggestions: AddressSuggestion[];
}

interface AgentLocationUpdate {
  agentId: string;      // e.g., "agent-001"
  latitude: number;
  longitude: number;
  timestamp: string;    // ISO 8601
  speed: number;        // km/h
}

interface ErrorResponse {
  status: number;       // HTTP status code
  message: string;      // User-facing error message
  timestamp: string;    // ISO 8601
}
```

### Backend-Only Types

```typescript
interface SemanticCacheEntry {
  query: string;              // Original query string
  normalizedQuery: string;    // Lowercased, trimmed, whitespace-collapsed
  embedding: number[];        // Vector from Ollama (empty if Ollama unavailable)
  result: ForwardGeocodeResponse;
  timestamp: Date;
}

interface AgentSimulatorState {
  routeWaypoints: LatLng[];
  currentIndex: number;
  agentId: string;
  intervalMs: number;         // 2000
}
```

---

## API Reference

### Base URL

Default: `http://localhost:3001`

### Endpoints

#### Health Check

```
GET /health
```

**Response** (200):
```json
{ "status": "ok" }
```

#### Forward Geocode

```
GET /api/geocode/forward?address={query}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `address` | string | Yes | Address text to geocode |

**Response** (200):
```json
{
  "latitude": 18.5204,
  "longitude": 73.8567,
  "address": {
    "street": "FC Road",
    "area": "Deccan Gymkhana",
    "city": "Pune",
    "state": "Maharashtra",
    "postalCode": "411004",
    "displayName": "FC Road, Deccan Gymkhana, Pune, Maharashtra 411004, India"
  },
  "cached": false
}
```

**Errors**:
- `400` — Missing or empty `address` parameter
- `404` — No results found
- `503` — Nominatim API unavailable or rate limited

#### Reverse Geocode

```
GET /api/geocode/reverse?lat={latitude}&lon={longitude}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude |
| `lon` | number | Yes | Longitude |

**Response** (200):
```json
{
  "latitude": 18.5204,
  "longitude": 73.8567,
  "address": {
    "street": "FC Road",
    "area": "Deccan",
    "city": "Pune",
    "state": "Maharashtra",
    "postalCode": "411004",
    "displayName": "FC Road, Deccan, Pune, Maharashtra, 411004, India"
  }
}
```

**Errors**:
- `400` — Missing, non-numeric, or out-of-India-bounds coordinates
- `404` — No results for given coordinates
- `503` — Nominatim API unavailable

#### Address Autocomplete

```
GET /api/address/autocomplete?q={query}[&lat={lat}&lon={lon}]
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | Yes | Search query (partial address) |
| `lat` | number | No | User latitude for proximity bias |
| `lon` | number | No | User longitude for proximity bias |

**Response** (200):
```json
{
  "suggestions": [
    {
      "displayName": "Pune, Maharashtra, India",
      "placeId": "12345",
      "lat": 18.5204,
      "lon": 73.8567
    }
  ]
}
```

**Behavior**:
- Scoped to India (`countrycodes=in`)
- If `lat`/`lon` provided: uses a ~25km viewbox around user for proximity bias
- Otherwise: uses Maharashtra viewbox (lon 72.6–80.9, lat 15.6–22.1)
- Returns up to 5 suggestions
- `bounded=0` allows results outside viewbox (viewbox is preference, not restriction)

**Errors**:
- `400` — Missing or empty `q` parameter

### Error Response Format

All error responses follow this structure:

```json
{
  "status": 400,
  "message": "Missing required query parameter: address",
  "timestamp": "2026-03-11T10:30:00.000Z"
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Invalid/missing parameters |
| 404 | No geocoding results found |
| 500 | Internal server error |
| 503 | Upstream service unavailable (Nominatim down, rate limited) |

---

## WebSocket Protocol

### Connection

```
ws://{host}:{port}/ws/tracking
```

Default: `ws://localhost:3001/ws/tracking`

### Message Format

The server pushes `AgentLocationUpdate` JSON messages at ~2-second intervals. No client-to-server messages are required.

```json
{
  "agentId": "agent-001",
  "latitude": 18.5308,
  "longitude": 73.8475,
  "timestamp": "2026-03-11T10:30:00.000Z",
  "speed": 5
}
```

### Client Reconnection Strategy

The frontend implements exponential backoff on disconnect:

```
Attempt 1: wait 1s
Attempt 2: wait 2s
Attempt 3: wait 4s
Attempt 4: wait 8s
Attempt 5: wait 16s
Attempt 6+: wait 30s (cap)
```

Formula: `min(2^(attempt-1) * 1000, 30000)` ms

On reconnect, the client resumes receiving updates from the agent's current position. The polyline trail continues accumulating from where it left off.

---

## Semantic Cache

### Overview

The semantic cache sits between the REST API and the geocoding service for forward geocode requests. It reduces redundant Nominatim API calls by recognizing that queries like "FC Road Pune" and "fc road, pune" are semantically equivalent.

### Cache Lookup Flow

```
1. Receive address query
2. Try to generate embedding via Ollama
   ├── Ollama available:
   │   ├── Compute cosine similarity against all cached embeddings
   │   ├── Similarity ≥ 0.92 → CACHE HIT (return cached result with cached: true)
   │   └── Similarity < 0.92 → CACHE MISS (call geocoding, store result + embedding)
   └── Ollama unavailable:
       ├── Normalize query (lowercase, trim, collapse whitespace)
       ├── Exact match in cache → CACHE HIT (return cached result with cached: true)
       └── No match → CACHE MISS (call geocoding, store result with empty embedding)
```

### Cosine Similarity

Used to compare embedding vectors:

```
similarity = (A · B) / (||A|| × ||B||)
```

Where `A · B` is the dot product and `||A||` is the Euclidean norm. Returns a value between -1 and 1, where 1 means identical.

### TTL Eviction

- Entries older than **7 days** are automatically purged
- Eviction runs every **1 hour** via `setInterval`
- Eviction count is logged for observability

---

## Agent Simulator

### Route Details

The simulator follows a 25-waypoint route through Pune, Maharashtra:

| # | Location | Lat | Lng | Speed (km/h) |
|---|---|---|---|---|
| 1 | Shivajinagar Bus Stand | 18.5308 | 73.8475 | 5 (walking) |
| 2 | Ferguson College | 18.5270 | 73.8410 | 32 (driving) |
| 3 | FC Road mid-point | 18.5235 | 73.8390 | 35 (driving) |
| 4 | Deccan Gymkhana | 18.5195 | 73.8370 | 5 (walking) |
| 5 | JM Road | 18.5170 | 73.8410 | 30 (driving) |
| 6 | Sambhaji Park | 18.5145 | 73.8450 | 5 (walking) |
| 7 | Prabhat Road | 18.5120 | 73.8380 | 28 (driving) |
| 8 | Law College Road | 18.5090 | 73.8420 | 33 (driving) |
| 9 | Swargate Bus Depot | 18.5020 | 73.8565 | 38 (driving) |
| 10 | Swargate Chowk | 18.5050 | 73.8620 | 35 (driving) |
| 11 | Pune Station approach | 18.5120 | 73.8680 | 40 (driving) |
| 12 | Pune Railway Station | 18.5285 | 73.8745 | 36 (driving) |
| 13 | MG Road | 18.5330 | 73.8800 | 30 (driving) |
| 14 | Koregaon Park entrance | 18.5365 | 73.8930 | 5 (walking) |
| 15 | Koregaon Park main road | 18.5370 | 73.8990 | 5 (walking) |
| 16 | Boat Club Road | 18.5340 | 73.9020 | 28 (driving) |
| 17 | Bund Garden | 18.5310 | 73.8880 | 32 (driving) |
| 18 | Yerawada | 18.5450 | 73.8920 | 38 (driving) |
| 19 | Aga Khan Palace | 18.5520 | 73.9010 | 5 (walking) |
| 20 | Nagar Road | 18.5580 | 73.9100 | 35 (driving) |
| 21 | Viman Nagar | 18.5670 | 73.9140 | 40 (driving) |
| 22 | Kalyani Nagar | 18.5530 | 73.9050 | 33 (driving) |
| 23 | Heading back west | 18.5420 | 73.8800 | 36 (driving) |
| 24 | Near Sangamwadi | 18.5350 | 73.8600 | 30 (driving) |
| 25 | Back toward Shivajinagar | 18.5310 | 73.8500 | 28 (driving) |

One full loop takes **50 seconds** (25 waypoints × 2 seconds per tick).

---

## PWA Configuration

### Manifest (`public/manifest.json`)

```json
{
  "name": "Delivery Tracker",
  "short_name": "DeliTrack",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1976d2",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker Strategy (`next.config.js`)

Configured via `next-pwa`:

| URL Pattern | Strategy | Cache Name | Max Entries | Max Age |
|---|---|---|---|---|
| Images (png, jpg, svg, etc.) | CacheFirst | `image-cache` | 64 | 30 days |
| Static assets (js, css) | CacheFirst | `static-assets-cache` | 32 | 30 days |
| Fonts (woff, woff2, ttf, etc.) | CacheFirst | `font-cache` | 16 | 1 year |
| API calls (`/api/*`) | NetworkFirst | `api-cache` | 32 | 1 day |
| All other requests | StaleWhileRevalidate | `page-cache` | 32 | 1 day |

- Service worker is **disabled in development** (`process.env.NODE_ENV === "development"`)
- `register: true` — Auto-registers the service worker
- `skipWaiting: true` — New service worker activates immediately

---

## Error Handling

### Frontend Error Handling

| Scenario | User Experience |
|---|---|
| Geolocation permission denied | TypeaheadInput shown, no error message |
| Geolocation timeout/unavailable | TypeaheadInput shown + blue info banner |
| Forward geocode — no results | Orange alert: "No results found for the entered address." |
| Forward geocode — API error | Orange alert: "Geocoding service is temporarily unavailable. Please try again." |
| Reverse geocode — out of bounds | Orange alert: "Location detected is outside the supported region." |
| WebSocket disconnected | Orange status bar: "Reconnecting..." with exponential backoff |
| Autocomplete failure | Suggestions silently cleared, no error shown |

### Backend Error Handling

| Scenario | HTTP Status | Response |
|---|---|---|
| Missing/empty parameters | 400 | Descriptive message about which parameter is missing |
| Non-numeric lat/lon | 400 | "Parameters lat and lon must be valid numbers" |
| Coordinates outside India | 400 | "Location detected is outside the supported region" |
| No geocoding results | 404 | "No results found for the entered address" |
| Nominatim rate limited (429) | Retries up to 3× | Then 503: "Geocoding service rate limit exceeded after maximum retries" |
| Nominatim API error | 503 | "Nominatim API error: {status} {statusText}" |
| Ollama unreachable | N/A | Logs warning, falls back to exact string matching |
| Unhandled exception | 500 | "An internal server error occurred" (full error logged server-side) |

---

## Testing

### Test Configuration

**Frontend** (`jest.config.js`):
- Preset: `ts-jest`
- Environment: `jsdom`
- Roots: `src/`, `tests/`
- Path alias: `@/*` → `src/*`

**Backend** (`backend/jest.config.js`):
- Preset: `ts-jest`
- Environment: `node`
- Roots: `src/`, `tests/`

### Existing Tests

#### Backend Unit Tests

**`agentSimulator.test.ts`** (10 tests):
- Route has ≥ 20 waypoints with valid Pune-area coordinates
- `tick()` returns valid `AgentLocationUpdate` with correct agent ID, coordinates, speed, ISO 8601 timestamp
- Successive ticks advance through the route
- Route loops back to start after all waypoints
- Speed varies between walking and driving
- `start()`/`stop()` call callback at 2-second intervals
- Double `start()` doesn't create duplicate intervals
- `getState()` reflects current index
- `reset()` resets tick count

**`geocodingService.test.ts`** (18 tests):
- `isWithinIndiaBounds` — validates India boundary coordinates
- `normalizeAddress` — handles full addresses, missing fields, fallback chains (suburb, town, village)
- `fetchWithRetry` — success, User-Agent header, 429 retry, max retry exhaustion, non-429 errors, Retry-After header
- `forwardGeocode` — valid result, no results (404), empty address (400), countrycodes=in in URL
- `reverseGeocode` — valid India coordinates, out-of-bounds rejection, NaN rejection
- `autocomplete` — Maharashtra-scoped results, viewbox in URL, empty query (400), empty results

**`semanticCache.test.ts`** (12 tests):
- `cosineSimilarity` — identical vectors (1.0), orthogonal (0.0), opposite (-1.0), empty, mismatched lengths, zero vectors, known computation
- `normalizeString` — lowercase, trim, collapse whitespace, combined
- `lookupWithCache` — cache miss with Ollama, cache hit on semantic match, exact string fallback when Ollama down, miss on fallback, Ollama non-ok status
- `evictExpiredEntries` — removes entries > 7 days, keeps entries within TTL
- `clearCache` — removes all entries

**`trackingServer.test.ts`** (7 tests):
- Accepts connections on `/ws/tracking`
- Tracks multiple clients
- Broadcasts `AgentLocationUpdate` to all clients
- Decrements count on disconnect
- Rejects connections on wrong path
- Returns 0 count with no clients
- Doesn't throw when broadcasting with no clients

#### Frontend Unit Tests

**`backoff.test.ts`** (7 tests):
- Returns correct delays for attempts 1–5
- Caps at 30,000ms for high attempt numbers (16, 20, 100)

### Running Tests

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && npm test

# Watch mode
cd frontend && npm run test:watch
cd backend && npm run test:watch
```

### Correctness Properties (Design)

The design document defines 18 formal correctness properties for property-based testing with `fast-check`. These cover:

| # | Property | What it validates |
|---|---|---|
| P1 | Typeahead character threshold | API calls only for ≥ 3 chars |
| P2 | Autocomplete region scoping | India/Maharashtra params always present |
| P3 | Debounce reduces API calls | ≤ 1 call per 300ms window |
| P4 | Forward geocode response shape | Valid lat/lng + non-empty city/state |
| P5 | Reverse geocode response shape | All address fields non-empty |
| P6 | Out-of-bounds rejection | Error for coordinates outside India |
| P7 | Address field mapping | UI fields match StructuredAddress |
| P8 | Single marker invariant | Exactly one marker at latest coords |
| P9 | Cache lookup correctness | Hit at ≥ 0.92 similarity, miss stores entry |
| P10 | Cache TTL eviction | Entries > 7 days removed |
| P11 | Cache fallback | Exact string matching when Ollama down |
| P12 | Cache observability | Logs hits/misses with query + score |
| P13 | Simulator output validity | Valid agentId, route coords, ISO timestamp, speed 0–60 |
| P14 | Route looping | Index = N % routeLength |
| P15 | Backoff calculation | min(2^(K-1) × 1000, 30000) |
| P16 | Polyline accumulation | N updates → N polyline points in order |
| P17 | API error response | Correct status codes + user-facing messages |
| P18 | Nominatim retry | Respects Retry-After, max 3 retries, then 503 |

---

## Configuration & Environment Variables

### Frontend

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3001` | Backend API base URL |

### Backend

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

### TypeScript Configuration

**Frontend** (`frontend/tsconfig.json`):
- Target: ES2017
- Module: ESNext (bundler resolution)
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- JSX: preserve (Next.js handles compilation)
- Incremental compilation enabled

**Backend** (`backend/tsconfig.json`):
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Output: `./dist`
- Source maps and declaration maps enabled

---

## Running the Application

### Prerequisites

- Node.js 18+
- npm
- Ollama (optional, for semantic cache embeddings)

### Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

### Start Ollama (Optional)

For semantic cache with LLM embeddings:

```bash
ollama pull nomic-embed-text
ollama serve
```

If Ollama is not running, the semantic cache falls back to exact string matching.

### Start Backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
# WebSocket available at ws://localhost:3001/ws/tracking
# Agent simulator starts automatically
```

### Start Frontend

```bash
cd frontend
npm run dev
# Next.js dev server starts on http://localhost:3000
```

### Production Build

```bash
# Frontend
cd frontend
npm run build
npm start

# Backend
cd backend
npm run build
npm start
```

### Verify

- Health check: `GET http://localhost:3001/health`
- Address Lookup: Open `http://localhost:3000`
- Live Tracking: Open `http://localhost:3000/tracking`
