<script lang="ts">
	import { page } from '$app/stores';
	
	export let title: string = 'ARRI Camera Control';
	export let showBackButton: boolean = false;
	
	$: currentPath = $page.url.pathname;
	$: pageTitle = getPageTitle(currentPath);
	
	function getPageTitle(path: string): string {
		switch (path) {
			case '/camera':
				return 'Camera Settings';
			case '/playback':
				return 'Playback Control';
			case '/timecode':
				return 'Timecode Management';
			case '/grading':
				return 'Color Grading';
			case '/settings':
				return 'Settings';
			case '/diagnostics':
				return 'Diagnostics';
			case '/offline':
				return 'Offline Mode';
			default:
				return title;
		}
	}
	
	import { goto } from '$app/navigation';
	
	function handleBack() {
		history.back();
	}
	
	function goHome() {
		goto('/');
	}
</script>

<header class="header">
	<div class="flex items-center justify-between">
		<button class="home-button" on:click={goHome} aria-label="Go to home">
			<span class="text-xl">🏠</span>
		</button>
		
		<h1 class="header-title">
			{pageTitle}
		</h1>
		
		{#if showBackButton}
			<button class="back-button" on:click={handleBack} aria-label="Go back">
				<span class="text-xl">←</span>
			</button>
		{:else}
			<div class="w-10"></div> <!-- Spacer for centering -->
		{/if}
	</div>
</header>

<style>
	.header {
		@apply bg-arri-dark border-b border-gray-700 px-4 py-3 sticky top-0 z-10;
	}
	
	.header-title {
		@apply text-lg font-semibold text-center flex-1;
	}
	
	.back-button,
	.home-button {
		@apply w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors;
		@apply text-gray-400 hover:text-white min-h-touch;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red focus:ring-opacity-50;
		@apply active:scale-95 transition-transform;
	}
</style>