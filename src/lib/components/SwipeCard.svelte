<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { createGestureRecognizer, triggerHaptic, TouchPerformance, type GestureEvent } from '$lib/utils/touchInteractions';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let swipeActions: Array<{
		id: string;
		label: string;
		icon?: string;
		color: 'primary' | 'secondary' | 'danger' | 'success';
		side: 'left' | 'right';
	}> = [];
	export let swipeThreshold = 80;
	export let hapticFeedback = true;
	export let disabled = false;
	export let className = '';
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		swipeAction: { actionId: string; action: typeof swipeActions[0] };
		swipeStart: {};
		swipeEnd: {};
		tap: { event: GestureEvent };
	}>();
	
	// Component state
	let cardElement: HTMLDivElement;
	let gestureRecognizer: ReturnType<typeof createGestureRecognizer> | null = null;
	let swipeOffset = 0;
	let isSwipeActive = false;
	let activeActions: typeof swipeActions = [];
	let maxSwipeDistance = 0;
	
	// Reactive screen info
	$: currentScreenInfo = $screenInfo;
	$: isTouch = currentScreenInfo.isTouch;
	
	// Compute card classes and styles
	$: cardClasses = computeCardClasses(disabled, isSwipeActive, className);
	$: cardStyle = computeCardStyle(swipeOffset);
	$: leftActions = swipeActions.filter(action => action.side === 'left');
	$: rightActions = swipeActions.filter(action => action.side === 'right');
	
	function computeCardClasses(disabled: boolean, swipeActive: boolean, customClass: string): string {
		const classes = ['swipe-card', 'relative', 'bg-arri-gray', 'rounded-lg', 'overflow-hidden'];
		
		if (disabled) {
			classes.push('opacity-50', 'cursor-not-allowed');
		} else {
			classes.push('cursor-pointer');
		}
		
		if (swipeActive) {
			classes.push('z-10');
		}
		
		if (customClass) {
			classes.push(customClass);
		}
		
		return classes.join(' ');
	}
	
	function computeCardStyle(offset: number): string {
		if (offset === 0) return '';
		return `transform: translateX(${offset}px); transition: transform 0.1s ease-out;`;
	}
	
	function getActionColor(color: string): string {
		const colorMap = {
			primary: 'bg-arri-red',
			secondary: 'bg-arri-gray',
			danger: 'bg-red-600',
			success: 'bg-green-600'
		};
		return colorMap[color as keyof typeof colorMap] || colorMap.primary;
	}
	
	function calculateMaxSwipeDistance(): void {
		if (!cardElement) return;
		
		const cardWidth = cardElement.clientWidth;
		maxSwipeDistance = Math.min(cardWidth * 0.4, 200); // Max 40% of card width or 200px
	}
	
	function updateActiveActions(offset: number): void {
		if (Math.abs(offset) < swipeThreshold) {
			activeActions = [];
			return;
		}
		
		if (offset > 0) {
			// Swiping right, show left actions
			activeActions = leftActions;
		} else {
			// Swiping left, show right actions
			activeActions = rightActions;
		}
	}
	
	function executeAction(action: typeof swipeActions[0]): void {
		if (disabled) return;
		
		if (hapticFeedback) {
			triggerHaptic({ type: 'medium' });
		}
		
		dispatch('swipeAction', { actionId: action.id, action });
		resetSwipe();
	}
	
	function resetSwipe(): void {
		swipeOffset = 0;
		isSwipeActive = false;
		activeActions = [];
	}
	
	// Throttled swipe handler for smooth updates
	const handleSwipeUpdate = TouchPerformance.throttle((offset: number) => {
		swipeOffset = Math.max(-maxSwipeDistance, Math.min(maxSwipeDistance, offset));
		updateActiveActions(swipeOffset);
	}, 16); // ~60fps
	
	onMount(() => {
		if (cardElement && !disabled && isTouch && swipeActions.length > 0) {
			calculateMaxSwipeDistance();
			
			gestureRecognizer = createGestureRecognizer(cardElement);
			
			// Handle tap
			gestureRecognizer.on('tap', (event) => {
				if (isSwipeActive) {
					resetSwipe();
				} else {
					dispatch('tap', { event });
				}
			});
			
			// Handle pan (swipe)
			gestureRecognizer.on('pan', (event) => {
				if (!isSwipeActive && Math.abs(event.deltaX) > 10) {
					isSwipeActive = true;
					dispatch('swipeStart');
					
					if (hapticFeedback) {
						triggerHaptic({ type: 'light' });
					}
				}
				
				if (isSwipeActive) {
					handleSwipeUpdate(event.deltaX * 0.8); // Damping factor
				}
			});
			
			// Handle swipe completion
			gestureRecognizer.on('swipe', (event) => {
				const { direction, velocity } = event;
				
				if (isSwipeActive) {
					// Check if swipe was strong enough to trigger action
					if ((velocity || 0) > 0.5 && Math.abs(swipeOffset) > swipeThreshold) {
						if (activeActions.length === 1) {
							// Single action - execute immediately
							executeAction(activeActions[0]);
						} else if (activeActions.length > 1) {
							// Multiple actions - show action buttons
							if (hapticFeedback) {
								triggerHaptic({ type: 'medium' });
							}
						}
					} else {
						// Reset if swipe wasn't strong enough
						resetSwipe();
					}
					
					dispatch('swipeEnd');
				}
			});
		}
		
		// Handle window resize
		const handleResize = () => calculateMaxSwipeDistance();
		window.addEventListener('resize', handleResize);
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
	
	onDestroy(() => {
		if (gestureRecognizer) {
			gestureRecognizer.destroy();
		}
	});
	
	// Handle click outside to reset swipe
	function handleClickOutside(event: MouseEvent) {
		if (isSwipeActive && !cardElement.contains(event.target as Node)) {
			resetSwipe();
		}
	}
	
	$: if (isSwipeActive && typeof window !== 'undefined') {
		document.addEventListener('click', handleClickOutside);
	} else if (typeof window !== 'undefined') {
		document.removeEventListener('click', handleClickOutside);
	}
</script>

<div class="swipe-card-container relative">
	<!-- Action buttons background -->
	{#if isSwipeActive && activeActions.length > 0}
		<div class="swipe-actions absolute inset-y-0 flex items-center">
			{#if swipeOffset > 0}
				<!-- Left actions -->
				<div class="flex h-full" style="left: 0;">
					{#each leftActions as action}
						<button
							class="swipe-action-btn {getActionColor(action.color)} text-white px-4 flex items-center justify-center min-w-[80px] h-full transition-all duration-150 hover:brightness-110"
							on:click={() => executeAction(action)}
							aria-label={action.label}
						>
							{#if action.icon}
								<span class="text-xl mr-2">{action.icon}</span>
							{/if}
							<span class="text-sm font-medium">{action.label}</span>
						</button>
					{/each}
				</div>
			{:else if swipeOffset < 0}
				<!-- Right actions -->
				<div class="flex h-full" style="right: 0; position: absolute;">
					{#each rightActions as action}
						<button
							class="swipe-action-btn {getActionColor(action.color)} text-white px-4 flex items-center justify-center min-w-[80px] h-full transition-all duration-150 hover:brightness-110"
							on:click={() => executeAction(action)}
							aria-label={action.label}
						>
							{#if action.icon}
								<span class="text-xl mr-2">{action.icon}</span>
							{/if}
							<span class="text-sm font-medium">{action.label}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	
	<!-- Card content -->
	<div
		bind:this={cardElement}
		class={cardClasses}
		style={cardStyle}
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-label="Swipeable card"
	>
		<slot />
	</div>
</div>

<style>
	.swipe-card-container {
		/* Ensure proper stacking */
		isolation: isolate;
	}
	
	.swipe-card {
		/* Optimize for transforms */
		will-change: transform;
		
		/* Ensure proper touch handling */
		touch-action: pan-y;
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
		
		/* Prevent text selection during swipe */
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
	
	.swipe-actions {
		/* Ensure actions are behind card */
		z-index: -1;
	}
	
	.swipe-action-btn {
		/* Ensure proper touch targets */
		min-height: 44px;
		touch-action: manipulation;
		
		/* Prevent text selection */
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
		
		/* Optimize for touch */
		-webkit-tap-highlight-color: transparent;
	}
	
	/* Animation for smooth transitions */
	.swipe-card {
		transition: transform 0.2s ease-out;
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.swipe-action-btn {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.swipe-card,
		.swipe-action-btn {
			transition: none;
		}
	}
	
	/* Focus visible for keyboard navigation */
	.swipe-card:focus-visible {
		outline: 2px solid #E31E24;
		outline-offset: 2px;
	}
</style>