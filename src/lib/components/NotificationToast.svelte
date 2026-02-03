<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { notifications, dismissNotification, type Notification, type ErrorAction } from '$lib/utils/errorManager';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	import { triggerHaptic } from '$lib/utils/touchInteractions';
	
	// Component state
	let activeNotifications: Notification[] = [];
	let unsubscribe: (() => void) | null = null;
	
	// Reactive screen info
	$: currentScreenInfo = $screenInfo;
	$: isCompact = currentScreenInfo.deviceType === 'phone';
	
	// Notification icons
	const notificationIcons = {
		success: '✅',
		info: 'ℹ️',
		warning: '⚠️',
		error: '❌'
	};
	
	// Notification colors
	const notificationColors = {
		success: 'bg-green-600 border-green-500',
		info: 'bg-blue-600 border-blue-500',
		warning: 'bg-yellow-600 border-yellow-500',
		error: 'bg-red-600 border-red-500'
	};
	
	onMount(() => {
		// Subscribe to notifications
		unsubscribe = notifications.subscribe((notifs) => {
			activeNotifications = notifs;
		});
		
		// Refresh notifications
		notifications.refresh();
	});
	
	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});
	
	function handleDismiss(notification: Notification) {
		console.log('Dismissing notification:', notification.id);
		
		if (!notification.dismissible) {
			console.log('Notification is not dismissible');
			return;
		}
		
		// Trigger haptic feedback
		try {
			triggerHaptic({ type: 'light' });
		} catch (error) {
			console.warn('Haptic feedback failed:', error);
		}
		
		dismissNotification(notification.id);
	}
	
	function handleAction(action: ErrorAction, notification: Notification) {
		// Trigger haptic feedback
		triggerHaptic({ type: 'selection' });
		
		// Execute action handler
		if (action.handler) {
			try {
				const result = action.handler();
				if (result instanceof Promise) {
					result.catch(error => {
						console.error('Action handler failed:', error);
					});
				}
			} catch (error) {
				console.error('Action handler failed:', error);
			}
		}
		
		// Auto-dismiss after action unless it's a retry action
		if (action.type !== 'retry') {
			setTimeout(() => {
				dismissNotification(notification.id);
			}, 100);
		}
	}
	
	function getNotificationClasses(notification: Notification): string {
		const baseClasses = [
			'notification-toast',
			'relative',
			'rounded-lg',
			'shadow-lg',
			'border-l-4',
			'p-4',
			'mb-3',
			'transition-all',
			'duration-300',
			'animate-slide-up',
			'max-w-sm',
			'w-full'
		];
		
		// Add color classes
		baseClasses.push(notificationColors[notification.type]);
		
		// Add compact classes
		if (isCompact) {
			baseClasses.push('text-sm', 'p-3');
		}
		
		return baseClasses.join(' ');
	}
	
	function getContainerClasses(): string {
		const classes = [
			'notification-container',
			'fixed',
			'z-50',
			'pointer-events-none'
		];
		
		// Position classes - default to top-right
		classes.push('top-4', 'right-4');
		
		// Handle safe areas
		if (isCompact) {
			classes.push('left-4', 'right-4');
		}
		
		return classes.join(' ');
	}
	
	function formatDuration(duration: number): string {
		if (duration <= 0) return '';
		return `${Math.ceil(duration / 1000)}s`;
	}
</script>

