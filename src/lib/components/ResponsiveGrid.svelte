<script lang="ts">
	import { screenInfo, getGridColumns, type ScreenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let minItemWidth = '200px'; // Minimum width for grid items
	export let gap: 'sm' | 'md' | 'lg' = 'md';
	export let autoFit = true; // Use auto-fit vs auto-fill
	export let equalHeight = false; // Make all items equal height
	export let className = '';
	
	// Reactive screen info
	let currentScreenInfo: ScreenInfo;
	
	$: currentScreenInfo = $screenInfo;
	
	// Compute grid classes and styles
	$: gridConfig = computeGridConfig(minItemWidth, gap, autoFit, equalHeight, currentScreenInfo);
	
	function computeGridConfig(
		minWidth: string,
		gap: string,
		autoFit: boolean,
		equalHeight: boolean,
		screenInfo: ScreenInfo
	) {
		const classes = ['responsive-grid'];
		
		// Gap classes
		const gapMap = {
			sm: 'gap-2 tablet:gap-3',
			md: 'gap-3 tablet:gap-4',
			lg: 'gap-4 tablet:gap-6'
		};
		classes.push(gapMap[gap]);
		
		// Equal height if requested
		if (equalHeight) {
			classes.push('items-stretch');
		}
		
		// Responsive behavior
		if (screenInfo.deviceType === 'phone' && screenInfo.orientation === 'portrait') {
			// Single column on phone portrait
			classes.push('grid-cols-1');
		} else {
			// Use CSS Grid auto-fit/auto-fill for larger screens
			classes.push('grid-auto-fit');
		}
		
		// Grid template style
		const gridType = autoFit ? 'auto-fit' : 'auto-fill';
		const gridTemplate = `repeat(${gridType}, minmax(${minWidth}, 1fr))`;
		
		return {
			classes: classes.join(' '),
			style: `--grid-template: ${gridTemplate}; --min-item-width: ${minWidth};`
		};
	}
</script>

<div 
	class="grid {gridConfig.classes} {className}" 
	style={gridConfig.style}
>
	<slot {currentScreenInfo} />
</div>

<style>
	.responsive-grid {
		/* Base grid setup */
		display: grid;
		width: 100%;
	}
	
	.grid-auto-fit {
		grid-template-columns: var(--grid-template);
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) and (orientation: portrait) {
		.grid-auto-fit {
			/* Override auto-fit on small portrait screens */
			grid-template-columns: 1fr;
		}
	}
	
	@media (max-width: 767px) and (orientation: landscape) {
		.grid-auto-fit {
			/* Two columns on phone landscape */
			grid-template-columns: repeat(2, 1fr);
		}
	}
	
	/* Ensure grid items don't overflow */
	.responsive-grid > :global(*) {
		min-width: 0;
		min-height: 0;
	}
	
	/* Equal height items */
	.items-stretch > :global(*) {
		height: 100%;
		display: flex;
		flex-direction: column;
	}
</style>