<script lang="ts">
	import { onMount } from 'svelte';
	import { screenInfo, getLayoutConfig, type ScreenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let variant: 'grid' | 'stack' | 'sidebar' | 'tabs' = 'grid';
	export let gap: 'none' | 'sm' | 'md' | 'lg' = 'md';
	export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
	export let maxWidth: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'none';
	export let center = false;
	export let animate = true;
	export let className = '';
	
	// Reactive screen info
	let currentScreenInfo: ScreenInfo;
	let layoutConfig: ReturnType<typeof getLayoutConfig>;
	
	$: if (currentScreenInfo) {
		layoutConfig = getLayoutConfig(currentScreenInfo);
	}
	
	// Subscribe to screen changes
	const unsubscribe = screenInfo.subscribe((info) => {
		currentScreenInfo = info;
	});
	
	onMount(() => {
		return unsubscribe;
	});
	
	// Compute responsive classes
	$: responsiveClasses = computeResponsiveClasses(variant, gap, padding, maxWidth, center, animate, layoutConfig);
	
	function computeResponsiveClasses(
		variant: string,
		gap: string,
		padding: string,
		maxWidth: string,
		center: boolean,
		animate: boolean,
		config?: ReturnType<typeof getLayoutConfig>
	): string {
		if (!config) return '';
		
		const classes = ['responsive-layout'];
		
		// Base layout classes
		if (variant === 'grid') {
			classes.push('grid');
			classes.push(`grid-cols-1 tablet:grid-cols-${config.columns}`);
		} else if (variant === 'stack') {
			classes.push('flex flex-col');
		} else if (variant === 'sidebar') {
			if (config.showSidebar) {
				classes.push('flex flex-row');
			} else {
				classes.push('flex flex-col');
			}
		} else if (variant === 'tabs') {
			classes.push('flex flex-col');
		}
		
		// Gap classes
		const gapMap = {
			none: 'gap-0',
			sm: 'gap-2 tablet:gap-3',
			md: 'gap-3 tablet:gap-4',
			lg: 'gap-4 tablet:gap-6'
		};
		classes.push(gapMap[gap]);
		
		// Padding classes
		const paddingMap = {
			none: 'p-0',
			sm: config.spacing.sm,
			md: config.spacing.md,
			lg: config.spacing.lg
		};
		classes.push(paddingMap[padding]);
		
		// Max width classes
		const maxWidthMap = {
			none: '',
			sm: 'max-w-sm',
			md: 'max-w-md',
			lg: 'max-w-lg',
			xl: 'max-w-xl',
			full: 'max-w-full'
		};
		if (maxWidthMap[maxWidth]) {
			classes.push(maxWidthMap[maxWidth]);
		}
		
		// Center classes
		if (center) {
			classes.push('mx-auto');
		}
		
		// Animation classes
		if (animate) {
			classes.push('transition-all duration-200 ease-in-out');
		}
		
		// Compact mode adjustments
		if (config.compactMode) {
			classes.push('compact-mode');
		}
		
		return classes.join(' ');
	}
</script>

<div class="{responsiveClasses} {className}" style="--columns: {layoutConfig?.columns || 1}">
	<slot {currentScreenInfo} {layoutConfig} />
</div>

<style>
	.responsive-layout {
		/* Ensure proper safe area handling */
		padding-left: max(var(--padding-left, 0), env(safe-area-inset-left));
		padding-right: max(var(--padding-right, 0), env(safe-area-inset-right));
	}
	
	.compact-mode {
		/* Tighter spacing in compact mode */
		--spacing-multiplier: 0.75;
	}
	
	/* Dynamic grid columns based on screen info */
	.responsive-layout.grid {
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
	}
	
	/* Smooth transitions for layout changes */
	@media (prefers-reduced-motion: no-preference) {
		.responsive-layout {
			transition: all 0.2s ease-in-out;
		}
	}
	
	/* Touch-friendly adjustments */
	@media (hover: none) and (pointer: coarse) {
		.responsive-layout {
			/* Increase touch targets */
			--min-touch-size: 44px;
		}
	}
</style>