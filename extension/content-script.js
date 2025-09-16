// LocalStock Extension Content Script
// Detects e-commerce PDPs and extracts product data

(function() {
  'use strict';
  
  // Avoid double injection
  if (window.localStockInjected) return;
  window.localStockInjected = true;
  
  let currentProductData = null;
  let mutationObserver = null;
  let extractionDebounceTimer = null;
  let uiComponents = null;
  
  const EXTRACTION_DEBOUNCE = 500; // 500ms debounce for DOM changes
  
  // Platform detection
  const platform = detectPlatform();
  if (!platform) {
    console.log('LocalStock: Unsupported platform');
    return;
  }
  
  console.log('LocalStock: Detected platform:', platform);
  
  // Initialize
  initialize();
  
  function detectPlatform() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (hostname.includes('amazon.com')) {
      // Check if this is a product detail page
      if (pathname.includes('/dp/') || pathname.includes('/gp/product/')) {
        return 'amazon';
      }
    }
    
    if (hostname.includes('walmart.com')) {
      if (pathname.includes('/ip/')) {
        return 'walmart';
      }
    }
    
    return null;
  }
  
  async function initialize() {
    try {
      // Check if extension is enabled
      const settings = await getSettings();
      if (!settings.enabled) {
        console.log('LocalStock: Extension disabled');
        return;
      }
      
      // Initialize UI components
      uiComponents = new LocalStockUI();
      
      // Initial extraction
      await extractAndResolveProduct();
      
      // Set up mutation observer for dynamic content changes
      setupMutationObserver();
      
      console.log('LocalStock: Content script initialized');
      
    } catch (error) {
      console.error('LocalStock: Initialization failed', error);
    }
  }
  
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    
    mutationObserver = new MutationObserver((mutations) => {
      let shouldReextract = false;
      
      for (const mutation of mutations) {
        // Check for variant changes or price updates
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          const target = mutation.target;
          
          // Amazon-specific selectors for variant changes
          if (platform === 'amazon') {
            if (target.matches?.('[data-asin]') ||
                target.closest?.('#variation_color_name, #variation_size_name, #variation_style_name') ||
                target.matches?.('.a-price, .a-price-whole, .a-price-fraction')) {
              shouldReextract = true;
              break;
            }
          }
          
          // Walmart-specific selectors
          if (platform === 'walmart') {
            if (target.matches?.('[data-testid*="variant"]') ||
                target.closest?.('[data-testid="price-current"]')) {
              shouldReextract = true;
              break;
            }
          }
        }
      }
      
      if (shouldReextract) {
        debounceExtraction();
      }
    });
    
    // Observe the entire document for changes
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-asin', 'class', 'data-testid']
    });
  }
  
  function debounceExtraction() {
    if (extractionDebounceTimer) {
      clearTimeout(extractionDebounceTimer);
    }
    
    extractionDebounceTimer = setTimeout(() => {
      extractAndResolveProduct();
    }, EXTRACTION_DEBOUNCE);
  }
  
  async function extractAndResolveProduct() {
    try {
      console.log('LocalStock: Extracting product data');
      
      // Extract product data based on platform
      const productData = platform === 'amazon' 
        ? extractAmazonProductData()
        : extractWalmartProductData();
      
      if (!productData || !productData.identifiers || 
          Object.keys(productData.identifiers).length === 0) {
        console.log('LocalStock: No identifiers found, hiding UI');
        uiComponents?.hide();
        return;
      }
      
      // Check if product data has changed
      if (JSON.stringify(productData) === JSON.stringify(currentProductData)) {
        console.log('LocalStock: Product data unchanged');
        return;
      }
      
      currentProductData = productData;
      console.log('LocalStock: Extracted product data', productData);
      
      // Request product resolution from background script
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'RESOLVE_PRODUCT',
          data: productData
        }, resolve);
      });
      
      console.log('LocalStock: Resolve result', result);
      
      // Handle the response
      if (result?.error) {
        console.error('LocalStock: Resolve error', result.error);
        uiComponents?.hide();
        return;
      }
      
      if (result?.error) {
        uiComponents?.hide();
        return;
      }
      // Always show a pill; it will display "0 nearby" and open a panel with a friendly message
      uiComponents?.show(result || { offers: [] });
      
    } catch (error) {
      console.error('LocalStock: Extraction/resolve failed', error);
      uiComponents?.hide();
    }
  }
  
  function extractAmazonProductData() {
    const data = {
      platform: 'amazon',
      url: window.location.href,
      identifiers: {},
      attributes: {}
    };
    
    // Extract identifiers
    // ASIN from URL or data attributes
    const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch) {
      data.identifiers.asin = asinMatch[1];
    }
    
    // Alternative ASIN extraction
    const asinElement = document.querySelector('[data-asin]');
    if (asinElement && !data.identifiers.asin) {
      data.identifiers.asin = asinElement.getAttribute('data-asin');
    }
    
    // UPC/GTIN from product details
    const detailElements = document.querySelectorAll('#feature-bullets ul li, #detail-bullets tr');
    for (const element of detailElements) {
      const text = element.textContent?.toLowerCase() || '';
      if (text.includes('upc') || text.includes('gtin')) {
        const match = element.textContent?.match(/\b\d{12,14}\b/);
        if (match) {
          data.identifiers.upc = match[0];
          data.identifiers.gtin = match[0];
          break;
        }
      }
    }
    
    // Extract product details
    data.title = document.querySelector('#productTitle')?.textContent?.trim() || '';
    data.brand = document.querySelector('[data-attribute="brand"] .a-color-base')?.textContent?.trim() || 
                document.querySelector('#brand')?.textContent?.trim() || '';
    
    // Extract price
    const priceElement = document.querySelector('.a-price-whole, .a-offscreen, [data-testid="price-current"]');
    if (priceElement) {
      data.price = priceElement.textContent?.trim();
    }
    
    // Extract variant information
    const colorElement = document.querySelector('#variation_color_name .selection');
    const sizeElement = document.querySelector('#variation_size_name .selection');
    const styleElement = document.querySelector('#variation_style_name .selection');
    
    const variants = [];
    if (colorElement) variants.push(colorElement.textContent?.trim());
    if (sizeElement) variants.push(sizeElement.textContent?.trim());
    if (styleElement) variants.push(styleElement.textContent?.trim());
    
    if (variants.length > 0) {
      data.variant = variants.join(' - ');
    }
    
    // Extract images
    const images = Array.from(document.querySelectorAll('#landingImage, .a-image-wrapper img'))
      .map(img => img.src)
      .filter(src => src && !src.includes('data:'));
    
    if (images.length > 0) {
      data.images = images.slice(0, 3); // Limit to 3 images
    }
    
    return data;
  }
  
  function extractWalmartProductData() {
    const data = {
      platform: 'walmart',
      url: window.location.href,
      identifiers: {},
      attributes: {}
    };
    
    // Extract ID from URL
    const idMatch = window.location.pathname.match(/\/ip\/[^\/]+\/(\d+)/);
    if (idMatch) {
      data.identifiers.sku = idMatch[1];
    }
    
    // Extract UPC from page data or JSON-LD
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const json = JSON.parse(script.textContent || '');
        if (json.gtin12 || json.gtin13 || json.gtin14) {
          data.identifiers.gtin = json.gtin12 || json.gtin13 || json.gtin14;
          data.identifiers.upc = data.identifiers.gtin;
          break;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    // Extract product details
    data.title = document.querySelector('[data-automation-id="product-title"]')?.textContent?.trim() ||
                document.querySelector('h1')?.textContent?.trim() || '';
    
    data.brand = document.querySelector('[data-testid="product-brand"]')?.textContent?.trim() || '';
    
    // Extract price
    const priceElement = document.querySelector('[data-testid="price-current"]');
    if (priceElement) {
      data.price = priceElement.textContent?.trim();
    }
    
    // Extract variant information
    const variantElements = document.querySelectorAll('[data-testid*="variant-"]');
    const variants = Array.from(variantElements)
      .map(el => el.textContent?.trim())
      .filter(Boolean);
    
    if (variants.length > 0) {
      data.variant = variants.join(' - ');
    }
    
    return data;
  }
  
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
    });
  }
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    if (extractionDebounceTimer) {
      clearTimeout(extractionDebounceTimer);
    }
    uiComponents?.cleanup();
  });
  
})();
