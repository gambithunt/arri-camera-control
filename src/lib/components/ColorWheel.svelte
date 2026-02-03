<!--
  Professional Color Wheel Component
  Interactive color wheel with draggable control point for RGB adjustment
-->
<script lang="ts">
  import { onMount } from 'svelte';
  
  // Props
  export let title: string = 'Color Wheel';
  export let value: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 };
  export let disabled: boolean = false;
  export let onReset: (() => void) | null = null;
  export let onChange: ((value: { r: number; g: number; b: number }) => void) | null = null;
  
  // Component state
  let wheelContainer: HTMLDivElement;
  let isDragging = false;
  let wheelSize = 200;
  let centerX = 0;
  let centerY = 0;
  let dotX = 0;
  let dotY = 0;
  
  // Convert RGB values to wheel position
  function rgbToPosition(rgb: { r: number; g: number; b: number }) {
    // Convert RGB (-1 to 1 range) to polar coordinates
    const magnitude = Math.sqrt(rgb.r * rgb.r + rgb.g * rgb.g + rgb.b * rgb.b);
    const angle = Math.atan2(rgb.g, rgb.r);
    
    // Convert to wheel coordinates (limit magnitude to wheel radius)
    const radius = Math.min(magnitude * (wheelSize / 2 - 20), wheelSize / 2 - 20);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    return { x, y };
  }
  
  // Convert wheel position to RGB values
  function positionToRgb(x: number, y: number) {
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = wheelSize / 2 - 20;
    
    // Limit to wheel bounds
    const clampedDistance = Math.min(distance, maxRadius);
    const angle = Math.atan2(deltaY, deltaX);
    
    // Convert to RGB values (-1 to 1 range)
    const magnitude = clampedDistance / maxRadius;
    const r = magnitude * Math.cos(angle);
    const g = magnitude * Math.sin(angle);
    const b = 0; // For 2D wheel, B is typically controlled separately or derived
    
    return { r, g, b };
  }
  
  // Update dot position based on current RGB values
  function updateDotPosition() {
    if (!wheelContainer) return;
    
    const rect = wheelContainer.getBoundingClientRect();
    centerX = wheelSize / 2;
    centerY = wheelSize / 2;
    
    const pos = rgbToPosition(value);
    dotX = pos.x;
    dotY = pos.y;
  }
  
  // Handle mouse/touch events
  function handlePointerDown(event: PointerEvent) {
    if (disabled) return;
    
    event.preventDefault();
    isDragging = true;
    wheelContainer.setPointerCapture(event.pointerId);
    handlePointerMove(event);
  }
  
  function handlePointerMove(event: PointerEvent) {
    if (!isDragging || disabled) return;
    
    const rect = wheelContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if within wheel bounds
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = wheelSize / 2 - 20;
    
    if (distance <= maxRadius) {
      dotX = x;
      dotY = y;
    } else {
      // Clamp to wheel edge
      const angle = Math.atan2(deltaY, deltaX);
      dotX = centerX + maxRadius * Math.cos(angle);
      dotY = centerY + maxRadius * Math.sin(angle);
    }
    
    // Convert position to RGB and notify parent
    const newRgb = positionToRgb(dotX, dotY);
    value = newRgb;
    
    if (onChange) {
      onChange(newRgb);
    }
  }
  
  function handlePointerUp(event: PointerEvent) {
    if (!isDragging) return;
    
    isDragging = false;
    wheelContainer.releasePointerCapture(event.pointerId);
  }
  
  function handleReset() {
    if (disabled || !onReset) return;
    
    value = { r: 0, g: 0, b: 0 };
    updateDotPosition();
    onReset();
  }
  
  onMount(() => {
    updateDotPosition();
    
    // Update position when value changes externally
    const unsubscribe = () => {
      updateDotPosition();
    };
    
    return unsubscribe;
  });
  
  // Reactive updates
  $: if (wheelContainer) {
    updateDotPosition();
  }
</script>

