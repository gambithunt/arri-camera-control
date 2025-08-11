<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { createTouchSlider, triggerHaptic, TouchPerformance, type SliderOptions } from '$lib/utils/touchInteractions';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let min = 0;
	export let max = 100;
	export let step = 1;
	export let value = 0;
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';
	export let sensitivity = 1;
	export let hapticFeedback = true;
	export let snapToSteps = true;
	export let disabled = false;
	export let showValue = true;
	export let showTicks = false;
	export let tickCount = 5;
	export let label = '';
	export let unit = '';
	export let className = '';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		change: { value: number };
		input: { value: number };
		start: { value: number };
		end: { value: number };
	}>();
	
	// Component state
	let sliderElement: HTMLDivElement;
	let trackElement: HTMLDivElement;
	let thumbElement: HTMLDivElement;
	let touchSlider: ReturnType<typeof createTouchSlider> | null = null;
	let isDragging = false;
	let displayValue = value;
	
	// Reactive screen info
	$: currentScreenInfo = $screenInfo;
	$: isTouch = currentScreenInfo.isTouch;
	
	// Compute slider classes
	$: sliderClasses = computeSliderClasses(orientation, size, disabled, isDragging, className);
	$: thumbPosition = computeThumbPosition(displayValue, min, max, orientation);
	$: ticks = showTicks ? generateTicks(min, max, tickCount) : [];
	
	function computeSliderClasses(
		orientation: string,
		size: string,
		disabled: boolean,
		dragging: boolean,
		customClass: string
	): string {
		const classes = ['touch-slider', 'relative', 'touch-manipulation'];
		
		// Orientation classes
		if (orientation === 'horizontal') {
			classes.push('w-full');
			
			// Size classes for horizontal
			const horizontalSizeMap = {
				sm: 'h-6',
				md: 'h-8',
				lg: 'h-10'
			};
			classes.push(horizontalSizeMap[size as keyof typeof horizontalSizeMap]);
		} else {
			classes.push('h-full');
			
			// Size classes for vertical
			const verticalSizeMap = {
				sm: 'w-6',
				md: 'w-8',
				lg: 'w-10'
			};
			classes.push(verticalSizeMap[size as keyof typeof verticalSizeMap]);
		}
		
		// State classes
		if (disabled) {
			classes.push('opacity-50', 'cursor-not-allowed');
		} else {
			classes.push('cursor-pointer');
		}
		
		if (dragging) {
			classes.push('cursor-grabbing');
		}
		
		// Custom classes
		if (customClass) {
			classes.push(customClass);
		}
		
		return classes.join(' ');
	}
	
	function computeThumbPosition(value: number, min: number, max: number, orientation: string): string {
		const percentage = ((value - min) / (max - min)) * 100;
		
		if (orientation === 'horizontal') {
			return `left: ${percentage}%`;
		} else {
			return `bottom: ${percentage}%`;
		}
	}
	
	function generateTicks(min: number, max: number, count: number): number[] {
		const ticks = [];
		const step = (max - min) / (count - 1);
		
		for (let i = 0; i < count; i++) {
			ticks.push(min + (step * i));
		}
		
		return ticks;
	}
	
	function getTickPosition(tickValue: number): string {
		const percentage = ((tickValue - min) / (max - min)) * 100;
		
		if (orientation === 'horizontal') {
			return `left: ${percentage}%`;
		} else {
			return `bottom: ${percentage}%`;
		}
	}
	
	function formatValue(val: number): string {
		const formatted = step < 1 ? val.toFixed(2) : val.toString();
		return unit ? `${formatted}${unit}` : formatted;
	}
	
	// Throttled input handler for smooth updates
	const handleInput = TouchPerformance.throttle((newValue: number) => {
		displayValue = newValue;
		dispatch('input', { value: newValue });
	}, 16); // ~60fps
	
	// Debounced change handler for final value
	const handleChange = TouchPerformance.debounce((newValue: number) => {
		value = newValue;
		dispatch('change', { value: newValue });
	}, 100);
	
	onMount(() => {
		if (sliderElement && !disabled) {
			const options: SliderOptions = {
				min,
				max,
				step,
				value,
				orientation,
				sensitivity,
				hapticFeedback,
				snapToSteps
			};
			
			touchSlider = createTouchSlider(sliderElement, options);
			
			touchSlider.onChange((newValue) => {
				handleInput(newValue);
				handleChange(newValue);
			});
		}
	});
	
	onDestroy(() => {
		if (touchSlider) {
			touchSlider.destroy();
		}
	});
	
	// Update slider when props change
	$: if (touchSlider && value !== displayValue) {
		touchSlider.setValue(value);
		displayValue = value;
	}
	
	// Handle keyboard interactions
	function handleKeyDown(event: KeyboardEvent) {
		if (disabled) return;
		
		let newValue = value;
		const stepSize = step || 1;
		
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowDown':
				event.preventDefault();
				newValue = Math.max(min, value - stepSize);
				break;
			case 'ArrowRight':
			case 'ArrowUp':
				event.preventDefault();
				newValue = Math.min(max, value + stepSize);
				break;
			case 'Home':
				event.preventDefault();
				newValue = min;
				break;
			case 'End':
				event.preventDefault();
				newValue = max;
				break;
			case 'PageDown':
				event.preventDefault();
				newValue = Math.max(min, value - stepSize * 10);
				break;
			case 'PageUp':
				event.preventDefault();
				newValue = Math.min(max, value + stepSize * 10);
				break;
			default:
				return;
		}
		
		if (newValue !== value) {
			if (hapticFeedback) {
				triggerHaptic({ type: 'light' });
			}
			
			value = newValue;
			displayValue = newValue;
			dispatch('change', { value: newValue });
		}
	}
	
	// Handle direct click/tap on track
	function handleTrackClick(event: MouseEvent | TouchEvent) {
		if (disabled || isDragging) return;
		
		const rect = trackElement.getBoundingClientRect();
		let percentage: number;
		
		if (event instanceof MouseEvent) {
			if (orientation === 'horizontal') {
				percentage = (event.clientX - rect.left) / rect.width;
			} else {
				percentage = 1 - (event.clientY - rect.top) / rect.height;
			}
		} else {
			const touch = event.touches[0] || event.changedTouches[0];
			if (orientation === 'horizontal') {
				percentage = (touch.clientX - rect.left) / rect.width;
			} else {
				percentage = 1 - (touch.clientY - rect.top) / rect.height;
			}
		}
		
		percentage = Math.max(0, Math.min(1, percentage));
		const newValue = min + (percentage * (max - min));
		const snappedValue = snapToSteps ? Math.round(newValue / step) * step : newValue;
		
		if (hapticFeedback) {
			triggerHaptic({ type: 'selection' });
		}
		
		value = snappedValue;
		displayValue = snappedValue;
		dispatch('change', { value: snappedValue });
	}
