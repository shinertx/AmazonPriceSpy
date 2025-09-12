// LocalStock Extension Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        statusIcon: document.getElementById('statusIcon'),
        statusTitle: document.getElementById('statusTitle'),
        statusSubtitle: document.getElementById('statusSubtitle'),
        toggleSwitch: document.getElementById('toggleSwitch'),
        zipInput: document.getElementById('zipInput'),
        optionsBtn: document.getElementById('optionsBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        stats: document.getElementById('stats')
    };
    
    let settings = {};
    
    // Load current settings
    await loadSettings();
    
    // Set up event listeners
    elements.toggleSwitch.addEventListener('click', toggleExtension);
    elements.zipInput.addEventListener('change', updateZipCode);
    elements.zipInput.addEventListener('blur', updateZipCode);
    elements.optionsBtn.addEventListener('click', openOptions);
    elements.refreshBtn.addEventListener('click', refreshCurrentPage);
    
    async function loadSettings() {
        try {
            settings = await new Promise(resolve => {
                chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
            });
            
            updateUI();
            await loadStats();
        } catch (error) {
            console.error('Failed to load settings:', error);
            showError('Failed to load settings');
        }
    }
    
    function updateUI() {
        // Update toggle state
        if (settings.enabled) {
            elements.toggleSwitch.classList.add('enabled');
            elements.statusIcon.className = 'status-icon status-enabled';
            elements.statusIcon.textContent = '✓';
            elements.statusTitle.textContent = 'LocalStock Active';
            elements.statusSubtitle.textContent = 'Monitoring this page for products';
        } else {
            elements.toggleSwitch.classList.remove('enabled');
            elements.statusIcon.className = 'status-icon status-disabled';
            elements.statusIcon.textContent = '⏸';
            elements.statusTitle.textContent = 'LocalStock Paused';
            elements.statusSubtitle.textContent = 'Click to enable product monitoring';
        }
        
        // Update ZIP code
        elements.zipInput.value = settings.zipCode || '';
    }
    
    async function toggleExtension() {
        try {
            settings.enabled = !settings.enabled;
            
            await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    type: 'UPDATE_SETTINGS',
                    data: { enabled: settings.enabled }
                }, resolve);
            });
            
            updateUI();
            
            // Refresh current tab if enabling
            if (settings.enabled) {
                await refreshCurrentPage();
            }
        } catch (error) {
            console.error('Failed to toggle extension:', error);
            showError('Failed to update settings');
        }
    }
    
    async function updateZipCode() {
        const zipCode = elements.zipInput.value.trim();
        
        // Validate ZIP code format
        if (zipCode && !/^\d{5}$/.test(zipCode)) {
            elements.zipInput.style.borderColor = '#dc2626';
            setTimeout(() => {
                elements.zipInput.style.borderColor = '';
            }, 2000);
            return;
        }
        
        try {
            settings.zipCode = zipCode;
            
            await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    type: 'UPDATE_SETTINGS',
                    data: { zipCode: zipCode }
                }, resolve);
            });
            
            // Visual feedback
            elements.zipInput.style.borderColor = '#16a34a';
            setTimeout(() => {
                elements.zipInput.style.borderColor = '';
            }, 1000);
            
            await loadStats();
        } catch (error) {
            console.error('Failed to update ZIP code:', error);
            showError('Failed to save ZIP code');
        }
    }
    
    function openOptions() {
        chrome.runtime.openOptionsPage();
        window.close();
    }
    
    async function refreshCurrentPage() {
        try {
            elements.refreshBtn.textContent = 'Refreshing...';
            elements.refreshBtn.disabled = true;
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.tabs.reload(tab.id);
            }
            
            setTimeout(() => {
                elements.refreshBtn.textContent = 'Refresh';
                elements.refreshBtn.disabled = false;
            }, 1000);
        } catch (error) {
            console.error('Failed to refresh page:', error);
            elements.refreshBtn.textContent = 'Refresh';
            elements.refreshBtn.disabled = false;
            showError('Failed to refresh page');
        }
    }
    
    async function loadStats() {
        try {
            // Get current tab info
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const isSupported = tab && (
                tab.url.includes('amazon.com') && (tab.url.includes('/dp/') || tab.url.includes('/gp/product/')) ||
                tab.url.includes('walmart.com') && tab.url.includes('/ip/')
            );
            
            let statsText = '';
            
            if (!isSupported) {
                statsText = 'Navigate to Amazon or Walmart product pages to see local availability';
            } else if (!settings.zipCode) {
                statsText = 'Enter your ZIP code above to see local availability';
            } else {
                statsText = `Searching within ${settings.maxDistance || 5} miles of ${settings.zipCode}`;
            }
            
            elements.stats.textContent = statsText;
        } catch (error) {
            console.error('Failed to load stats:', error);
            elements.stats.textContent = 'Unable to load statistics';
        }
    }
    
    function showError(message) {
        elements.statusSubtitle.textContent = message;
        elements.statusSubtitle.style.color = '#dc2626';
        
        setTimeout(() => {
            updateUI();
            elements.statusSubtitle.style.color = '';
        }, 3000);
    }
    
    // Update stats periodically
    setInterval(loadStats, 5000);
});
