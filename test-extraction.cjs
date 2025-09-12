// Simple test for DOM extraction logic
const { JSDOM } = require('jsdom');
const fs = require('fs');

// Create a simplified test HTML
const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <script type="application/ld+json">
    {
        "@context": "http://schema.org",
        "@type": "Product",
        "name": "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
        "brand": "Sony",
        "gtin12": "027242920156",
        "sku": "B0BXQBHL5D"
    }
    </script>
</head>
<body>
    <h1 id="productTitle">Sony WH-1000XM5 Wireless Noise Canceling Headphones</h1>
    <div id="brand">Sony</div>
    <div class="a-price-whole">349</div>
    <div data-asin="B0BXQBHL5D"></div>
    <div id="variation_color_name"><span class="selection">Black</span></div>
    <div id="feature-bullets">
        <ul>
            <li>UPC: 027242920156</li>
        </ul>
    </div>
</body>
</html>
`;

// Create JSDOM instance
const dom = new JSDOM(testHTML, { url: 'https://amazon.com/dp/B0BXQBHL5D' });
const window = dom.window;
const document = window.document;

// Mock location
window.location = {
    pathname: '/dp/B0BXQBHL5D',
    href: 'https://amazon.com/dp/B0BXQBHL5D'
};

// Simple extraction logic test
function testAmazonExtraction() {
    const data = {
        platform: 'amazon',
        url: window.location.href,
        identifiers: {},
        title: '',
        brand: '',
        variant: '',
        attributes: {}
    };
    
    // Extract ASIN from URL
    const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch) {
        data.identifiers.asin = asinMatch[1];
    }
    
    // Extract title
    const titleElement = document.querySelector('#productTitle');
    if (titleElement) {
        data.title = titleElement.textContent.trim();
    }
    
    // Extract brand
    const brandElement = document.querySelector('#brand');
    if (brandElement) {
        data.brand = brandElement.textContent.trim();
    }
    
    // Extract UPC from feature bullets
    const bulletElements = document.querySelectorAll('#feature-bullets ul li');
    for (const element of bulletElements) {
        const text = element.textContent.toLowerCase();
        if (text.includes('upc')) {
            const match = element.textContent.match(/\b\d{12,14}\b/);
            if (match) {
                data.identifiers.upc = match[0];
                data.identifiers.gtin = match[0];
                break;
            }
        }
    }
    
    // Extract variant
    const colorElement = document.querySelector('#variation_color_name .selection');
    if (colorElement) {
        data.variant = colorElement.textContent.trim();
    }
    
    // Extract ASIN from data attribute
    const asinElement = document.querySelector('[data-asin]');
    if (asinElement && !data.identifiers.asin) {
        data.identifiers.asin = asinElement.getAttribute('data-asin');
    }
    
    return data;
}

// Test structured data extraction
function testStructuredDataExtraction() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const identifiers = {};
    
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            if (data['@type'] === 'Product') {
                if (data.gtin12) identifiers.gtin = data.gtin12;
                if (data.gtin13) identifiers.gtin = data.gtin13;
                if (data.sku) identifiers.sku = data.sku;
                
                if (identifiers.gtin && identifiers.gtin.length === 12) {
                    identifiers.upc = identifiers.gtin;
                }
            }
        } catch (error) {
            // Ignore JSON parse errors
        }
    }
    
    return identifiers;
}

// Run tests
console.log('=== Amazon DOM Extraction Test ===');
const extractedData = testAmazonExtraction();
console.log('Basic extraction result:');
console.log(JSON.stringify(extractedData, null, 2));

console.log('\n=== Structured Data Extraction Test ===');
const structuredIdentifiers = testStructuredDataExtraction();
console.log('Structured data identifiers:');
console.log(JSON.stringify(structuredIdentifiers, null, 2));

console.log('\n=== Combined Results ===');
const finalData = {
    ...extractedData,
    identifiers: {
        ...extractedData.identifiers,
        ...structuredIdentifiers
    }
};
console.log(JSON.stringify(finalData, null, 2));

// Validation
const isValid = finalData.identifiers.asin && finalData.title && Object.keys(finalData.identifiers).length > 1;
console.log('\n=== Validation ===');
console.log('Extraction successful:', isValid);
console.log('Identifiers found:', Object.keys(finalData.identifiers).length);
console.log('Has title:', !!finalData.title);
console.log('Has brand:', !!finalData.brand);