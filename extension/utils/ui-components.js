// LocalStock UI Components
// Handles floating pill and slide-in panel UI

class LocalStockUI {
  constructor() {
    this.pillElement = null;
    this.panelElement = null;
    this.backdropElement = null;
    this.isVisible = false;
    this.isPanelOpen = false;
    this.currentOffers = [];
    
    this.createStyles();
  }
  
  createStyles() {
    // Check if styles already exist
    if (document.getElementById('localstock-styles')) return;
    
    const styles = `
      .localstock-extension-overlay {
        position: fixed !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
        box-sizing: border-box !important;
      }
      
      .localstock-extension-overlay * {
        box-sizing: border-box !important;
      }
      
      .localstock-floating-pill {
        bottom: 16px !important;
        right: 16px !important;
        background: hsl(221.2 83.2% 53.3%) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 9999px !important;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        animation: localstock-fadeInUp 0.3s ease-out !important;
        border: none !important;
        text-decoration: none !important;
      }
      
      .localstock-floating-pill:hover {
        background: hsl(221.2 83.2% 48.3%) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      }
      
      .localstock-status-dot {
        width: 8px !important;
        height: 8px !important;
        background: #10b981 !important;
        border-radius: 50% !important;
        animation: localstock-pulse 2s infinite !important;
      }
      
      .localstock-panel-backdrop {
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        animation: localstock-fadeIn 0.2s ease-out !important;
        cursor: pointer !important;
      }
      
      .localstock-panel {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 384px !important;
        max-width: 100vw !important;
        background: white !important;
        box-shadow: -10px 0 25px -5px rgba(0, 0, 0, 0.1) !important;
        display: flex !important;
        flex-direction: column !important;
        animation: localstock-slideInRight 0.3s ease-out !important;
      }
      
      .localstock-panel-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 16px !important;
        border-bottom: 1px solid hsl(214.3 31.8% 91.4%) !important;
      }
      
      .localstock-panel-header-content {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
      }
      
      .localstock-panel-icon {
        width: 32px !important;
        height: 32px !important;
        background: hsl(221.2 83.2% 53.3%) !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: white !important;
        font-size: 16px !important;
      }
      
      .localstock-panel-title {
        font-weight: 600 !important;
        color: #1f2937 !important;
        margin: 0 !important;
        font-size: 16px !important;
      }
      
      .localstock-panel-subtitle {
        font-size: 12px !important;
        color: hsl(215.4 16.3% 46.9%) !important;
        margin: 0 !important;
        margin-top: 2px !important;
      }
      
      .localstock-close-button {
        width: 32px !important;
        height: 32px !important;
        border-radius: 50% !important;
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: hsl(215.4 16.3% 46.9%) !important;
        font-size: 16px !important;
        transition: background-color 0.2s !important;
      }
      
      .localstock-close-button:hover {
        background: hsl(210 40% 96%) !important;
      }
      
      .localstock-panel-content {
        flex: 1 !important;
        overflow-y: auto !important;
      }
      
      .localstock-offer-item {
        padding: 16px !important;
        border-bottom: 1px solid hsl(214.3 31.8% 91.4%) !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
      }
      
      .localstock-offer-item:hover {
        background: hsl(210 40% 98%) !important;
      }
      
      .localstock-offer-item:last-child {
        border-bottom: none !important;
      }
      
      .localstock-offer-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin-bottom: 4px !important;
      }
      
      .localstock-offer-type-icon {
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 12px !important;
      }
      
      .localstock-offer-type-pickup {
        background: #dcfce7 !important;
        color: #16a34a !important;
      }
      
      .localstock-offer-type-delivery {
        background: #dbeafe !important;
        color: #2563eb !important;
      }
      
      .localstock-store-name {
        font-weight: 500 !important;
        color: #1f2937 !important;
        font-size: 14px !important;
        margin: 0 !important;
      }
      
      .localstock-offer-badge {
        font-size: 10px !important;
        padding: 2px 6px !important;
        border-radius: 9999px !important;
        font-weight: 500 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.025em !important;
      }
      
      .localstock-offer-badge-pickup {
        background: #dcfce7 !important;
        color: #15803d !important;
      }
      
      .localstock-offer-badge-delivery {
        background: #dbeafe !important;
        color: #1d4ed8 !important;
      }
      
      .localstock-offer-address {
        font-size: 12px !important;
        color: hsl(215.4 16.3% 46.9%) !important;
        margin: 2px 0 8px 0 !important;
      }
      
      .localstock-offer-details {
        display: flex !important;
        align-items: center !important;
        gap: 16px !important;
        font-size: 12px !important;
        margin-bottom: 8px !important;
      }
      
      .localstock-offer-detail {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        color: hsl(215.4 16.3% 46.9%) !important;
      }
      
      .localstock-offer-detail-value {
        font-weight: 500 !important;
        color: #1f2937 !important;
      }
      
      .localstock-offer-footer {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }
      
      .localstock-last-seen {
        font-size: 12px !important;
        color: hsl(215.4 16.3% 46.9%) !important;
      }
      
      .localstock-offer-action {
        background: hsl(221.2 83.2% 53.3%) !important;
        color: white !important;
        border: none !important;
        padding: 6px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
      }
      
      .localstock-offer-action:hover {
        background: hsl(221.2 83.2% 48.3%) !important;
      }
      
      .localstock-panel-footer {
        padding: 16px !important;
        border-top: 1px solid hsl(214.3 31.8% 91.4%) !important;
        background: hsl(210 40% 98%) !important;
      }
      
      .localstock-footer-content {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        font-size: 12px !important;
      }
      
      .localstock-footer-left {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        color: hsl(215.4 16.3% 46.9%) !important;
      }
      
      .localstock-settings-link {
        color: hsl(221.2 83.2% 53.3%) !important;
        text-decoration: none !important;
        font-weight: 500 !important;
      }
      
      .localstock-settings-link:hover {
        color: hsl(221.2 83.2% 48.3%) !important;
      }
      
      .localstock-no-results {
        padding: 32px 16px !important;
        text-align: center !important;
        color: hsl(215.4 16.3% 46.9%) !important;
      }
      
      .localstock-no-results-icon {
        font-size: 24px !important;
        margin-bottom: 8px !important;
      }
      
      /* Animations */
      @keyframes localstock-fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes localstock-slideInRight {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
      
      @keyframes localstock-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes localstock-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      /* Mobile responsiveness */
      @media (max-width: 640px) {
        .localstock-panel {
          width: 100vw !important;
        }
        
        .localstock-floating-pill {
          bottom: 80px !important;
          right: 16px !important;
        }
      }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'localstock-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
  
  show(resolveResult) {
    this.currentOffers = resolveResult.offers || [];
    
    if (this.currentOffers.length === 0) {
      this.hide();
      return;
    }
    
    if (!this.pillElement) {
      this.createPill();
    }
    
    this.updatePill();
    this.isVisible = true;
  }
  
  hide() {
    if (this.pillElement) {
      this.pillElement.remove();
      this.pillElement = null;
    }
    
    if (this.panelElement) {
      this.closePanel();
    }
    
    this.isVisible = false;
  }
  
  createPill() {
    this.pillElement = document.createElement('div');
    this.pillElement.className = 'localstock-extension-overlay localstock-floating-pill';
    
    this.pillElement.innerHTML = `
      <div class="localstock-status-dot"></div>
      <span class="localstock-pill-text">Loading...</span>
      <span style="font-size: 12px;">▲</span>
    `;
    
    this.pillElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPanel();
    });
    
    document.body.appendChild(this.pillElement);
  }
  
  updatePill() {
    if (!this.pillElement) return;
    
    const count = this.currentOffers.length;
    const textElement = this.pillElement.querySelector('.localstock-pill-text');
    
    if (textElement) {
      textElement.textContent = `${count} nearby`;
    }
  }
  
  openPanel() {
    if (this.isPanelOpen) return;
    
    this.createPanel();
    this.isPanelOpen = true;
    
    // Hide pill when panel is open
    if (this.pillElement) {
      this.pillElement.style.display = 'none';
    }
  }
  
  closePanel() {
    if (this.backdropElement) {
      this.backdropElement.remove();
      this.backdropElement = null;
    }
    
    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }
    
    this.isPanelOpen = false;
    
    // Show pill again
    if (this.pillElement && this.isVisible) {
      this.pillElement.style.display = 'flex';
    }
  }
  
  createPanel() {
    // Create backdrop
    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'localstock-extension-overlay localstock-panel-backdrop';
    this.backdropElement.addEventListener('click', () => this.closePanel());
    
    // Create panel
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'localstock-panel';
    
    const productTitle = this.extractProductTitle();
    
    this.panelElement.innerHTML = `
      <div class="localstock-panel-header">
        <div class="localstock-panel-header-content">
          <div class="localstock-panel-icon">
            📍
          </div>
          <div>
            <div class="localstock-panel-title">Available Nearby</div>
            <div class="localstock-panel-subtitle">${this.truncateText(productTitle, 40)}</div>
          </div>
        </div>
        <button class="localstock-close-button" type="button">
          ×
        </button>
      </div>
      
      <div class="localstock-panel-content">
        ${this.renderOffers()}
      </div>
      
      <div class="localstock-panel-footer">
        <div class="localstock-footer-content">
          <div class="localstock-footer-left">
            <span>🛡️</span>
            <span>Verified stock levels</span>
          </div>
          <a href="#" class="localstock-settings-link">Settings</a>
        </div>
      </div>
    `;
    
    // Add event listeners
    const closeButton = this.panelElement.querySelector('.localstock-close-button');
    closeButton?.addEventListener('click', () => this.closePanel());
    
    const settingsLink = this.panelElement.querySelector('.localstock-settings-link');
    settingsLink?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    
    // Add offer click handlers
    const offerItems = this.panelElement.querySelectorAll('.localstock-offer-item');
    offerItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        const offer = this.currentOffers[index];
        if (offer?.deepLink) {
          window.open(offer.deepLink, '_blank');
        }
      });
    });
    
    // Add action button handlers
    const actionButtons = this.panelElement.querySelectorAll('.localstock-offer-action');
    actionButtons.forEach((button, index) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const offer = this.currentOffers[index];
        if (offer?.deepLink) {
          window.open(offer.deepLink, '_blank');
        }
      });
    });
    
    // Append to body
    document.body.appendChild(this.backdropElement);
    document.body.appendChild(this.panelElement);
    
    // Handle escape key
    this.handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        this.closePanel();
      }
    };
    document.addEventListener('keydown', this.handleEscapeKey);
  }
  
  renderOffers() {
    if (this.currentOffers.length === 0) {
      return `
        <div class="localstock-no-results">
          <div class="localstock-no-results-icon">🔍</div>
          <div>No local availability found</div>
        </div>
      `;
    }
    
    return this.currentOffers.map(offer => `
      <div class="localstock-offer-item">
        <div class="localstock-offer-header">
          <div class="localstock-offer-type-icon localstock-offer-type-${offer.availabilityType}">
            ${offer.availabilityType === 'pickup' ? '🏪' : '🚚'}
          </div>
          <div class="localstock-store-name">${this.escapeHtml(offer.storeName)}</div>
          <div class="localstock-offer-badge localstock-offer-badge-${offer.availabilityType}">
            ${offer.availabilityType.toUpperCase()}
          </div>
        </div>
        
        <div class="localstock-offer-address">
          ${this.escapeHtml(offer.availabilityType === 'delivery' ? 'Same-day delivery to your area' : offer.address)}
        </div>
        
        <div class="localstock-offer-details">
          <div class="localstock-offer-detail">
            <span>🕒</span>
            <span>${offer.availabilityType === 'pickup' ? 'Ready in' : 'Arrives by'}</span>
            <span class="localstock-offer-detail-value">${this.escapeHtml(offer.eta)}</span>
          </div>
          <div class="localstock-offer-detail">
            <span>💰</span>
            <span class="localstock-offer-detail-value">${this.escapeHtml(offer.price)}</span>
          </div>
        </div>
        
        <div class="localstock-offer-footer">
          <div class="localstock-last-seen">
            Updated ${this.formatLastSeen(offer.lastSeen)}
          </div>
          <button class="localstock-offer-action" type="button">
            ${offer.availabilityType === 'pickup' ? 'Reserve' : 'Order'}
          </button>
        </div>
      </div>
    `).join('');
  }
  
  extractProductTitle() {
    // Try to extract product title from current page
    const titleSelectors = [
      '#productTitle', // Amazon
      '[data-automation-id="product-title"]', // Walmart
      'h1',
      '.product-title',
      '[data-testid="product-title"]'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }
    
    return 'Product';
  }
  
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'recently';
    
    try {
      const date = new Date(lastSeen);
      const now = new Date();
      const diffMinutes = Math.floor((now - date) / 60000);
      
      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (error) {
      return 'recently';
    }
  }
  
  cleanup() {
    if (this.handleEscapeKey) {
      document.removeEventListener('keydown', this.handleEscapeKey);
    }
    
    this.hide();
    
    // Remove styles
    const styleElement = document.getElementById('localstock-styles');
    if (styleElement) {
      styleElement.remove();
    }
  }
}

// Export for use in content script
window.LocalStockUI = LocalStockUI;
