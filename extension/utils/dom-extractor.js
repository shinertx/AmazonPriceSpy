// LocalStock DOM Extraction Utilities
// Handles product data extraction from various e-commerce platforms

class DOMExtractor {
  constructor(platform) {
    this.platform = platform;
    this.selectors = this.getSelectorsForPlatform(platform);
  }
  
  getSelectorsForPlatform(platform) {
    const selectors = {
      amazon: {
        title: '#productTitle',
        brand: '[data-attribute="brand"] .a-color-base, #brand',
        price: '.a-price-whole, .a-offscreen',
        asin: '[data-asin]',
        variants: {
          color: '#variation_color_name .selection',
          size: '#variation_size_name .selection',
          style: '#variation_style_name .selection'
        },
        images: '#landingImage, .a-image-wrapper img',
        detailRows: '#feature-bullets ul li, #detail-bullets tr'
      },
      
      walmart: {
        title: '[data-automation-id="product-title"], h1',
        brand: '[data-testid="product-brand"]',
        price: '[data-testid="price-current"]',
        variants: '[data-testid*="variant-"]',
        images: '[data-testid="hero-image"], .prod-ProductImageCarousel img'
      }
    };
    
    return selectors[platform] || {};
  }
  
  extractText(selector) {
    const element = document.querySelector(selector);
    return element?.textContent?.trim() || '';
  }
  
  extractAttribute(selector, attribute) {
    const element = document.querySelector(selector);
    return element?.getAttribute(attribute) || '';
  }
  
  extractAllText(selector) {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).map(el => el.textContent?.trim()).filter(Boolean);
  }
  
  extractImages(selector, limit = 3) {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements)
      .map(img => img.src)
      .filter(src => src && !src.includes('data:') && !src.includes('transparent'))
      .slice(0, limit);
  }
  
  extractIdentifiers() {
    const identifiers = {};
    
    if (this.platform === 'amazon') {
      // Extract ASIN from URL
      const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
      if (asinMatch) {
        identifiers.asin = asinMatch[1];
      }
      
      // Alternative ASIN from data attributes
      if (!identifiers.asin) {
        identifiers.asin = this.extractAttribute(this.selectors.asin, 'data-asin');
      }
      
      // Extract UPC/GTIN from product details
      const detailElements = document.querySelectorAll(this.selectors.detailRows);
      for (const element of detailElements) {
        const text = element.textContent?.toLowerCase() || '';
        if (text.includes('upc') || text.includes('gtin') || text.includes('ean')) {
          const match = element.textContent?.match(/\b\d{12,14}\b/);
          if (match) {
            identifiers.upc = match[0];
            identifiers.gtin = match[0];
            if (match[0].length === 13) {
              identifiers.ean = match[0];
            }
            break;
          }
        }
      }
    }
    
    if (this.platform === 'walmart') {
      // Extract SKU from URL
      const skuMatch = window.location.pathname.match(/\/ip\/[^\/]+\/(\d+)/);
      if (skuMatch) {
        identifiers.sku = skuMatch[1];
      }
      
      // Try to extract UPC from JSON-LD structured data
      this.extractStructuredData(identifiers);
    }
    
    return identifiers;
  }
  
  extractStructuredData(identifiers) {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        
        // Handle different JSON-LD structures
        const products = Array.isArray(data) ? data : [data];
        
        for (const item of products) {
          if (item['@type'] === 'Product' || item.productType) {
            // Extract GTIN variants
            if (item.gtin12) identifiers.gtin = item.gtin12;
            if (item.gtin13) identifiers.gtin = item.gtin13;
            if (item.gtin14) identifiers.gtin = item.gtin14;
            if (item.gtin) identifiers.gtin = item.gtin;
            
            // UPC is typically GTIN-12
            if (identifiers.gtin && identifiers.gtin.length === 12) {
              identifiers.upc = identifiers.gtin;
            }
            
            // EAN is typically GTIN-13
            if (identifiers.gtin && identifiers.gtin.length === 13) {
              identifiers.ean = identifiers.gtin;
            }
            
            // Extract SKU
            if (item.sku) identifiers.sku = item.sku;
            if (item.productID) identifiers.sku = item.productID;
            
            // If we found identifiers, break
            if (Object.keys(identifiers).length > 0) {
              break;
            }
          }
        }
      } catch (error) {
        // Ignore JSON parse errors
        continue;
      }
    }
  }
  
  extractProductData() {
    const data = {
      platform: this.platform,
      url: window.location.href,
      identifiers: this.extractIdentifiers(),
      title: this.extractText(this.selectors.title),
      brand: this.extractText(this.selectors.brand),
      price: this.extractText(this.selectors.price),
      currency: 'USD', // Default, could be extracted from price or page
      images: this.extractImages(this.selectors.images),
      attributes: {}
    };
    
    // Extract variants based on platform
    if (this.platform === 'amazon' && this.selectors.variants) {
      const variants = [];
      for (const [type, selector] of Object.entries(this.selectors.variants)) {
        const value = this.extractText(selector);
        if (value) {
          variants.push(value);
          data.attributes[type] = value;
        }
      }
      if (variants.length > 0) {
        data.variant = variants.join(' - ');
      }
    }
    
    if (this.platform === 'walmart') {
      const variantTexts = this.extractAllText(this.selectors.variants);
      if (variantTexts.length > 0) {
        data.variant = variantTexts.join(' - ');
      }
    }
    
    // Clean up price formatting
    if (data.price) {
      data.price = data.price.replace(/[^\d.,]/g, '');
      if (data.price.includes('.')) {
        data.price = '$' + data.price;
      }
    }
    
    return data;
  }
  
  // Check if this looks like a valid product page
  isValidProductPage() {
    const hasTitle = !!this.extractText(this.selectors.title);
    const hasIdentifiers = Object.keys(this.extractIdentifiers()).length > 0;
    
    return hasTitle && hasIdentifiers;
  }
}

// Export for use in content script
window.DOMExtractor = DOMExtractor;
