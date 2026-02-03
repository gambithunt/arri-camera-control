<!--
  Development Mode Control Panel
  Allows easy toggling between dev and production modes
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    getAppConfig, 
    updateAppConfig, 
    enableDevMode, 
    enableProductionMode,
    saveConfig,
    resetConfig,
    getEnvironmentInfo,
    isDevMode,
    shouldShowDevIndicator
  } from '$lib/config/appConfig';
  
  let showPanel = false;
  let config = getAppConfig();
  let environmentInfo = getEnvironmentInfo();
  
  // Reactive updates
  $: config = getAppConfig();
  $: environmentInfo = getEnvironmentInfo();
  
  // Hide panel when dev mode is disabled
  $: if (!isDevMode()) {
    showPanel = false;
  }
  
  // Secret click sequence for dev panel access
  let clickSequence: number[] = [];
  const SECRET_CLICK_PATTERN = [3, 2, 1, 3]; // Triple, double, single, triple click
  const CLICK_TIMEOUT = 3000; // 3 seconds to complete sequence
  let clickTimer: number | null = null;
  let lastClickTime = 0;
  let clickCount = 0;
  
  function handleSecretClick(event: MouseEvent) {
    const now = Date.now();
    const timeDiff = now - lastClickTime;
    
    // Reset if too much time passed
    if (timeDiff > 500) {
      clickCount = 1;
    } else {
      clickCount++;
    }
    
    lastClickTime = now;
    
    // Wait a bit to see if more clicks are coming
    setTimeout(() => {
      if (Date.now() - lastClickTime >= 400) {
        // No more clicks, process the sequence
        clickSequence.push(clickCount);
        
        // Reset click timer
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = window.setTimeout(() => {
          clickSequence = [];
        }, CLICK_TIMEOUT);
        
        // Keep only the last 4 click patterns
        if (clickSequence.length > SECRET_CLICK_PATTERN.length) {
          clickSequence = clickSequence.slice(-SECRET_CLICK_PATTERN.length);
        }
        
        // Check if sequence matches
        if (clickSequence.length === SECRET_CLICK_PATTERN.length && 
            clickSequence.every((count, index) => count === SECRET_CLICK_PATTERN[index])) {
          
          // Secret click sequence activated!
          clickSequence = [];
          if (clickTimer) clearTimeout(clickTimer);
          
          // Force show dev panel only if dev mode is enabled
          if (isDevMode()) {
            showPanel = true;
            console.log('🤫 Secret click sequence activated - Dev panel unlocked');
          } else {
            console.log('🤫 Secret click sequence detected but dev mode is disabled');
          }
        }
        
        clickCount = 0;
      }
    }, 400);
  }

  onMount(() => {
    // Don't auto-show panel on mount - let user explicitly open it
    showPanel = false;
    
    // Keyboard shortcut to toggle panel (Ctrl/Cmd + Shift + D)
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        // Only toggle panel if dev mode is enabled
        if (isDevMode()) {
          showPanel = !showPanel;
        }
      }
    };
    
    // Add secret click listener to the document
    document.addEventListener('click', handleSecretClick);
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('click', handleSecretClick);
      window.removeEventListener('keydown', handleKeydown);
      if (clickTimer) clearTimeout(clickTimer);
    };
  });
  
  function toggleDevMode() {
    if (isDevMode()) {
      enableProductionMode();
    } else {
      enableDevMode();
    }
    config = getAppConfig();
    saveConfig();
  }
  
  function toggleMockStores() {
    updateAppConfig({
      development: {
        ...config.development,
        useMockStores: !config.development.useMockStores
      }
    });
    config = getAppConfig();
    saveConfig();
  }
  
  function toggleMockApi() {
    updateAppConfig({
      development: {
        ...config.development,
        useMockApi: !config.development.useMockApi
      }
    });
    config = getAppConfig();
    saveConfig();
  }
  
  function toggleDebugLogs() {
    updateAppConfig({
      development: {
        ...config.development,
        enableDebugLogs: !config.development.enableDebugLogs
      }
    });
    config = getAppConfig();
    saveConfig();
  }
  
  function handleReset() {
    resetConfig();
    config = getAppConfig();
    window.location.reload();
  }
  
  function copyEnvironmentInfo() {
    navigator.clipboard.writeText(JSON.stringify(environmentInfo, null, 2));
  }
</script>

