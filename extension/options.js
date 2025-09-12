// LocalStock Extension Options Page Script

document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        enabledToggle: document.getElementById('enabledToggle'),
        zipCodeInput: document.getElementById('zipCodeInput'),
        showPickupToggle: document.getElementById('showPickupToggle'),
        showDeliveryToggle: document.getElementById('showDeliveryToggle'),
        maxDistanceInput: document.getElementById('maxDistanceInput'),
        debugModeToggle: document.getElementById('debugModeToggle'),
        debugSection: document.getElementById('debugSection'),
        debugInfo: document.getElementById('debugInfo'),
        successMessage: document.getElementById('successMessage'),
        saveBtn: document.getElementById('saveBtn'),
        resetBtn: document.getElementById('resetBtn'),
        clearCacheBtn: document.getElementById('clearCacheBtn')
    };
    
    let settings = {};
    const defaultSettings = {
        enabled: true,
        zipCode: '',
        showDelivery: true,
        showPickup: true,
        maxDistance: 5,
        debugMode: false
    };
    
    // Load settings on page load
    await loadSettings();
    
    // Set up event listeners
    elements.enabledToggle.addEventListener('click', () => toggleSetting('enabled'));
    elements.showPickupToggle.addEventListener('click', () => toggleSetting('showPickup'));
    elements.showDeliveryToggle.addEventListener('click', () => toggleSetting('showDelivery'));
    elements.debugModeToggle.addEventListener('click', () => toggleSetting('debugMode'));
    
    elements.zipCodeInput.addEventListener('input', handleZipCodeInput);
    elements.zipCodeInput.addEventListener('blur', handleZipCodeBlur);
    elements.maxDistanceInput.addEventListener('change', handleMaxDistanceChange);
    
    elements.saveBtn.addEventListener('click', saveSettings);
    elements.resetBtn.addEventListener('click', resetToDefaults);
    elements.clearCacheBtn.addEventListener('click', clearCache);
    
    async function loadSettings() {
        try {
            settings = await new Promise(resolve => {
                chrome.storage.sync.get([
                    'enabled', 'zipCode', 'showDelivery', 'showPickup', 
                    'maxDistance', 'debugMode'
                ], resolve);
            });
            
            // Apply defaults for missing settings
            settings = { ...defaultSettings, ...settings };
            
            updateUI();
            await updateDebugInfo();
        } catch (error) {
            console.error('Failed to load settings:', error);
            showError('Failed to load settings');
        }
    }
    
    function updateUI() {
        // Update toggles
        updateToggle(elements.enabledToggle, settings.enabled);
        updateToggle(elements.showPickupToggle, settings.showPickup);
        updateToggle(elements.showDeliveryToggle, settings.showDelivery);
        updateToggle(elements.debugModeToggle, settings.debugMode);
        
        // Update inputs
        elements.zipCodeInput.value = settings.zipCode || '';
        elements.maxDistanceInput.value = settings.maxDistance || 5;
        
        // Show/hide debug section
        elements.debugSection.style.display = settings.debugMode ? 'block' : 'none';
    }
    
    function updateToggle(toggleElement, enabled) {
        if (enabled) {
            toggleElement.classList.add('enabled');
        } else {
            toggleElement.classList.remove('enabled');
        }
    }
    
    function toggleSetting(settingKey) {
        settings[settingKey] = !settings[settingKey];
        updateUI();
        
        if (settingKey === 'debugMode') {
            updateDebugInfo();
        }
        
        // Auto-save toggle changes
        saveSettingsInternal();
    }
    
    function handleZipCodeInput(event) {
        let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
        if (value.length > 5) {
            value = value.slice(0, 5);
        }
        event.target.value = value;
        settings.zipCode = value;
    }
    
    function handleZipCodeBlur(event) {
        const zipCode = event.target.value.trim();
        
        // Validate ZIP code format
        if (zipCode && !/^\d{5}$/.test(zipCode)) {
            event.target.style.borderColor = '#dc2626';
            showError('ZIP code must be 5 digits');
            setTimeout(() => {
                event.target.style.borderColor = '';
            }, 3000);
            return;
        }
        
        settings.zipCode = zipCode;
        saveSettingsInternal();
    }
    
    function handleMaxDistanceChange(event) {
        const distance = parseInt(event.target.value, 10);
        if (distance >= 1 && distance <= 50) {
            settings.maxDistance = distance;
            saveSettingsInternal();
        } else {
            event.target.value = settings.maxDistance;
            showError('Distance must be between 1 and 50 miles');
        }
    }
    
    async function saveSettings() {
        await saveSettingsInternal();
        showSuccess('Settings saved successfully!');
    }
    
    async function saveSettingsInternal() {
        try {
            await new Promise(resolve => {
                chrome.storage.sync.set(settings, resolve);
            });
            
            // Send message to background script to update settings
            chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                data: settings
            });
            
            await updateDebugInfo();
        } catch (error) {
            console.error('Failed to save settings:', error);
            showError('Failed to save settings');
        }
    }
    
    async function resetToDefaults() {
        if (confirm('Reset all settings to defaults? This cannot be undone.')) {
            settings = { ...defaultSettings };
            updateUI();
            await saveSettingsInternal();
            showSuccess('Settings reset to defaults');
        }
    }
    
    async function clearCache() {
        try {
            elements.clearCacheBtn.textContent = 'Clearing...';
            elements.clearCacheBtn.disabled = true;
            
            // Send message to background script to clear cache
            await new Promise(resolve => {
                chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, resolve);
            });
            
            // Also clear session storage in all tabs
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.url?.includes('amazon.com') || tab.url?.includes('walmart.com')) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: () => {
                                // Clear LocalStock cache from session storage
                                const keys = [];
                                for (let i = 0; i < sessionStorage.length; i++) {
                                    const key = sessionStorage.key(i);
                                    if (key?.startsWith('localstock_')) {
                                        keys.push(key);
                                    }
                                }
                                keys.forEach(key => sessionStorage.removeItem(key));
                            }
                        });
                    } catch (e) {
                        // Ignore errors for tabs we can't access
                    }
                }
            }
            
            showSuccess('Cache cleared successfully');
            await updateDebugInfo();
        } catch (error) {
            console.error('Failed to clear cache:', error);
            showError('Failed to clear cache');
        } finally {
            elements.clearCacheBtn.textContent = 'Clear Cache';
            elements.clearCacheBtn.disabled = false;
        }
    }
    
    async function updateDebugInfo() {
        if (!settings.debugMode) return;
        
        try {
            // Get debug information
            const manifest = chrome.runtime.getManifest();
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];
            
            const debugData = {
                version: manifest.version,
                settings: settings,
                activeTab: activeTab ? {
                    url: activeTab.url,
                    title: activeTab.title,
                    supported: (
                        activeTab.url?.includes('amazon.com') && 
                        (activeTab.url.includes('/dp/') || activeTab.url.includes('/gp/product/'))
                    ) || (
                        activeTab.url?.includes('walmart.com') && 
                        activeTab.url.includes('/ip/')
                    )
                } : null,
                timestamp: new Date().toISOString()
            };
            
            elements.debugInfo.textContent = JSON.stringify(debugData, null, 2);
        } catch (error) {
            elements.debugInfo.textContent = `Debug info error: ${error.message}`;
        }
    }
    
    function showSuccess(message) {
        elements.successMessage.textContent = message;
        elements.successMessage.style.display = 'block';
        setTimeout(() => {
            elements.successMessage.style.display = 'none';
        }, 3000);
    }
    
    function showError(message) {
        // Create temporary error message element
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: #fee2e2;
            color: #dc2626;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }
    
    // Update debug info periodically when in debug mode
    setInterval(() => {
        if (settings.debugMode) {
            updateDebugInfo();
        }
    }, 5000);
});
