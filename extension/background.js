// LocalStock Extension Background Service Worker
// Handles product resolution requests and manages caching

const DEFAULT_RESOLVE_BASE = 'http://localhost:5000/api'; // Resolve API (default)
// Optional: backend ingestion API (from your external backend doc)
// Default to localhost:8000; override via storage or SET_INGEST_CONFIG message
const DEFAULT_INGEST_BASE = 'http://localhost:8000';
let INGEST_API_BASE = DEFAULT_INGEST_BASE;
let INGEST_API_KEY = '';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200;

// In-memory cache for resolved products
const resolveCache = new Map();

// Debounce map to prevent duplicate simultaneous requests
const requestDebounce = new Map();

// Extension installation handler
chrome.runtime.onInstalled.addListener(() => {
  console.log('LocalStock extension installed');
  
  // Initialize default settings
  chrome.storage.sync.set({
    enabled: true,
    zipCode: '',
    showDelivery: true,
    showPickup: true,
    maxDistance: 5,
  debugMode: false,
  resolveApiBase: DEFAULT_RESOLVE_BASE,
  ingestApiBase: DEFAULT_INGEST_BASE,
  ingestApiKey: ''
  });
});

// Message handler for content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RESOLVE_PRODUCT') {
    handleProductResolve(message.data, sender.tab?.id)
      .then(sendResponse)
      .catch(error => {
        console.error('Background resolve error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get([
      'enabled', 'zipCode', 'showDelivery', 'showPickup', 
      'maxDistance', 'debugMode', 'resolveApiBase', 'ingestApiBase', 'ingestApiKey'
    ], sendResponse);
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.sync.set(message.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Ping server health (debug helper)
  if (message.type === 'PING_SERVER') {
    getResolveBase().then((base) => {
      fetch(`${base}/health`)
        .then(r => r.json())
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    });
    return true; 
  }

  // Clear caches: local (background) + server-side
  if (message.type === 'CLEAR_CACHE') {
    try {
      resolveCache.clear();
      requestDebounce.clear();
    } catch {}
    getResolveBase().then((base) => {
      fetch(`${base}/cache`, { method: 'DELETE' })
        .then(r => r.json().catch(() => ({})))
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    });
    return true; 
  }

  // Configure resolve API base (so we can point to a remote backend)
  if (message.type === 'SET_RESOLVE_BASE') {
    const { resolveApiBase } = message.data || {};
    if (typeof resolveApiBase === 'string' && resolveApiBase) {
      chrome.storage.sync.set({ resolveApiBase }, () => sendResponse({ success: true }));
      return true;
    }
    sendResponse({ success: false, error: 'Invalid resolveApiBase' });
    return true;
  }

  // Configure ingestion (optionally set via options page or programmatically)
  if (message.type === 'SET_INGEST_CONFIG') {
    const { ingestApiBase, ingestApiKey } = message.data || {};
    if (typeof ingestApiBase === 'string') INGEST_API_BASE = ingestApiBase;
    if (typeof ingestApiKey === 'string') INGEST_API_KEY = ingestApiKey;
    chrome.storage.sync.set({ ingestApiBase: INGEST_API_BASE, ingestApiKey: INGEST_API_KEY }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Optional pass-throughs to ingestion endpoints for testing/external use
  if (message.type === 'INGEST_OFFER') {
    postIngest('/api/ingest/offer', message.data)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === 'INGEST_OFFERS_BULK') {
    postIngest('/api/ingest/offers/bulk', message.data)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === 'INGEST_PRODUCT') {
    postIngest('/api/ingest/product', message.data)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === 'INGEST_STORE') {
    postIngest('/api/ingest/store', message.data)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleProductResolve(productData, tabId) {
  try {
  // Resolve base URL (allows pointing to remote backend)
  const resolveBase = await getResolveBase();
    // Get user settings
    const settings = await new Promise(resolve => {
      chrome.storage.sync.get([
        'enabled', 'zipCode', 'showDelivery', 'showPickup', 
        'maxDistance', 'debugMode'
      ], resolve);
    });
    
    // Check if extension is enabled
    if (!settings.enabled) {
      return { eligible: false, reason: 'Extension disabled' };
    }
    
    // Generate cache key
    const cacheKey = generateCacheKey(productData, settings.zipCode);
    
    // Check cache first
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      if (settings.debugMode) {
        console.log('LocalStock: Cache hit', cacheKey);
      }
      return { ...cachedResult, cached: true };
    }
    
    // Check for existing request to prevent duplicates
    const debounceKey = `${cacheKey}-${Date.now().toString().slice(-3)}`;
    if (requestDebounce.has(cacheKey)) {
      if (settings.debugMode) {
        console.log('LocalStock: Request already in progress', cacheKey);
      }
      return { eligible: false, reason: 'Request in progress' };
    }
    
    // Mark request as in progress
    requestDebounce.set(cacheKey, Date.now());
    
    try {
      // Prepare resolve request
      const resolveRequest = {
        identifiers: productData.identifiers || {},
        brand: productData.brand,
        title: productData.title,
        variant: productData.variant,
        price: productData.price,
        currency: productData.currency || 'USD',
        attributes: productData.attributes || {},
        platform: productData.platform,
        url: productData.url,
        zip: settings.zipCode
      };
      
      if (settings.debugMode) {
        console.log('LocalStock: Resolving product', resolveRequest);
      }
      
      // Make API request
  const response = await fetch(`${resolveBase}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolveRequest)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Apply user preference filters
      if (result.offers) {
        result.offers = result.offers.filter(offer => {
          if (!settings.showDelivery && offer.availabilityType === 'delivery') {
            return false;
          }
          if (!settings.showPickup && offer.availabilityType === 'pickup') {
            return false;
          }
          if (offer.availabilityType === 'pickup' && 
              offer.distanceMiles > settings.maxDistance) {
            return false;
          }
          return true;
        });
      }
      
      // Cache the result if successful
      if (result.eligible && result.offers?.length > 0) {
        setCachedResult(cacheKey, result);
      }
      
      if (settings.debugMode) {
        console.log('LocalStock: Resolve result', result);
      }
      
      return result;
      
    } finally {
      // Clean up debounce
      requestDebounce.delete(cacheKey);
    }
    
  } catch (error) {
    console.error('LocalStock: Product resolve failed', error);
    return { 
      eligible: false, 
      error: error.message,
      offers: [] 
    };
  }
}

// ----------------------------
// Ingestion helpers (optional)
// ----------------------------
async function getResolveBase() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['resolveApiBase'], ({ resolveApiBase }) => {
      if (typeof resolveApiBase === 'string' && resolveApiBase) {
        resolve(resolveApiBase.replace(/\/$/, ''));
      } else {
        resolve(DEFAULT_RESOLVE_BASE);
      }
    });
  });
}
async function getIngestConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['ingestApiBase', 'ingestApiKey'], ({ ingestApiBase, ingestApiKey }) => {
      resolve({
        base: typeof ingestApiBase === 'string' && ingestApiBase ? ingestApiBase : INGEST_API_BASE,
        apiKey: typeof ingestApiKey === 'string' ? ingestApiKey : INGEST_API_KEY,
      });
    });
  });
}

async function postIngest(path, body) {
  const { base, apiKey } = await getIngestConfig();
  if (!base) throw new Error('Ingestion base URL not configured');
  const url = base.replace(/\/$/, '') + path;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (resp.status === 401) throw new Error('Unauthorized (check X-API-Key)');
  if (resp.status === 503) throw new Error('Ingestion disabled (503)');
  if (!resp.ok) throw new Error(`Ingestion failed: ${resp.status}`);
  return resp.json().catch(() => ({}));
}

function generateCacheKey(productData, zipCode) {
  const keyData = {
    gtin: productData.identifiers?.gtin || productData.identifiers?.upc || productData.identifiers?.ean,
    asin: productData.identifiers?.asin,
    platform: productData.platform,
    variant: productData.variant,
    zip: zipCode
  };
  return JSON.stringify(keyData);
}

function getCachedResult(cacheKey) {
  const cached = resolveCache.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    resolveCache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
}

function setCachedResult(cacheKey, data) {
  // Implement LRU eviction if cache is full
  if (resolveCache.size >= MAX_CACHE_ENTRIES) {
    // Remove oldest entry
    const oldestKey = Array.from(resolveCache.keys())[0];
    resolveCache.delete(oldestKey);
  }
  
  resolveCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of resolveCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      resolveCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Clean up debounce map
setInterval(() => {
  const now = Date.now();
  const timeout = 30000; // 30 seconds
  for (const [key, timestamp] of requestDebounce.entries()) {
    if (now - timestamp > timeout) {
      requestDebounce.delete(key);
    }
  }
}, 30000);
