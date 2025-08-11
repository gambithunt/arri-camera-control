<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { createGestureRecognizer, triggerHaptic, TouchPerformance, type GestureEvent } from '$lib/utils/touchInteractions';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let disabled = false;
	export let loading = false;
	export let hapticFeedback = true;
	export let pressAnimation = true;
	export let className = '';
	export let ariaLabel = '';
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		click: { event: GestureEvent };
		press: { event: GestureEvent };
		doubletap: { event: GestureEvent };
	}>();
	
	// Component state
	let buttonElement: HTMLButtonElement;
	let gestureRecognizer: ReturnType<typeof createGestureRecognizer> | null = null;
	let isPressed = false;
	let pressTimeout: NodeJS.Timeout | null = null;
	
	// Reactive screen info
	$: currentScreenInfo = $screenInfo;
	$: isTouch = currentScreenInfo.isTouch;
	
	// Compute button classes
	$: buttonClasses = computeButtonClasses(variant, size, disabled, loading, isPressed, isTouch, className);
	
	function computeButtonClasses(
		variant: string,
		size: string,
		disabled: boolean,
		loading: boolean,
		pressed: boolean,
		isTouch: boolean,
		customClass: string
	): string {
		const classes = ['touch-button'];
		
		// Base classes
		classes.push('relative', 'inline-flex', 'items-center', 'justify-center');
		classes.push('font-medium', 'rounded-lg', 'transition-all', 'duration-150');
		classes.push('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2');
		classes.push('select-none', 'touch-manipulation');
		
		// Variant classes
		const variantMap = {
			primary: [
				'bg-arri-red', 'text-white', 'border-transparent',
				'hover:bg-red-600', 'focus:ring-arri-red',
				'active:bg-red-700'
			],
			secondary: [
				'bg-arri-gray', 'text-white', 'border-transparent',
				'hover:bg-gray-600', 'focus:ring-gray-500',
				'active:bg-gray-700'
			],
			ghost: [
				'bg-transparent', 'text-white', 'border-transparent',
				'hover:bg-arri-gray', 'focus:ring-gray-500',
				'active:bg-gray-700'
			],
			danger: [
				'bg-red-600', 'text-white', 'border-transparent',
				'hover:bg-red-700', 'focus:ring-red-500',
				'active:bg-red-800'
			]
		};
		classes.push(...variantMap[variant as keyof typeof variantMap]);
		
		// Size classes
		const sizeMap = {
			sm: isTouch ? ['px-3', 'py-2', 'text-sm', 'min-h-[44px]'] : ['px-3', 'py-2', 'text-sm', 'min-h-[32px]'],
			md: isTouch ? ['px-4', 'py-3', 'text-base', 'min-h-[48px]'] : ['px-4', 'py-2', 'text-base', 'min-h-[36px]'],
			lg: isTouch ? ['px-6', 'py-4', 'text-lg', 'min-h-[52px]'] : ['px-6', 'py-3', 'text-lg', 'min-h-[40px]']
		};
		classes.push(...sizeMap[size as keyof typeof sizeMap]);
		
		// State classes
		if (disabled) {
			classes.push('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
		} else {
			classes.push('cursor-pointer');
		}
		
		if (loading) {
			classes.push('cursor-wait');
		}
		
		if (pressed && pressAnimation) {
			classes.push('scale-95', 'brightness-90');
		}
		
		// Touch-specific classes
		if (isTouch) {
			classes.push('min-w-[44px]');
		}
		
		// Custom classes
		if (customClass) {
			classes.push(customClass);
		}
		
		return classes.join(' ');
	}
	
	onMount(() => {
		if (buttonElement && !disabled) {
			gestureRecognizer = createGestureRecognizer(buttonElement);
			
			// Handle tap (click)
			gestureRecognizer.on('tap', (event) => {
				if (disabled || loading) return;
				
				TouchPerformance.optimizeCallback(() => {
					if (hapticFeedback) {
						triggerHaptic({ type: 'selection' });
					}
					dispatch('click', { event });
				});
			});
			
			// Handle long press
			gestureRecognizer.on('press', (event) => {
				if (disabled || loading) return;
				
				TouchPerformance.optimizeCallback(() => {
					if (hapticFeedback) {
						triggerHaptic({ type: 'medium' });
					}
					dispatch('press', { event });
				});
			});
			
			// Handle double tap
			gestureRecognizer.on('doubletap', (event) => {
				if (disabled || loading) return;
				
				TouchPerformance.optimizeCallback(() => {
					if (hapticFeedback) {
						triggerHaptic({ type: 'light' });
					}
					dispatch('doubletap', { event });
				});
			});
			
			// Handle pan start for press animation
			gestureRecognizer.on('pan', (event) => {
				if (disabled || loading || !pressAnimation) return;
				
				if (!isPressed) {
					isPressed = true;
					if (pressTimeout) clearTimeout(pressTimeout);
					pressTimeout = setTimeout(() => {
						isPressed = false;
					}, 150);
				}
			});
		}
	});
	
	onDestroy(() => {
		if (gestureRecognizer) {
			gestureRecognizer.destroy();
		}
		if (pressTimeout) {
			clearTimeout(pressTimeout);
		}
	});
	
	// Fallback click handler for non-touch devices
	function handleClick(event: MouseEvent) {
		if (disabled || loading || isTouch) return;
		
		event.preventDefault();
		event.stopPropagation();
		
		if (hapticFeedback) {
			triggerHaptic({ type: 'selection' });
		}
		
		// Create a gesture-like event for consistency
		const gestureEvent = {
			type: 'tap' as const,
			target: buttonElement,
			startPoint: { x: event.clientX, y: event.clientY },
			currentPoint: { x: event.clientX, y: event.clientY },
			deltaX: 0,
			deltaY: 0,
			duration: 0
		};
		
		dispatch('click', { event: gestureEvent });
	}
	
	// Handle keyboard interactions
	function handleKeyDown(event: KeyboardEvent) {
		if (disabled || loading) return;
		
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			
			if (hapticFeedback) {
				triggerHaptic({ type: 'selection' });
			}
			
			// Create a gesture-like event for consistency
			const gestureEvent = {
				type: 'tap' as const,
				target: buttonElement,
				startPoint: { x: 0, y: 0 },
				currentPoint: { x: 0, y: 0 },
				deltaX: 0,
				deltaY: 0,
				duration: 0
			};
			
			dispatch('click', { event: gestureEvent });
		}
	}
</script>

<button
	bind:this={buttonElement}
	class={buttonClasses}
	{disabled}
	aria-label={ariaLabel}
	on:click={handleClick}
	on:keydown={handleKeyDown}
	type="button"
>
	{#if loading}
		<div class="loading-spinner mr-2">
			<div class="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
		</div>
	{/if}
	
	<slot />
</button>

<style>
	.touch-button {
		/* Prevent text selection */
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
		
		/* Optimize for touch */
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
		
		/* Ensure proper touch targets */
		touch-action: manipulation;
	}
	
	/* Loading spinner */
	.loading-spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	
	/* Press animation optimization */
	.touch-button {
		transform-origin: center;
		will-change: transform, filter;
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.touch-button {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.touch-button {
			transition: none;
		}
		
		.loading-spinner div {
			animation: none;
		}
	}
	
	/* Focus visible for keyboard navigation */
	.touch-button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
</style>