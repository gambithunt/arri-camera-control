<script lang="ts">
	import { screenInfo, type ScreenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'lg';
	export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
	export let center = true;
	export let className = '';
	
	// Reactive screen info
	let currentScreenInfo: ScreenInfo;
	
	$: currentScreenInfo = $screenInfo;
	
	// Compute container classes based on screen size
	$: containerClasses = computeContainerClasses(size, padding, center, currentScreenInfo);
	
	function computeContainerClasses(
		size: string,
		padding: string,
		center: boolean,
		screenInfo: ScreenInfo
	): string {
		const classes = ['responsive-container'];
		
		// Size classes - responsive max widths
		const sizeMap = {
			sm: 'max-w-sm',
			md: 'max-w-md tablet:max-w-lg',
			lg: 'max-w-lg tablet:max-w-2xl',
			xl: 'max-w-xl tablet:max-w-4xl',
			full: 'max-w-full'
		};
		classes.push(sizeMap[size]);
		
		// Padding classes - responsive padding
		const paddingMap = {
			none: 'p-0',
			sm: 'p-3 tablet:p-4',
			md: 'p-4 tablet:p-6',
			lg: 'p-6 tablet:p-8'
		};
		classes.push(paddingMap[padding]);
		
		// Center the container
		if (center) {
			classes.push('mx-auto');
		}
		
		// Add safe area padding for mobile devices
		if (screenInfo.deviceType === 'phone') {
			classes.push('px-safe-left pr-safe-right');
		}
		
		// Full width on small screens
		classes.push('w-full');
		
		return classes.join(' ');
	}
</script>

<div class="{containerClasses} {className}">
	<slot {currentScreenInfo} />
</div>

<style>
	.responsive-container {
		/* Ensure container doesn't exceed viewport */
		min-width: 0;
		
		/* Handle safe areas */
		padding-left: max(var(--container-padding-x, 1rem), env(safe-area-inset-left));
		padding-right: max(var(--container-padding-x, 1rem), env(safe-area-inset-right));
	}
	
	/* Adjust container behavior in landscape mode */
	@media (orientation: landscape) and (max-width: 767px) {
		.responsive-container {
			padding-left: max(var(--container-padding-x, 0.75rem), env(safe-area-inset-left));
			padding-right: max(var(--container-padding-x, 0.75rem), env(safe-area-inset-right));
		}
	}
</style>