<div class="color-wheel-container">
  <!-- Wheel Header -->
  <div class="wheel-header">
    <h3 class="wheel-title">{title}</h3>
    {#if onReset}
      <button 
        class="reset-button" 
        on:click={handleReset}
        disabled={disabled}
      >
        Reset
      </button>
    {/if}
  </div>
  
  <!-- Color Wheel -->
  <div 
    class="color-wheel"
    class:disabled
    bind:this={wheelContainer}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerUp}
    style="width: {wheelSize}px; height: {wheelSize}px;"
  >
    <!-- Color Gradient Background -->
    <div class="wheel-gradient"></div>
    
    <!-- Grid Lines -->
    <div class="wheel-grid">
      <!-- Horizontal line -->
      <div class="grid-line horizontal"></div>
      <!-- Vertical line -->
      <div class="grid-line vertical"></div>
    </div>
    
    <!-- Center Dot -->
    <div class="center-dot"></div>
    
    <!-- Draggable Control Dot -->
    <div 
      class="control-dot"
      class:dragging={isDragging}
      style="left: {dotX - 8}px; top: {dotY - 8}px;"
    ></div>
  </div>
  
  <!-- RGB Values Display -->
  <div class="rgb-display">
    <div class="rgb-value">
      <span class="rgb-label r">R</span>
      <span class="rgb-number">{value.r.toFixed(3)}</span>
    </div>
    <div class="rgb-value">
      <span class="rgb-label g">G</span>
      <span class="rgb-number">{value.g.toFixed(3)}</span>
    </div>
    <div class="rgb-value">
      <span class="rgb-label b">B</span>
      <span class="rgb-number">{value.b.toFixed(3)}</span>
    </div>
  </div>
</div>

<style>
  .color-wheel-container {
    @apply flex flex-col items-center space-y-4;
  }
  
  .wheel-header {
    @apply flex justify-between items-center w-full;
  }
  
  .wheel-title {
    @apply text-lg font-medium capitalize text-white;
  }
  
  .reset-button {
    @apply bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1 px-3 rounded;
    @apply transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }
  
  .color-wheel {
    @apply relative rounded-full cursor-crosshair select-none;
    @apply border-2 border-gray-600;
    touch-action: none;
  }
  
  .color-wheel.disabled {
    @apply opacity-50 cursor-not-allowed;
  }
  
  .wheel-gradient {
    @apply absolute inset-0 rounded-full;
    background: conic-gradient(
      from -90deg,
      #ffff00 0deg,    /* 12:00 - Yellow */
      #ff8000 60deg,   /* 2:00 - Orange */
      #ff0040 90deg,   /* 3:00 - Red-Pink */
      #ff00ff 120deg,  /* 4:00 - Magenta */
      #8000ff 150deg,  /* 5:00 - Purple */
      #0000ff 180deg,  /* 6:00 - Blue */
      #0080ff 210deg,  /* 7:00 - Blue-Cyan */
      #00ffff 240deg,  /* 8:00 - Cyan */
      #00ff00 270deg,  /* 9:00 - Green */
      #80ff00 300deg,  /* 10:00 - Yellow-Green */
      #ffff00 360deg   /* 12:00 - Back to Yellow */
    );
    mask: radial-gradient(circle, transparent 20px, black 20px);
    -webkit-mask: radial-gradient(circle, transparent 20px, black 20px);
  }
  
  .wheel-grid {
    @apply absolute inset-0 pointer-events-none;
  }
  
  .grid-line {
    @apply absolute bg-gray-500 opacity-30;
  }
  
  .grid-line.horizontal {
    @apply w-full h-px top-1/2 left-0;
    transform: translateY(-0.5px);
  }
  
  .grid-line.vertical {
    @apply h-full w-px left-1/2 top-0;
    transform: translateX(-0.5px);
  }
  
  .center-dot {
    @apply absolute w-2 h-2 bg-white rounded-full border border-gray-400;
    @apply top-1/2 left-1/2;
    transform: translate(-50%, -50%);
  }
  
  .control-dot {
    @apply absolute w-4 h-4 bg-white rounded-full border-2 border-gray-800;
    @apply shadow-lg cursor-grab transition-transform;
    @apply pointer-events-none;
  }
  
  .control-dot.dragging {
    @apply cursor-grabbing scale-110;
  }
  
  .rgb-display {
    @apply flex space-x-6 text-sm font-mono;
  }
  
  .rgb-value {
    @apply flex flex-col items-center space-y-1;
  }
  
  .rgb-label {
    @apply font-bold text-xs;
  }
  
  .rgb-label.r {
    @apply text-red-400;
  }
  
  .rgb-label.g {
    @apply text-green-400;
  }
  
  .rgb-label.b {
    @apply text-blue-400;
  }
  
  .rgb-number {
    @apply text-gray-300;
  }
  
  /* Touch device optimizations */
  @media (hover: none) and (pointer: coarse) {
    .control-dot {
      @apply w-6 h-6;
    }
    
    .color-wheel {
      @apply cursor-default;
    }
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .color-wheel {
      @apply border-white;
    }
    
    .control-dot {
      @apply border-white;
    }
    
    .center-dot {
      @apply border-white;
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .control-dot {
      @apply transition-none;
    }
  }
</style>