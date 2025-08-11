<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	
	interface NavItem {
		id: string;
		label: string;
		path: string;
		icon: string;
	}
	
	const navItems: NavItem[] = [
		{ id: 'camera', label: 'Camera', path: '/camera', icon: '📹' },
		{ id: 'playback', label: 'Playback', path: '/playback', icon: '▶️' },
		{ id: 'timecode', label: 'Timecode', path: '/timecode', icon: '🕐' },
		{ id: 'grading', label: 'Grading', path: '/grading', icon: '🎨' }
	];
	
	$: currentPath = $page.url.pathname;
	
	function isActive(path: string): boolean {
		return currentPath === path || (path !== '/' && currentPath.startsWith(path));
	}
	
	function handleNavigation(path: string) {
		goto(path);
	}
</script>

<nav class="bg-arri-gray border-t border-gray-600 px-4 py-2">
	<div class="flex justify-around items-center max-w-md mx-auto">
		{#each navItems as item}
			<button
				class="nav-item {isActive(item.path) ? 'active' : ''}"
				on:click={() => handleNavigation(item.path)}
				aria-label={item.label}
			>
				<span class="nav-icon text-xl" role="img" aria-hidden="true">
					{item.icon}
				</span>
				<span class="nav-label text-xs font-medium">
					{item.label}
				</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.nav-item {
		@apply flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-h-touch min-w-touch;
		@apply text-gray-400 hover:text-white hover:bg-gray-700;
	}
	
	.nav-item.active {
		@apply text-arri-red bg-gray-700;
	}
	
	.nav-icon {
		@apply mb-1;
	}
	
	.nav-label {
		@apply leading-none;
	}
</style>