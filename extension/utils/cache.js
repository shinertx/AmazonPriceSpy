// LocalStock Caching Utilities
// Handles session storage caching with TTL support

class LocalStockCache {
  constructor() {
    this.CACHE_PREFIX = 'localstock_';
    this.TTL_KEY = '_ttl';
    this.MAX_ENTRIES = 200;
  }
  
  generateKey(productData, zipCode) {
    const keyData = {
      gtin: productData.identifiers?.gtin || productData.identifiers?.upc || productData.identifiers?.ean,
      asin: productData.identifiers?.asin,
      sku: productData.identifiers?.sku,
      platform: productData.platform,
      variant: productData.variant,
      zip: zipCode
    };
    
    // Create a shorter, more consistent key
    const keyString = JSON.stringify(keyData);
    return this.CACHE_PREFIX + this.hashCode(keyString);
  }
  
  hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  set(key, data, ttlMinutes = 5) {
    try {
      const ttl = Date.now() + (ttlMinutes * 60 * 1000);
      const cacheEntry = {
        data,
        ttl,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(key, JSON.stringify(cacheEntry));
      
      // Cleanup old entries if we're approaching storage limits
      if (Math.random() < 0.1) { // 10% chance
        this.cleanup();
      }
      
      return true;
    } catch (error) {
      console.warn('LocalStock: Cache write failed', error);
      return false;
    }
  }
  
  get(key) {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;
      
      const cacheEntry = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() > cacheEntry.ttl) {
        sessionStorage.removeItem(key);
        return null;
      }
      
      return cacheEntry.data;
    } catch (error) {
      console.warn('LocalStock: Cache read failed', error);
      // Clean up corrupted cache entry
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        // Ignore cleanup errors
      }
      return null;
    }
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  remove(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('LocalStock: Cache remove failed', error);
      return false;
    }
  }
  
  cleanup() {
    try {
      const keys = [];
      const now = Date.now();
      
      // Find all LocalStock cache entries
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = sessionStorage.getItem(key);
            if (cached) {
              const cacheEntry = JSON.parse(cached);
              
              // Remove expired entries
              if (now > cacheEntry.ttl) {
                sessionStorage.removeItem(key);
              } else {
                keys.push({ key, timestamp: cacheEntry.timestamp });
              }
            }
          } catch (e) {
            // Remove corrupted entries
            sessionStorage.removeItem(key);
          }
        }
      }
      
      // If we still have too many entries, remove oldest ones
      if (keys.length > this.MAX_ENTRIES) {
        keys.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = keys.slice(0, keys.length - this.MAX_ENTRIES);
        
        for (const entry of toRemove) {
          sessionStorage.removeItem(entry.key);
        }
      }
      
      console.log(`LocalStock: Cache cleanup completed, ${keys.length} entries remaining`);
    } catch (error) {
      console.warn('LocalStock: Cache cleanup failed', error);
    }
  }
  
  clear() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      for (const key of keysToRemove) {
        sessionStorage.removeItem(key);
      }
      
      console.log(`LocalStock: Cleared ${keysToRemove.length} cache entries`);
      return true;
    } catch (error) {
      console.warn('LocalStock: Cache clear failed', error);
      return false;
    }
  }
  
  getStats() {
    let cacheEntries = 0;
    let totalSize = 0;
    
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          cacheEntries++;
          const value = sessionStorage.getItem(key);
          if (value) {
            totalSize += key.length + value.length;
          }
        }
      }
    } catch (error) {
      console.warn('LocalStock: Cache stats failed', error);
    }
    
    return {
      entries: cacheEntries,
      sizeBytes: totalSize,
      maxEntries: this.MAX_ENTRIES
    };
  }
}

// Export for use in content script
window.LocalStockCache = LocalStockCache;