{#if activeNotifications.length > 0}
	<div class={getContainerClasses()}>
		{#each activeNotifications as notification (notification.id)}
			<div 
				class={getNotificationClasses(notification)}
				role="alert"
				aria-live="polite"
				style="pointer-events: auto;"
			>
				<!-- Header -->
				<div class="notification-header flex items-start justify-between mb-2">
					<div class="flex items-center gap-2 flex-1 min-w-0">
						{#if notification.showIcon}
							<span class="notification-icon text-lg flex-shrink-0" role="img" aria-hidden="true">
								{notificationIcons[notification.type]}
							</span>
						{/if}
						
						<div class="notification-content flex-1 min-w-0">
							<h4 class="notification-title font-semibold text-white truncate">
								{notification.title}
							</h4>
						</div>
					</div>
					
					{#if notification.dismissible}
						<button
							class="dismiss-btn text-white hover:text-gray-200 transition-colors p-1 -m-1 flex-shrink-0 text-lg font-bold"
							on:click|stopPropagation={() => handleDismiss(notification)}
							aria-label="Dismiss notification"
							type="button"
						>
							×
						</button>
					{/if}
				</div>
				
				<!-- Message -->
				<div class="notification-message text-white text-opacity-90 mb-3 leading-relaxed">
					{notification.message}
				</div>
				
				<!-- Progress bar -->
				{#if notification.showProgress && notification.duration && notification.duration > 0}
					<div class="progress-container mb-3">
						<div class="progress-bar bg-white bg-opacity-20 rounded-full h-1 overflow-hidden">
							<div 
								class="progress-fill bg-white h-full transition-all duration-100 ease-linear"
								style="width: {notification.progress || 0}%"
							></div>
						</div>
						{#if notification.duration > 0}
							<div class="progress-text text-xs text-white text-opacity-70 mt-1 text-right">
								{formatDuration(notification.duration)}
							</div>
						{/if}
					</div>
				{/if}
				
				<!-- Actions -->
				{#if notification.actions && notification.actions.length > 0}
					<div class="notification-actions flex gap-2 flex-wrap">
						{#each notification.actions as action}
							<button
								class="action-btn {action.primary ? 'btn-primary' : 'btn-secondary'} text-xs px-3 py-1 rounded transition-colors min-h-touch"
								on:click={() => handleAction(action, notification)}
								aria-label={action.label}
							>
								{action.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.notification-container {
		/* Ensure notifications are above everything */
		z-index: 9999;
		
		/* Handle safe areas */
		padding-top: max(1rem, env(safe-area-inset-top));
		padding-right: max(1rem, env(safe-area-inset-right));
		padding-left: max(1rem, env(safe-area-inset-left));
	}
	
	.notification-toast {
		/* Optimize for animations */
		will-change: transform, opacity;
		
		/* Ensure proper touch handling */
		touch-action: manipulation;
		
		/* Backdrop blur for modern browsers */
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	
	.dismiss-btn {
		/* Ensure proper touch target */
		min-width: 32px;
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		border: none;
		background: transparent;
		cursor: pointer;
		
		/* Optimize for touch */
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		
		/* Ensure it's clickable */
		position: relative;
		z-index: 10;
	}
	
	.dismiss-btn:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}
	
	.dismiss-btn:active {
		background-color: rgba(255, 255, 255, 0.2);
		transform: scale(0.95);
	}
	
	.action-btn {
		/* Ensure proper touch targets */
		min-height: 32px;
		touch-action: manipulation;
		
		/* Button styles */
		font-weight: 500;
		border-radius: 6px;
		transition: all 0.2s ease;
	}
	
	.btn-primary {
		background-color: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}
	
	.btn-primary:hover {
		background-color: rgba(255, 255, 255, 0.3);
	}
	
	.btn-secondary {
		background-color: transparent;
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	
	.btn-secondary:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}
	
	/* Animation keyframes */
	@keyframes slideUp {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	
	.animate-slide-up {
		animation: slideUp 0.3s ease-out;
	}
	
	/* Progress bar animation */
	.progress-fill {
		animation: progressCountdown linear;
	}
	
	@keyframes progressCountdown {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) {
		.notification-container {
			padding-left: max(0.5rem, env(safe-area-inset-left));
			padding-right: max(0.5rem, env(safe-area-inset-right));
		}
		
		.notification-toast {
			max-width: none;
		}
		
		.notification-actions {
			flex-direction: column;
		}
		
		.action-btn {
			width: 100%;
			justify-content: center;
		}
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.notification-toast {
			border: 2px solid currentColor;
		}
		
		.action-btn {
			border-width: 2px;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.notification-toast {
			animation: none;
		}
		
		.progress-fill {
			animation: none;
		}
		
		.action-btn,
		.dismiss-btn {
			transition: none;
		}
	}
	
	/* Dark mode adjustments */
	@media (prefers-color-scheme: dark) {
		.notification-toast {
			/* Already using dark colors, no changes needed */
		}
	}
	
	/* Focus visible for keyboard navigation */
	.dismiss-btn:focus-visible,
	.action-btn:focus-visible {
		outline: 2px solid white;
		outline-offset: 2px;
	}
</style>