// LocalStock Extension Background Service Worker
// Handles product resolution requests and manages caching

const API_BASE = 'http://localhost:5000/api'; // Will be updated for production
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
    debugMode: false
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
      'maxDistance', 'debugMode'
    ], sendResponse);
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.sync.set(message.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleProductResolve(productData, tabId) {
  try {
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
      const response = await fetch(`${API_BASE}/resolve`, {
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
