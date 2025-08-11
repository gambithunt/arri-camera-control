<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { createGestureRecognizer, triggerHaptic, TouchPerformance, type GestureEvent } from '$lib/utils/touchInteractions';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	import { browser } from '$app/environment';
	
	// Props
	export let open = false;
	export let title = '';
	export let size: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen' = 'md';
	export let closable = true;
	export let swipeToClose = true;
	export let pinchToClose = false;
	export let hapticFeedback = true;
	export let className = '';
	export let overlayClassName = '';
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		close: {};
		open: {};
		swipe: { direction: string; velocity: number };
		pinch: { scale: number };
	}>();
	
	// Component state
	let modalElement: HTMLDivElement;
	let contentElement: HTMLDivElement;
	let gestureRecognizer: ReturnType<typeof createGestureRecognizer> | null = null;
	let isAnimating = false;
	let swipeOffset = 0;
	let scale = 1;
	let previousOpen = open;
	
	// Reactive screen info
	$: currentScreenInfo = $screenInfo;
	$: isTouch = currentScreenInfo.isTouch;
	$: shouldUseFullscreen = currentScreenInfo.deviceType === 'phone' || size === 'fullscreen';
	
	// Compute modal classes
	$: modalClasses = computeModalClasses(size, shouldUseFullscreen, isAnimating, className);
	$: overlayClasses = computeOverlayClasses(overlayClassName);
	$: contentStyle = computeContentStyle(swipeOffset, scale);
	
	function computeModalClasses(
		size: string,
		fullscreen: boolean,
		animating: boolean,
		customClass: string
	): string {
		const classes = ['touch-modal'];
		
		if (fullscreen) {
			classes.push('fixed', 'inset-0', 'z-50');
		} else {
			classes.push('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4');
		}
		
		if (animating) {
			classes.push('pointer-events-none');
		}
		
		if (customClass) {
			classes.push(customClass);
		}
		
		return classes.join(' ');
	}
	
	function computeOverlayClasses(customClass: string): string {
		const classes = [
			'modal-overlay',
			'absolute', 'inset-0',
			'bg-black', 'bg-opacity-50',
			'transition-opacity', 'duration-300'
		];
		
		if (customClass) {
			classes.push(customClass);
		}
		
		return classes.join(' ');
	}
	
	function computeContentStyle(offset: number, scale: number): string {
		const transforms = [];
		
		if (offset !== 0) {
			transforms.push(`translateY(${offset}px)`);
		}
		
		if (scale !== 1) {
			transforms.push(`scale(${scale})`);
		}
		
		return transforms.length > 0 ? `transform: ${transforms.join(' ')}` : '';
	}
	
	function getContentClasses(): string {
		const classes = [
			'modal-content',
			'relative', 'bg-arri-dark', 'text-white',
			'transition-all', 'duration-300',
			'touch-manipulation'
		];
		
		if (shouldUseFullscreen) {
			classes.push('w-full', 'h-full', 'flex', 'flex-col');
		} else {
			classes.push('rounded-lg', 'shadow-xl', 'max-h-full', 'overflow-hidden');
			
			// Size classes for non-fullscreen
			const sizeMap = {
				sm: 'max-w-sm',
				md: 'max-w-md',
				lg: 'max-w-lg',
				xl: 'max-w-xl'
			};
			classes.push(sizeMap[size as keyof typeof sizeMap] || sizeMap.md);
		}
		
		return classes.join(' ');
	}
	
	function openModal() {
		if (open) return;
		
		open = true;
		isAnimating = true;
		
		if (hapticFeedback) {
			triggerHaptic({ type: 'light' });
		}
		
		// Prevent body scroll
		if (browser) {
			document.body.style.overflow = 'hidden';
		}
		
		// Reset transforms
		swipeOffset = 0;
		scale = 1;
		
		setTimeout(() => {
			isAnimating = false;
		}, 300);
		
		dispatch('open');
	}
	
	function closeModal() {
		if (!open) return;
		
		isAnimating = true;
		
		if (hapticFeedback) {
			triggerHaptic({ type: 'light' });
		}
		
		setTimeout(() => {
			open = false;
			isAnimating = false;
			
			// Restore body scroll
			if (browser) {
				document.body.style.overflow = '';
			}
			
			// Reset transforms
			swipeOffset = 0;
			scale = 1;
		}, 300);
		
		dispatch('close');
	}
	
	function handleOverlayClick(event: MouseEvent) {
		if (!closable || event.target !== event.currentTarget) return;
		closeModal();
	}
	
	function handleEscapeKey(event: KeyboardEvent) {
		if (!closable || event.key !== 'Escape') return;
		closeModal();
	}
	
	onMount(() => {
		if (contentElement && isTouch) {
			gestureRecognizer = createGestureRecognizer(contentElement);
			
			// Handle swipe to close
			if (swipeToClose) {
				gestureRecognizer.on('swipe', (event) => {
					const { direction, velocity } = event;
					
					dispatch('swipe', { direction, velocity: velocity || 0 });
					
					// Close on downward swipe with sufficient velocity
					if (direction === 'down' && (velocity || 0) > 0.5) {
						if (hapticFeedback) {
							triggerHaptic({ type: 'medium' });
						}
						closeModal();
					}
				});
				
				// Handle pan for live swipe feedback
				gestureRecognizer.on('pan', (event) => {
					if (event.deltaY > 0) {
						// Only allow downward swipes
						swipeOffset = Math.min(event.deltaY * 0.5, 100);
					}
				});
			}
			
			// Handle pinch to close
			if (pinchToClose) {
				gestureRecognizer.on('pinch', (event) => {
					const { scale: gestureScale } = event;
					
					if (gestureScale) {
						scale = Math.max(0.5, Math.min(1.2, gestureScale));
						dispatch('pinch', { scale });
						
						// Close on significant pinch in
						if (gestureScale < 0.7) {
							if (hapticFeedback) {
								triggerHaptic({ type: 'medium' });
							}
							closeModal();
						}
					}
				});
			}
		}
		
		// Handle keyboard events
		if (browser) {
			document.addEventListener('keydown', handleEscapeKey);
		}
	});
	
	onDestroy(() => {
		if (gestureRecognizer) {
			gestureRecognizer.destroy();
		}
		
		if (browser) {
			document.removeEventListener('keydown', handleEscapeKey);
			// Restore body scroll if modal was open
			if (open) {
				document.body.style.overflow = '';
			}
		}
	});
	
	// Watch for open prop changes
	$: if (open !== previousOpen) {
		if (open) {
			openModal();
		} else {
			closeModal();
		}
		previousOpen = open;
	}
