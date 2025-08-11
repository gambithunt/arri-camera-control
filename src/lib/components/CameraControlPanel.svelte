<script lang="ts">
  import { onMount } from 'svelte';
  import { cameraApi } from '../api/cameraApi';
  import { cameraStore } from '../stores/cameraStore';

  let connected = false;
  let cameraModel = '';
  let frameRate = 24;
  let whiteBalance = 5600;
  let iso = 800;

  onMount(() => {
    // Subscribe to camera store updates
    cameraStore.subscribe(state => {
      connected = state.connected;
      cameraModel = state.model || '';
      frameRate = state.frameRate || 24;
      whiteBalance = state.whiteBalance || 5600;
      iso = state.iso || 800;
    });
  });

  async function handleConnect() {
    const result = await cameraApi.connect();
    if (result.success) {
      console.log('Connected to camera');
    } else {
      console.error('Connection failed:', result.error);
    }
  }

  async function handleFrameRateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newFrameRate = parseInt(target.value);
    await cameraApi.setFrameRate(newFrameRate);
  }

  async function handleWhiteBalanceChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newWhiteBalance = parseInt(target.value);
    await cameraApi.setWhiteBalance(newWhiteBalance);
  }

  async function handleISOChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newISO = parseInt(target.value);
    await cameraApi.setISO(newISO);
  }
</script>

<div class="camera-control-panel">
  <div class="connection-section">
    <button 
      data-testid="connect-button" 
      on:click={handleConnect}
      disabled={connected}
    >
      {connected ? 'Connected' : 'Connect'}
    </button>
    
    <div data-testid="connection-status" data-connected={connected}>
      {connected ? 'Connected' : 'Disconnected'}
    </div>
    
    {#if connected}
      <div data-testid="camera-model">{cameraModel}</div>
    {/if}
  </div>

  <div class="controls-section">
    <div class="control-group">
      <label for="frame-rate">Frame Rate</label>
      <input
        id="frame-rate"
        data-testid="frame-rate-slider"
        type="range"
        min="1"
        max="120"
        bind:value={frameRate}
        on:input={handleFrameRateChange}
        disabled={!connected}
      />
      <span data-testid="frame-rate-display">{frameRate} fps</span>
    </div>

    <div class="control-group">
      <label for="white-balance">White Balance</label>
      <input
        id="white-balance"
        data-testid="white-balance-slider"
        type="range"
        min="2000"
        max="11000"
        step="100"
        bind:value={whiteBalance}
        on:input={handleWhiteBalanceChange}
        disabled={!connected}
      />
      <span data-testid="white-balance-display">{whiteBalance}K</span>
    </div>

    <div class="control-group">
      <label for="iso">ISO</label>
      <select
        id="iso"
        data-testid="iso-select"
        bind:value={iso}
        on:change={handleISOChange}
        disabled={!connected}
      >
        <option value={100}>100</option>
        <option value={200}>200</option>
        <option value={400}>400</option>
        <option value={800}>800</option>
        <option value={1600}>1600</option>
        <option value={3200}>3200</option>
        <option value={6400}>6400</option>
      </select>
      <span data-testid="iso-display">ISO {iso}</span>
    </div>
  </div>

  <div data-testid="frame-rate-control" class:disabled={!connected}>
    Frame Rate Control
  </div>
  <div data-testid="white-balance-control" class:disabled={!connected}>
    White Balance Control
  </div>
  <div data-testid="iso-control" class:disabled={!connected}>
    ISO Control
  </div>
</div>

<style>
  .camera-control-panel {
    padding: 1rem;
  }

  .control-group {
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .control-group label {
    min-width: 120px;
  }

  .control-group input,
  .control-group select {
    flex: 1;
  }

  .disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>