import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { resolveRequestSchema, type ResolveResponse } from "@shared/schema";
import { z } from "zod";

// Cache for resolve requests - 5 minute TTL
interface CacheEntry {
  response: ResolveResponse;
  timestamp: number;
}

const resolveCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Backend proxy config
const BACKEND_BASE = process.env.BACKEND_BASE || "http://localhost:8000";
const BACKEND_API_KEY = process.env.LOCALSTOCK_INGESTION_API_KEY || process.env.BACKEND_API_KEY || "";

// Guard thresholds
const GUARD_CONFIG = {
  MIN_MARGIN: 30,
  MIN_TRUST_SCORE: 80,
  MAX_ETA_MINUTES: 480, // 8 hours
  MAX_DISTANCE_MILES: 50,
};

function generateCacheKey(request: any): string {
  const keyData = {
    gtin: request.identifiers.gtin || request.identifiers.upc || request.identifiers.ean,
    asin: request.identifiers.asin,
    platform: request.platform,
    variant: request.variant,
    zip: request.zip,
  };
  return JSON.stringify(keyData);
}

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of Array.from(resolveCache.entries())) {
    if (now - entry.timestamp > CACHE_TTL) {
      resolveCache.delete(key);
    }
  }
}

function applyGuardFilters(offers: any[]): any[] {
  return offers.filter(offer => {
    // Check margin threshold
    if (offer.margin && offer.margin < GUARD_CONFIG.MIN_MARGIN) {
      return false;
    }
    
    // Check trust score
    if (offer.trustScore < GUARD_CONFIG.MIN_TRUST_SCORE) {
      return false;
    }
    
    // Check ETA
    if (offer.etaMinutes > GUARD_CONFIG.MAX_ETA_MINUTES) {
      return false;
    }
    
    // Check distance (only for pickup)
    if (offer.availabilityType === 'pickup' && offer.distanceMiles > GUARD_CONFIG.MAX_DISTANCE_MILES) {
      return false;
    }
    
    // Must be in stock and eligible
    if (!offer.inStock || !offer.isEligible) {
      return false;
    }
    
    return true;
  });
}