</script>

<div class="slider-container" class:vertical={orientation === 'vertical'}>
	{#if label}
		<label class="slider-label text-responsive-sm font-medium mb-2 block">
			{label}
		</label>
	{/if}
	
	<div
		bind:this={sliderElement}
		class={sliderClasses}
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={displayValue}
		aria-valuetext={formatValue(displayValue)}
		aria-label={label}
		aria-disabled={disabled}
		on:keydown={handleKeyDown}
	>
		<!-- Track -->
		<div
			bind:this={trackElement}
			class="slider-track"
			class:horizontal={orientation === 'horizontal'}
			class:vertical={orientation === 'vertical'}
			on:click={handleTrackClick}
			on:touchstart={handleTrackClick}
		>
			<!-- Fill -->
			<div
				class="slider-fill"
				class:horizontal={orientation === 'horizontal'}
				class:vertical={orientation === 'vertical'}
				style={orientation === 'horizontal' 
					? `width: ${((displayValue - min) / (max - min)) * 100}%`
					: `height: ${((displayValue - min) / (max - min)) * 100}%`
				}
			></div>
			
			<!-- Ticks -->
			{#if showTicks}
				{#each ticks as tick}
					<div
						class="slider-tick"
						class:horizontal={orientation === 'horizontal'}
						class:vertical={orientation === 'vertical'}
						style={getTickPosition(tick)}
					></div>
				{/each}
			{/if}
		</div>
		
		<!-- Thumb -->
		<div
			bind:this={thumbElement}
			class="slider-thumb"
			class:dragging={isDragging}
			class:touch={isTouch}
			style={thumbPosition}
		>
			{#if showValue}
				<div class="slider-value-tooltip">
					{formatValue(displayValue)}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.slider-container {
		@apply w-full;
	}
	
	.slider-container.vertical {
		@apply h-full w-auto;
	}
	
	.touch-slider {
		@apply flex items-center justify-center;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red focus:ring-opacity-50;
		@apply rounded-lg;
		
		/* Optimize for touch */
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
	
	.slider-track {
		@apply relative bg-arri-gray rounded-full cursor-pointer;
		@apply transition-colors duration-150;
	}
	
	.slider-track:hover {
		@apply bg-gray-600;
	}
	
	.slider-track.horizontal {
		@apply w-full h-2;
	}
	
	.slider-track.vertical {
		@apply h-full w-2;
	}
	
	.slider-fill {
		@apply bg-arri-red rounded-full transition-all duration-150;
		@apply pointer-events-none;
	}
	
	.slider-fill.horizontal {
		@apply h-full;
	}
	
	.slider-fill.vertical {
		@apply w-full absolute bottom-0;
	}
	
	.slider-tick {
		@apply absolute bg-white rounded-full pointer-events-none;
		@apply w-1 h-1;
		transform: translate(-50%, -50%);
	}
	
	.slider-tick.horizontal {
		@apply top-1/2;
	}
	
	.slider-tick.vertical {
		@apply left-1/2;
	}
	
	.slider-thumb {
		@apply absolute bg-white border-2 border-arri-red rounded-full;
		@apply transition-all duration-150 cursor-grab;
		@apply shadow-lg;
		@apply w-5 h-5;
		transform: translate(-50%, -50%);
		will-change: transform;
	}
	
	.slider-thumb.touch {
		@apply w-6 h-6;
	}
	
	.slider-thumb.dragging {
		@apply cursor-grabbing scale-110 shadow-xl;
	}
	
	.slider-thumb:hover {
		@apply scale-105 shadow-xl;
	}
	
	.slider-value-tooltip {
		@apply absolute -top-10 left-1/2 transform -translate-x-1/2;
		@apply bg-arri-dark text-white text-xs px-2 py-1 rounded;
		@apply opacity-0 transition-opacity duration-150 pointer-events-none;
		@apply whitespace-nowrap;
	}
	
	.slider-thumb:hover .slider-value-tooltip,
	.slider-thumb.dragging .slider-value-tooltip {
		@apply opacity-100;
	}
	
	/* Vertical orientation adjustments */
	.slider-container.vertical .slider-thumb {
		@apply left-1/2;
	}
	
	.slider-container.vertical .slider-value-tooltip {
		@apply -left-12 top-1/2 transform -translate-y-1/2;
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.slider-track {
			@apply border border-gray-400;
		}
		
		.slider-thumb {
			@apply border-4;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.slider-fill,
		.slider-thumb,
		.slider-value-tooltip {
			transition: none;
		}
	}
	
	/* Focus visible for keyboard navigation */
	.touch-slider:focus-visible {
		@apply ring-2 ring-arri-red ring-opacity-50;
	}
</style>