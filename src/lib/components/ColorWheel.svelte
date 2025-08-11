<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	
	// Props
	export let wheelType: 'shadows' | 'midtones' | 'highlights' = 'shadows';
	export let values = { r: 0, g: 0, b: 0 };
	export let controlType: 'lift' | 'gamma' | 'gain' = 'lift';
	export let disabled = false;
	export let size = 200;
	export let fullscreen = false;
	export let showValues = true;
	export let sensitivity = 1.0;
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		change: { wheelType: string; controlType: string; values: { r: number; g: number; b: number } };
		fullscreenToggle: { wheelType: string; controlType: string };
		reset: { wheelType: string; controlType: string };
	}>();
	
	// Component state
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isDragging = false;
	let dragStartPos = { x: 0, y: 0 };
	let currentPos = { x: 0, y: 0 };
	let wheelCenter = { x: 0, y: 0 };
	let wheelRadius = 0;
	let animationFrame: number;
	
	// Touch/mouse tracking
	let touchId: number | null = null;
	let lastTouchTime = 0;
	let tapCount = 0;
	
	// Color wheel configuration
	const wheelConfig = {
		shadows: { 
			hueOffset: 0, 
			saturationMultiplier: 0.8,
			brightnessRange: [0.2, 0.8],
			centerColor: '#404040'
		},
		midtones: { 
			hueOffset: 0, 
			saturationMultiplier: 1.0,
			brightnessRange: [0.3, 0.9],
			centerColor: '#808080'
		},
		highlights: { 
			hueOffset: 0, 
			saturationMultiplier: 0.9,
			brightnessRange: [0.5, 1.0],
			centerColor: '#C0C0C0'
		}
	};
	
	// Control type configuration
	const controlConfig = {
		lift: { 
			range: [-1, 1], 
			defaultValue: 0, 
			label: 'Lift',
			description: 'Adjusts shadows/blacks'
		},
		gamma: { 
			range: [0.1, 3.0], 
			defaultValue: 1, 
			label: 'Gamma',
			description: 'Adjusts midtones'
		},
		gain: { 
			range: [0.1, 3.0], 
			defaultValue: 1, 
			label: 'Gain',
			description: 'Adjusts highlights/whites'
		}
	};
	
	$: config = wheelConfig[wheelType];
	$: controlInfo = controlConfig[controlType];
	$: wheelSize = fullscreen ? Math.min(window?.innerWidth * 0.8, window?.innerHeight * 0.8, 400) : size;
	$: wheelRadius = wheelSize / 2 - 20;
	$: wheelCenter = { x: wheelSize / 2, y: wheelSize / 2 };
	
	onMount(() => {
		if (browser && canvas) {
			ctx = canvas.getContext('2d')!;
			setupCanvas();
			drawColorWheel();
			updateIndicatorPosition();
		}
	});
	
	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	});
	
	function setupCanvas() {
		if (!canvas || !ctx) return;
		
		// Set up high DPI canvas
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		
		canvas.width = wheelSize * dpr;
		canvas.height = wheelSize * dpr;
		canvas.style.width = wheelSize + 'px';
		canvas.style.height = wheelSize + 'px';
		
		ctx.scale(dpr, dpr);
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
	}
	
	function drawColorWheel() {
		if (!ctx) return;
		
		ctx.clearRect(0, 0, wheelSize, wheelSize);
		
		// Draw color wheel background
		drawWheelBackground();
		
		// Draw wheel border
		drawWheelBorder();
		
		// Draw current position indicator
		drawPositionIndicator();
		
		// Draw center point
		drawCenterPoint();
	}
	
	function drawWheelBackground() {
		const centerX = wheelCenter.x;
		const centerY = wheelCenter.y;
		
		// Create radial gradient for the wheel
		const imageData = ctx.createImageData(wheelSize, wheelSize);
		const data = imageData.data;
		
		for (let y = 0; y < wheelSize; y++) {
			for (let x = 0; x < wheelSize; x++) {
				const dx = x - centerX;
				const dy = y - centerY;
				const distance = Math.sqrt(dx * dx + dy * dy);
				
				if (distance <= wheelRadius) {
					// Calculate hue and saturation from position
					const angle = Math.atan2(dy, dx);
					const hue = ((angle + Math.PI) / (2 * Math.PI) + config.hueOffset) % 1;
					const saturation = (distance / wheelRadius) * config.saturationMultiplier;
					const brightness = config.brightnessRange[0] + 
						(config.brightnessRange[1] - config.brightnessRange[0]) * (1 - distance / wheelRadius);
					
					const rgb = hsvToRgb(hue, saturation, brightness);
					const index = (y * wheelSize + x) * 4;
					
					data[index] = rgb.r;     // Red
					data[index + 1] = rgb.g; // Green
					data[index + 2] = rgb.b; // Blue
					data[index + 3] = 255;   // Alpha
				} else {
					// Transparent outside the wheel
					const index = (y * wheelSize + x) * 4;
					data[index + 3] = 0;
				}
			}
		}
		
		ctx.putImageData(imageData, 0, 0);
	}
	
	function drawWheelBorder() {
		ctx.beginPath();
		ctx.arc(wheelCenter.x, wheelCenter.y, wheelRadius, 0, 2 * Math.PI);
		ctx.strokeStyle = '#666';
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	
	function drawPositionIndicator() {
		const pos = valuesToPosition(values);
		
		// Draw indicator circle
		ctx.beginPath();
		ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
		ctx.fillStyle = 'white';
		ctx.fill();
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 2;
		ctx.stroke();
		
		// Draw inner dot
		ctx.beginPath();
		ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
		ctx.fillStyle = '#333';
		ctx.fill();
	}
	
	function drawCenterPoint() {
		ctx.beginPath();
		ctx.arc(wheelCenter.x, wheelCenter.y, 4, 0, 2 * Math.PI);
		ctx.fillStyle = config.centerColor;
		ctx.fill();
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 1;
		ctx.stroke();
	}
	
	function valuesToPosition(vals: { r: number; g: number; b: number }) {
		// Convert RGB values to wheel position
		const magnitude = Math.sqrt(vals.r * vals.r + vals.g * vals.g + vals.b * vals.b);
		const angle = Math.atan2(vals.g, vals.r);
		
		const distance = Math.min(magnitude * wheelRadius * 0.5, wheelRadius);
		const x = wheelCenter.x + Math.cos(angle) * distance;
		const y = wheelCenter.y + Math.sin(angle) * distance;
		
		return { x, y };
	}
	
	function positionToValues(pos: { x: number; y: number }) {
		const dx = pos.x - wheelCenter.x;
		const dy = pos.y - wheelCenter.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const angle = Math.atan2(dy, dx);
		
		// Clamp to wheel radius
		const clampedDistance = Math.min(distance, wheelRadius);
		const normalizedDistance = clampedDistance / wheelRadius;
		
		// Convert to RGB values based on control type
		const magnitude = normalizedDistance * 2 * sensitivity;
		const r = Math.cos(angle) * magnitude;
		const g = Math.sin(angle) * magnitude;
		const b = 0; // For now, we'll use 2D control (R/G plane)
		
		// Apply control-specific constraints
		const range = controlInfo.range;
		const clampedR = Math.max(range[0], Math.min(range[1], r));
		const clampedG = Math.max(range[0], Math.min(range[1], g));
		const clampedB = Math.max(range[0], Math.min(range[1], b));
		
		return { r: clampedR, g: clampedG, b: clampedB };
	}
	
	function updateIndicatorPosition() {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
		
		animationFrame = requestAnimationFrame(() => {
			drawColorWheel();
		});
	}
	
	function handlePointerDown(event: PointerEvent) {
		if (disabled) return;
		
		event.preventDefault();
		canvas.setPointerCapture(event.pointerId);
		
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		
		isDragging = true;
		dragStartPos = { x, y };
		currentPos = { x, y };
		
		// Check for double-tap to toggle fullscreen
		const now = Date.now();
		if (now - lastTouchTime < 300) {
			tapCount++;
			if (tapCount === 2) {
				dispatch('fullscreenToggle', { wheelType, controlType });
				tapCount = 0;
			}
		} else {
			tapCount = 1;
		}
		lastTouchTime = now;
		
		// Provide haptic feedback if available
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate(10);
		}
		
		updateFromPosition({ x, y });
	}
	
	function handlePointerMove(event: PointerEvent) {
		if (!isDragging || disabled) return;
		
		event.preventDefault();
		
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		
		currentPos = { x, y };
		updateFromPosition({ x, y });
	}
	
	function handlePointerUp(event: PointerEvent) {
		if (!isDragging) return;
		
		event.preventDefault();
		canvas.releasePointerCapture(event.pointerId);
		
		isDragging = false;
		
		// Provide haptic feedback if available
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate(5);
		}
	}
	
	function updateFromPosition(pos: { x: number; y: number }) {
		const newValues = positionToValues(pos);
		
		// Only dispatch if values actually changed
		if (newValues.r !== values.r || newValues.g !== values.g || newValues.b !== values.b) {
			dispatch('change', {
				wheelType,
				controlType,
				values: newValues
			});
		}
		
		updateIndicatorPosition();
	}
	
	function handleReset() {
		if (disabled) return;
		
		const defaultValue = controlInfo.defaultValue;
		const resetValues = { r: defaultValue, g: defaultValue, b: defaultValue };
		
		dispatch('reset', { wheelType, controlType });
		
		// Provide haptic feedback
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate([10, 50, 10]);
		}
		
		updateIndicatorPosition();
	}
	
	function handleKeyDown(event: KeyboardEvent) {
		if (disabled) return;
		
		const step = 0.1 * sensitivity;
		let newValues = { ...values };
		
		switch (event.key) {
			case 'ArrowLeft':
				newValues.r = Math.max(controlInfo.range[0], newValues.r - step);
				break;
			case 'ArrowRight':
				newValues.r = Math.min(controlInfo.range[1], newValues.r + step);
				break;
			case 'ArrowUp':
				newValues.g = Math.min(controlInfo.range[1], newValues.g + step);
				break;
			case 'ArrowDown':
				newValues.g = Math.max(controlInfo.range[0], newValues.g - step);
				break;
			case 'Home':
				handleReset();
				return;
			case 'Enter':
			case ' ':
				dispatch('fullscreenToggle', { wheelType, controlType });
				return;
			default:
				return;
		}
		
		event.preventDefault();
		dispatch('change', { wheelType, controlType, values: newValues });
		updateIndicatorPosition();
	}
	
	// Utility function to convert HSV to RGB
	function hsvToRgb(h: number, s: number, v: number) {
		const c = v * s;
		const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
		const m = v - c;
		
		let r = 0, g = 0, b = 0;
		
		if (h < 1/6) {
			r = c; g = x; b = 0;
		} else if (h < 2/6) {
			r = x; g = c; b = 0;
		} else if (h < 3/6) {
			r = 0; g = c; b = x;
		} else if (h < 4/6) {
			r = 0; g = x; b = c;
		} else if (h < 5/6) {
			r = x; g = 0; b = c;
		} else {
			r = c; g = 0; b = x;
		}
		
		return {
			r: Math.round((r + m) * 255),
			g: Math.round((g + m) * 255),
			b: Math.round((b + m) * 255)
		};
	}
	
	// Reactive updates
	$: if (canvas && ctx) {
		setupCanvas();
		updateIndicatorPosition();
	}
	
	$: if (values) {
		updateIndicatorPosition();
	}
