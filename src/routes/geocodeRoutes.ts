import { Router, Request, Response, NextFunction } from 'express';
import {
  reverseGeocode,
  autocomplete,
  GeocodingServiceError,
} from '../services/geocodingService';
import { lookupWithCache } from '../services/semanticCache';
import { ErrorResponse } from '../types';

const router = Router();

// GET /api/geocode/forward?address={query}
router.get('/geocode/forward', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.query.address as string | undefined;
    if (!address || address.trim().length === 0) {
      const error: ErrorResponse = {
        status: 400,
        message: 'Missing required query parameter: address',
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(error);
      return;
    }

    const result = await lookupWithCache(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/geocode/reverse?lat={lat}&lon={lon}
router.get('/geocode/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latStr = req.query.lat as string | undefined;
    const lonStr = req.query.lon as string | undefined;

    if (!latStr || !lonStr) {
      const error: ErrorResponse = {
        status: 400,
        message: 'Missing required query parameters: lat and lon',
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(error);
      return;
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      const error: ErrorResponse = {
        status: 400,
        message: 'Parameters lat and lon must be valid numbers',
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(error);
      return;
    }

    const result = await reverseGeocode(lat, lon);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/address/autocomplete?q={query}
router.get('/address/autocomplete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string | undefined;
    if (!query || query.trim().length === 0) {
      const error: ErrorResponse = {
        status: 400,
        message: 'Missing required query parameter: q',
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(error);
      return;
    }

    const latStr = req.query.lat as string | undefined;
    const lonStr = req.query.lon as string | undefined;
    const lat = latStr ? parseFloat(latStr) : undefined;
    const lon = lonStr ? parseFloat(lonStr) : undefined;

    const result = await autocomplete(query, lat, lon);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Error handling middleware for geocoding routes
export function geocodingErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof GeocodingServiceError) {
    const error: ErrorResponse = {
      status: err.statusCode,
      message: err.message,
      timestamp: new Date().toISOString(),
    };
    res.status(err.statusCode).json(error);
    return;
  }

  // Unhandled errors: log full details server-side, return generic message
  console.error('Unhandled error:', err);
  const error: ErrorResponse = {
    status: 500,
    message: 'An internal server error occurred',
    timestamp: new Date().toISOString(),
  };
  res.status(500).json(error);
}

export default router;