{#if showPanel && isDevMode()}
  <div class="dev-panel">
    <div class="dev-panel-header">
      <h3>🎭 Development Panel</h3>
      <button class="close-btn" on:click={() => showPanel = false}>×</button>
    </div>
    
    <div class="dev-panel-content">
      <!-- Mode Toggle -->
      <div class="control-group">
        <h4>Mode</h4>
        <label class="toggle-switch">
          <input 
            type="checkbox" 
            checked={isDevMode()} 
            on:change={toggleDevMode}
          />
          <span class="slider"></span>
          <span class="label">{isDevMode() ? 'Development' : 'Production'}</span>
        </label>
      </div>
      
      {#if isDevMode()}
        <!-- Development Options -->
        <div class="control-group">
          <h4>Development Options</h4>
          
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              checked={config.development.useMockStores} 
              on:change={toggleMockStores}
            />
            <span class="slider"></span>
            <span class="label">Mock Stores</span>
          </label>
          
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              checked={config.development.useMockApi} 
              on:change={toggleMockApi}
            />
            <span class="slider"></span>
            <span class="label">Mock API</span>
          </label>
          
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              checked={config.development.enableDebugLogs} 
              on:change={toggleDebugLogs}
            />
            <span class="slider"></span>
            <span class="label">Debug Logs</span>
          </label>
        </div>
      {/if}
      
      <!-- Environment Info -->
      <div class="control-group">
        <h4>Environment</h4>
        <div class="env-info">
          <div class="env-item">
            <span class="env-label">Mode:</span>
            <span class="env-value">{environmentInfo.mode}</span>
          </div>
          <div class="env-item">
            <span class="env-label">Browser:</span>
            <span class="env-value">{environmentInfo.browser ? 'Yes' : 'No'}</span>
          </div>
          <div class="env-item">
            <span class="env-label">SSR:</span>
            <span class="env-value">{environmentInfo.ssr ? 'Yes' : 'No'}</span>
          </div>
        </div>
        <button class="copy-btn" on:click={copyEnvironmentInfo}>
          Copy Environment Info
        </button>
      </div>
      
      <!-- Actions -->
      <div class="control-group">
        <h4>Actions</h4>
        <div class="action-buttons">
          <button class="action-btn" on:click={() => saveConfig()}>
            💾 Save Config
          </button>
          <button class="action-btn danger" on:click={handleReset}>
            🔄 Reset & Reload
          </button>
        </div>
      </div>
    </div>
    
    <div class="dev-panel-footer">
      <small>Press Ctrl+Shift+D to toggle this panel</small>
    </div>
  </div>
{/if}

<!-- Floating Dev Mode Indicator -->
{#if isDevMode() && shouldShowDevIndicator() && !showPanel}
  <button class="dev-indicator" on:click={() => showPanel = true}>
    🎭 DEV
  </button>
{/if}

<style>
  .dev-panel {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 300px;
    background: #1a1a1a;
    border: 2px solid #E31E24;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 12px;
    color: white;
  }
  
  .dev-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #E31E24;
    border-radius: 6px 6px 0 0;
  }
  
  .dev-panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: bold;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
  
  .dev-panel-content {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .control-group {
    margin-bottom: 16px;
  }
  
  .control-group h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: bold;
    color: #E31E24;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .toggle-switch {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    cursor: pointer;
  }
  
  .toggle-switch input {
    display: none;
  }
  
  .slider {
    position: relative;
    width: 40px;
    height: 20px;
    background: #333;
    border-radius: 10px;
    margin-right: 8px;
    transition: background 0.2s;
  }
  
  .slider::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  
  .toggle-switch input:checked + .slider {
    background: #E31E24;
  }
  
  .toggle-switch input:checked + .slider::before {
    transform: translateX(20px);
  }
  
  .label {
    font-size: 11px;
    color: #ccc;
  }
  
  .env-info {
    background: #2a2a2a;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
  }
  
  .env-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  
  .env-item:last-child {
    margin-bottom: 0;
  }
  
  .env-label {
    color: #888;
  }
  
  .env-value {
    color: #E31E24;
    font-weight: bold;
  }
  
  .copy-btn, .action-btn {
    background: #333;
    border: 1px solid #555;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    margin-right: 8px;
    margin-bottom: 4px;
  }
  
  .copy-btn:hover, .action-btn:hover {
    background: #444;
  }
  
  .action-btn.danger {
    background: #dc3545;
    border-color: #dc3545;
  }
  
  .action-btn.danger:hover {
    background: #c82333;
  }
  
  .action-buttons {
    display: flex;
    flex-wrap: wrap;
  }
  
  .dev-panel-footer {
    padding: 8px 16px;
    background: #2a2a2a;
    border-radius: 0 0 6px 6px;
    text-align: center;
  }
  
  .dev-panel-footer small {
    color: #888;
    font-size: 10px;
  }
  
  .dev-indicator {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #E31E24;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 16px rgba(227, 30, 36, 0.4);
    animation: pulse 2s infinite;
  }
  
  .dev-indicator:hover {
    background: #c41e3a;
    animation: none;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .dev-panel {
      width: calc(100vw - 40px);
      right: 20px;
      left: 20px;
    }
    
    .dev-indicator {
      top: 10px;
      right: 10px;
    }
  }
</style>