</script>

<div 
	class="color-wheel-container {fullscreen ? 'fullscreen' : ''}"
	class:disabled
>
	<!-- Wheel Header -->
	<div class="wheel-header">
		<div class="wheel-info">
			<h3 class="wheel-title">{wheelType} - {controlInfo.label}</h3>
			{#if !fullscreen}
				<p class="wheel-description">{controlInfo.description}</p>
			{/if}
		</div>
		
		<div class="wheel-actions">
			{#if !fullscreen}
				<button 
					class="btn-expand"
					on:click={() => dispatch('fullscreenToggle', { wheelType, controlType })}
					disabled={disabled}
					title="Expand to fullscreen"
				>
					⛶
				</button>
			{/if}
			
			<button 
				class="btn-reset"
				on:click={handleReset}
				disabled={disabled}
				title="Reset to default"
			>
				↺
			</button>
		</div>
	</div>
	
	<!-- Color Wheel Canvas -->
	<div class="wheel-canvas-container">
		<canvas
			bind:this={canvas}
			class="color-wheel-canvas"
			width={wheelSize}
			height={wheelSize}
			tabindex={disabled ? -1 : 0}
			role="slider"
			aria-label="{wheelType} {controlInfo.label} color wheel"
			aria-valuemin={controlInfo.range[0]}
			aria-valuemax={controlInfo.range[1]}
			aria-valuenow={Math.round((values.r + values.g + values.b) / 3 * 100) / 100}
			on:pointerdown={handlePointerDown}
			on:pointermove={handlePointerMove}
			on:pointerup={handlePointerUp}
			on:keydown={handleKeyDown}
		/>
		
		<!-- Touch overlay for better mobile interaction -->
		<div class="touch-overlay" class:active={isDragging}></div>
	</div>
	
	<!-- Value Display -->
	{#if showValues}
		<div class="value-display">
			<div class="value-row">
				<span class="value-label">R:</span>
				<span class="value-number">{values.r.toFixed(3)}</span>
			</div>
			<div class="value-row">
				<span class="value-label">G:</span>
				<span class="value-number">{values.g.toFixed(3)}</span>
			</div>
			<div class="value-row">
				<span class="value-label">B:</span>
				<span class="value-number">{values.b.toFixed(3)}</span>
			</div>
		</div>
	{/if}
	
	<!-- Fullscreen Close Button -->
	{#if fullscreen}
		<button 
			class="btn-close-fullscreen"
			on:click={() => dispatch('fullscreenToggle', { wheelType, controlType })}
			title="Exit fullscreen"
		>
			✕
		</button>
	{/if}
</div>

<style>
	.color-wheel-container {
		@apply relative bg-arri-gray rounded-lg p-4;
		@apply border border-gray-600;
		@apply transition-all duration-300;
		touch-action: none;
		user-select: none;
	}
	
	.color-wheel-container.fullscreen {
		@apply fixed inset-0 z-50 bg-black bg-opacity-95;
		@apply flex flex-col items-center justify-center;
		@apply p-8;
		border-radius: 0;
	}
	
	.color-wheel-container.disabled {
		@apply opacity-50 cursor-not-allowed;
	}
	
	.wheel-header {
		@apply flex items-center justify-between mb-4;
	}
	
	.wheel-info {
		@apply flex-1;
	}
	
	.wheel-title {
		@apply text-lg font-medium capitalize;
		@apply text-white;
	}
	
	.wheel-description {
		@apply text-sm text-gray-400 mt-1;
	}
	
	.wheel-actions {
		@apply flex gap-2;
	}
	
	.btn-expand, .btn-reset {
		@apply w-10 h-10 rounded bg-gray-700 hover:bg-gray-600;
		@apply flex items-center justify-center;
		@apply text-white font-bold transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-expand:hover:not(:disabled) {
		@apply bg-arri-red;
	}
	
	.btn-reset:hover:not(:disabled) {
		@apply bg-blue-600;
	}
	
	.wheel-canvas-container {
		@apply relative flex items-center justify-center;
		@apply mb-4;
	}
	
	.color-wheel-canvas {
		@apply cursor-crosshair;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red focus:ring-opacity-50;
		@apply rounded-full;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
	}
	
	.color-wheel-canvas:disabled {
		@apply cursor-not-allowed;
	}
	
	.touch-overlay {
		@apply absolute inset-0 pointer-events-none;
		@apply rounded-full;
		@apply transition-all duration-150;
	}
	
	.touch-overlay.active {
		@apply bg-white bg-opacity-10;
		@apply ring-2 ring-arri-red ring-opacity-50;
	}
	
	.value-display {
		@apply grid grid-cols-3 gap-4 text-sm;
		@apply bg-gray-800 rounded p-3;
	}
	
	.value-row {
		@apply flex items-center justify-between;
	}
	
	.value-label {
		@apply text-gray-400 font-medium;
	}
	
	.value-number {
		@apply text-white font-mono;
	}
	
	.btn-close-fullscreen {
		@apply absolute top-4 right-4;
		@apply w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700;
		@apply flex items-center justify-center;
		@apply text-white text-xl font-bold;
		@apply transition-colors;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.color-wheel-container.fullscreen {
			@apply p-4;
		}
		
		.wheel-header {
			@apply flex-col items-start gap-2;
		}
		
		.wheel-actions {
			@apply self-end;
		}
		
		.value-display {
			@apply grid-cols-1 gap-2;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.color-wheel-canvas {
			@apply ring-2 ring-white;
		}
		
		.btn-expand, .btn-reset {
			@apply border border-white;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.color-wheel-container, .touch-overlay, .btn-expand, .btn-reset {
			@apply transition-none;
		}
	}
	
	/* Dark mode adjustments */
	@media (prefers-color-scheme: dark) {
		.wheel-title {
			@apply text-gray-100;
		}
		
		.wheel-description {
			@apply text-gray-300;
		}
	}
</style>