function prioritizeOffers(offers: any[]): any[] {
  return offers.sort((a, b) => {
    // 1. Prefer pickup over delivery
    if (a.availabilityType !== b.availabilityType) {
      if (a.availabilityType === 'pickup') return -1;
      if (b.availabilityType === 'pickup') return 1;
    }
    
    // 2. Then lowest ETA
    if (a.etaMinutes !== b.etaMinutes) {
      return a.etaMinutes - b.etaMinutes;
    }
    
    // 3. Then lowest price
    const priceA = parseFloat(a.price.replace(/[$,]/g, ''));
    const priceB = parseFloat(b.price.replace(/[$,]/g, ''));
    return priceA - priceB;
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // CORS middleware for extension
  app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Resolve endpoint - core functionality
  app.post('/api/resolve', async (req, res) => {
    try {
      // Clean expired cache entries periodically
      if (Math.random() < 0.1) { // 10% chance
        cleanExpiredCache();
      }
      
      // Validate request
      const validationResult = resolveRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: validationResult.error.issues,
        });
      }

      const request = validationResult.data;
      
      // Check cache first
      const cacheKey = generateCacheKey(request);
      const cachedEntry = resolveCache.get(cacheKey);
      const now = Date.now();
      
      if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_TTL) {
        return res.json({
          ...cachedEntry.response,
          cached: true,
        });
      }

      // Log resolve request
      await storage.createResolveRequest(request);

      // Find product by identifiers
      let product = await storage.getProductByIdentifiers(request.identifiers);
      
      // If product not found, create it (in real implementation, this would trigger external API calls)
      if (!product) {
        product = await storage.createProduct({
          gtin: request.identifiers.gtin,
          upc: request.identifiers.upc,
          ean: request.identifiers.ean,
          asin: request.identifiers.asin,
          sku: request.identifiers.sku,
          brand: request.brand || 'Unknown',
          title: request.title || 'Unknown Product',
          variant: request.variant,
          price: request.price,
          currency: request.currency || 'USD',
          images: [],
          platform: request.platform,
          url: request.url,
          attributes: request.attributes || {},
        });
      }

      // Get offers for this product from local storage first
      const allOffers = await storage.getOffersByProduct(product.id);
      let eligibleOffers = applyGuardFilters(allOffers);

      // If no local offers, try backend proxy
      if (eligibleOffers.length === 0) {
        const proxied = await resolveViaBackend(request);
        if (proxied) {
          // Cache and return proxied response
          resolveCache.set(cacheKey, {
            response: proxied,
            timestamp: now,
          });

          await storage.createResolveRequest({
            ...request,
            response: proxied,
            success: true,
          });

          return res.json({ ...proxied, cached: false });
        }

        // No offers (local or backend)
        const response: ResolveResponse = {
          eligible: false,
          offers: [],
          cached: false,
          timestamp: new Date().toISOString(),
        };
        return res.json(response);
      }

      // Format local offers
      const formattedOffers = await Promise.all(
        eligibleOffers.map(async (offer) => {
          const store = await storage.getStore(offer.storeId!);
          if (!store) return null;
          return {
            id: offer.id,
            storeName: store.name,
            storeChain: store.chain,
            address: store.address,
            distance: offer.distance || '0 mi',
            distanceMiles: offer.distanceMiles || 0,
            availabilityType: offer.availabilityType,
            eta: offer.eta || 'Unknown',
            etaMinutes: offer.etaMinutes || 0,
            price: offer.price,
            currency: offer.currency || 'USD',
            lastSeen: offer.lastSeen?.toISOString() || new Date().toISOString(),
            deepLink: offer.deepLink,
            inStock: offer.inStock || false,
            stockLevel: offer.stockLevel,
          };
        })
      );

      const validOffers = formattedOffers.filter(offer => offer !== null);
      const prioritizedOffers = prioritizeOffers(validOffers);

      const response: ResolveResponse = {
        eligible: true,
        offers: prioritizedOffers,
        cached: false,
        timestamp: new Date().toISOString(),
      };

      resolveCache.set(cacheKey, { response, timestamp: now });
      await storage.createResolveRequest({ ...request, response, success: true });
      res.json(response);
      
    } catch (error) {
      console.error('Resolve endpoint error:', error);
      
      // Log failed request
      await storage.createResolveRequest({
        ...req.body,
        response: { error: error instanceof Error ? error.message : 'Unknown error' },
        success: false,
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      cache: {
        entries: resolveCache.size,
        ttl: CACHE_TTL / 1000,
      },
    });
  });

  // Get recent resolve requests (for debugging)
  app.get('/api/resolve/recent', async (req, res) => {
    try {
      const requests = await storage.getRecentResolveRequests(20);
      res.json(requests);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch requests',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Clear cache endpoint (for testing)
  app.delete('/api/cache', (req, res) => {
    resolveCache.clear();
    res.json({ message: 'Cache cleared' });
  });

  // Serve static files from extension directory for testing
  app.use('/extension', express.static('extension'));
  
  // Serve test UI components page
  app.get('/test-ui-components.html', (req, res) => {
    res.sendFile('test-ui-components.html', { root: '.' });
  });

  const httpServer = createServer(app);
  return httpServer;
}

// -----------------------------
// Backend proxy helper functions
// -----------------------------

function milesToKm(miles: number) {
  return miles * 1.60934;
}

function parseEtaToMinutes(eta?: string | number | null): number | undefined {
  if (typeof eta === 'number') return eta;
  if (!eta || typeof eta !== 'string') return undefined;
  const m = eta.toLowerCase().match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit.startsWith('min')) return n;
  return n * 60;
}

function zipToLatLon(zip?: string) {
  // Minimal map for testing; extend as needed
  const map: Record<string, { lat: number; lon: number }> = {
    '94103': { lat: 37.7725, lon: -122.4091 },
    '94107': { lat: 37.7609, lon: -122.4015 },
    '10001': { lat: 40.7506, lon: -73.9970 },
  };
  if (!zip) return undefined;
  return map[zip];
}

async function resolveViaBackend(request: z.infer<typeof resolveRequestSchema>): Promise<ResolveResponse | null> {
  try {
    const candidates: string[] = [];
    const g = request.identifiers.gtin || request.identifiers.upc || request.identifiers.ean;
    const a = request.identifiers.asin;
    if (g) {
      candidates.push(`gtin::${g}`, g);
    }
    if (a) {
      candidates.push(`asin::${a}`, a);
    }
    if (candidates.length === 0) return null;

    const loc = zipToLatLon(request.zip);
    if (!loc) return null;

  // Use a wider radius to improve hit rate for live backend queries
  const radiusKm = 25;

    const base = BACKEND_BASE.replace(/\/$/, '');
    const headersJson: Record<string, string> = { 'Content-Type': 'application/json' };
    if (BACKEND_API_KEY) headersJson['X-API-Key'] = BACKEND_API_KEY;

    let backendOffers: any[] = [];
    // 1) Try /api/resolve with zip (no API key required per docs)
    for (const pid of candidates) {
      const urlResolve = `${base}/api/resolve`;
      const body = { product_id: pid, zip: request.zip } as any;
      const resp = await fetch(urlResolve, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (resp.ok) {
        const data = await resp.json().catch(() => ({ offers: [] }));
        const offersArr: any[] = Array.isArray(data?.offers) ? data.offers : [];
        if (offersArr.length > 0) { backendOffers = offersArr; break; }
      }
    }

    // 2) Fallback to /v1/offers with lat/lon
    if (backendOffers.length === 0) {
      for (const pid of candidates) {
        const urlOffers = `${base}/v1/offers`;
        const body = { product_id: pid, lat: loc.lat, lon: loc.lon, radius_km: radiusKm } as any;
        const resp = await fetch(urlOffers, { method: 'POST', headers: headersJson, body: JSON.stringify(body) });
        if (!resp.ok) continue;
        const data = await resp.json().catch(() => ({ offers: [] }));
        const offersArr: any[] = Array.isArray(data?.offers) ? data.offers : [];
        if (offersArr.length > 0) { backendOffers = offersArr; break; }
      }
    }

    if (backendOffers.length === 0) return null;

    // Map backend offer shape (documented) -> our internal list entries
    const mapped: any[] = [];
    backendOffers.forEach((o: any, idx: number) => {
      const store = o.store || {};
      const storeName = store.name || 'Unknown';
      const storeChain = store.retailer || store.chain || 'unknown';
      const distanceMiles = typeof o.distance_km === 'number' ? (o.distance_km / 1.60934) : 0;
      const priceStr = typeof o.price_cents === 'number' ? `$${(o.price_cents / 100).toFixed(2)}` : (o.price || '');
      const lastSeen = o.last_checked || new Date().toISOString();
      const deepLink = o.deep_link || o.url;
      const confidence = typeof o.confidence === 'number' ? o.confidence : 1;
      const trustScore = Math.round(Math.max(0, Math.min(1, confidence)) * 100);

      // pickup entry
      if (o.pickup?.available) {
        const etaMin = typeof o.pickup.eta_min === 'number' ? o.pickup.eta_min : undefined;
        mapped.push({
          id: o.id || `backend-${idx}-p`,
          storeName,
          storeChain,
          address: '',
          distance: distanceMiles ? `${distanceMiles.toFixed(1)} mi` : '0 mi',
          distanceMiles: Number(distanceMiles || 0),
          availabilityType: 'pickup',
          eta: typeof etaMin === 'number' ? `${etaMin} min` : 'Unknown',
          etaMinutes: typeof etaMin === 'number' ? etaMin : 0,
          price: priceStr,
          currency: 'USD',
          lastSeen: lastSeen,
          deepLink,
          inStock: true,
          stockLevel: undefined,
          // fields for guards
          margin: 100,
          trustScore,
          isEligible: true,
        });
      }

      // delivery entry
      if (o.delivery?.available) {
        const etaMin = typeof o.delivery.eta_min === 'number' ? o.delivery.eta_min : undefined;
        mapped.push({
          id: o.id || `backend-${idx}-d`,
          storeName,
          storeChain,
          address: '',
          distance: distanceMiles ? `${distanceMiles.toFixed(1)} mi` : '0 mi',
          distanceMiles: Number(distanceMiles || 0),
          availabilityType: 'delivery',
          eta: typeof etaMin === 'number' ? `${etaMin} min` : 'Unknown',
          etaMinutes: typeof etaMin === 'number' ? etaMin : 0,
          price: priceStr,
          currency: 'USD',
          lastSeen: lastSeen,
          deepLink,
          inStock: true,
          stockLevel: undefined,
          // fields for guards
          margin: 100,
          trustScore,
          isEligible: true,
        });
      }
    });

  const filtered = applyGuardFilters(mapped).map(({ margin, trustScore, isEligible, ...rest }) => rest);

    if (filtered.length === 0) return null;

    const prioritized = prioritizeOffers(filtered);
    const response: ResolveResponse = {
      eligible: true,
      offers: prioritized,
      cached: false,
      timestamp: new Date().toISOString(),
    };
    return response;
  } catch (e) {
    return null;
  }
}