</script>

{#if open}
	<div
		bind:this={modalElement}
		class={modalClasses}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'modal-title' : undefined}
	>
		<!-- Overlay -->
		<div
			class={overlayClasses}
			on:click={handleOverlayClick}
			on:keydown={() => {}}
			role="button"
			tabindex="-1"
		></div>
		
		<!-- Content -->
		<div
			bind:this={contentElement}
			class={getContentClasses()}
			style={contentStyle}
		>
			<!-- Header -->
			{#if title || closable}
				<div class="modal-header flex items-center justify-between p-4 border-b border-arri-gray">
					{#if title}
						<h2 id="modal-title" class="text-responsive-lg font-semibold">
							{title}
						</h2>
					{/if}
					
					{#if closable}
						<button
							class="modal-close-btn p-2 hover:bg-arri-gray rounded-lg transition-colors"
							on:click={closeModal}
							aria-label="Close modal"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>
			{/if}
			
			<!-- Body -->
			<div class="modal-body flex-1 overflow-y-auto">
				<slot />
			</div>
			
			<!-- Footer -->
			{#if $$slots.footer}
				<div class="modal-footer p-4 border-t border-arri-gray">
					<slot name="footer" />
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.touch-modal {
		/* Ensure modal is above everything */
		z-index: 9999;
	}
	
	.modal-overlay {
		/* Backdrop blur for modern browsers */
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}
	
	.modal-content {
		/* Optimize for animations */
		will-change: transform, opacity;
		
		/* Ensure proper touch handling */
		touch-action: manipulation;
		-webkit-overflow-scrolling: touch;
	}
	
	.modal-body {
		/* Ensure proper scrolling on mobile */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
	
	.modal-close-btn {
		/* Ensure proper touch target */
		min-width: 44px;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		
		/* Optimize for touch */
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	
	/* Animation classes */
	.touch-modal {
		animation: modalFadeIn 0.3s ease-out;
	}
	
	.modal-content {
		animation: modalSlideIn 0.3s ease-out;
	}
	
	@keyframes modalFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	
	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	
	/* Fullscreen adjustments */
	.touch-modal .modal-content {
		/* Handle safe areas in fullscreen */
		padding-top: max(0px, env(safe-area-inset-top));
		padding-bottom: max(0px, env(safe-area-inset-bottom));
		padding-left: max(0px, env(safe-area-inset-left));
		padding-right: max(0px, env(safe-area-inset-right));
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.modal-content {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.touch-modal,
		.modal-content {
			animation: none;
		}
		
		.modal-content {
			transition: none;
		}
	}
	
	/* Focus management */
	.modal-content:focus {
		outline: none;
	}
	
	.modal-close-btn:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
</style>