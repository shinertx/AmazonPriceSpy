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

// Guard thresholds
const GUARD_CONFIG = {
  MIN_MARGIN: 30,
  MIN_TRUST_SCORE: 80,
  MAX_ETA_MINUTES: 480, // 8 hours
  MAX_DISTANCE_MILES: 5,
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

      // Get offers for this product
      const allOffers = await storage.getOffersByProduct(product.id);
      
      // Apply guard filters
      const eligibleOffers = applyGuardFilters(allOffers);
      
      // Check if we have any eligible offers
      if (eligibleOffers.length === 0) {
        const response: ResolveResponse = {
          eligible: false,
          offers: [],
          cached: false,
          timestamp: new Date().toISOString(),
        };
        
        // Don't cache negative responses to allow for quick retries
        return res.json(response);
      }

      // Get store details and format offers
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

      // Filter out null values and prioritize
      const validOffers = formattedOffers.filter(offer => offer !== null);
      const prioritizedOffers = prioritizeOffers(validOffers);

      const response: ResolveResponse = {
        eligible: true,
        offers: prioritizedOffers,
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      resolveCache.set(cacheKey, {
        response,
        timestamp: now,
      });

      // Update resolve request with success
      await storage.createResolveRequest({
        ...request,
        response,
        success: true,
      });

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
