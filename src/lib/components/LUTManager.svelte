<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { lutStorage, type LUTInfo } from '$lib/utils/lutStorage';
	import { cameraStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Props
	export let disabled = false;
	export let compact = false;
	export let showPreview = true;
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		lutSelected: { lutId: string; lutInfo: LUTInfo };
		lutDeleted: { lutId: string };
		lutImported: { lutId: string; lutInfo: LUTInfo };
	}>();
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: isLoading = cameraState.operations?.grading || false;
	$: currentLUT = cameraState.currentLUT || 'neutral';
	
	// Component state
	let luts: LUTInfo[] = [];
	let categories: Array<{ id: string; label: string; count: number }> = [];
	let selectedCategory = 'all';
	let searchQuery = '';
	let filteredLUTs: LUTInfo[] = [];
	let storageInfo = { used: 0, total: 0, percentage: 0 };
	
	// UI state
	let showImportDialog = false;
	let showDeleteConfirm = false;
	let showLUTDetails = false;
	let selectedLUT: LUTInfo | null = null;
	let lutToDelete: LUTInfo | null = null;
	let dragOver = false;
	
	// Import state
	let importFiles: FileList | null = null;
	let importProgress = 0;
	let isImporting = false;
	
	onMount(async () => {
		await loadLUTs();
		await loadCategories();
		await loadStorageInfo();
	});
	
	async function loadLUTs() {
		try {
			luts = await lutStorage.getAllLUTs();
			await filterLUTs();
		} catch (error) {
			console.error('Error loading LUTs:', error);
			notificationStore.error('Load Failed', 'Failed to load LUT library');
		}
	}
	
	async function loadCategories() {
		try {
			categories = await lutStorage.getCategories();
		} catch (error) {
			console.error('Error loading categories:', error);
		}
	}
	
	async function loadStorageInfo() {
		try {
			storageInfo = await lutStorage.getStorageInfo();
		} catch (error) {
			console.error('Error loading storage info:', error);
		}
	}
	
	async function filterLUTs() {
		try {
			filteredLUTs = await lutStorage.searchLUTs(searchQuery, selectedCategory);
		} catch (error) {
			console.error('Error filtering LUTs:', error);
			filteredLUTs = luts;
		}
	}
	
	async function selectLUT(lut: LUTInfo) {
		if (disabled || isLoading) return;
		
		cameraStore.setOperationLoading('grading', true);
		
		try {
			const result = await cameraApi.loadLUT(lut.id);
			if (result.success) {
				cameraStore.updateSettings({ currentLUT: lut.id });
				dispatch('lutSelected', { lutId: lut.id, lutInfo: lut });
				notificationStore.success('LUT Applied', `Applied ${lut.name}`);
			} else {
				notificationStore.error('LUT Load Failed', result.error || 'Failed to apply LUT');
			}
		} catch (error) {
			notificationStore.error('LUT Load Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('grading', false);
		}
	}	
	
async function deleteLUT(lut: LUTInfo) {
		if (lut.category === 'camera') {
			notificationStore.warning('Cannot Delete', 'Built-in LUTs cannot be deleted');
			return;
		}
		
		lutToDelete = lut;
		showDeleteConfirm = true;
	}
	
	async function confirmDelete() {
		if (!lutToDelete) return;
		
		try {
			await lutStorage.deleteLUT(lutToDelete.id);
			dispatch('lutDeleted', { lutId: lutToDelete.id });
			notificationStore.success('LUT Deleted', `Deleted ${lutToDelete.name}`);
			
			// Reload data
			await loadLUTs();
			await loadCategories();
			await loadStorageInfo();
		} catch (error) {
			notificationStore.error('Delete Failed', error instanceof Error ? error.message : 'Failed to delete LUT');
		} finally {
			showDeleteConfirm = false;
			lutToDelete = null;
		}
	}
	
	async function importLUTs() {
		if (!importFiles || importFiles.length === 0) return;
		
		isImporting = true;
		importProgress = 0;
		
		try {
			const totalFiles = importFiles.length;
			let successCount = 0;
			
			for (let i = 0; i < totalFiles; i++) {
				const file = importFiles[i];
				
				try {
					const lutId = await lutStorage.importLUTFromFile(file);
					const lutInfo = (await lutStorage.getAllLUTs()).find(l => l.id === lutId);
					
					if (lutInfo) {
						dispatch('lutImported', { lutId, lutInfo });
						successCount++;
					}
				} catch (error) {
					console.error(`Error importing ${file.name}:`, error);
					notificationStore.error('Import Failed', `Failed to import ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
				
				importProgress = ((i + 1) / totalFiles) * 100;
			}
			
			if (successCount > 0) {
				notificationStore.success('Import Complete', `Successfully imported ${successCount} of ${totalFiles} LUTs`);
				
				// Reload data
				await loadLUTs();
				await loadCategories();
				await loadStorageInfo();
			}
		} catch (error) {
			notificationStore.error('Import Failed', error instanceof Error ? error.message : 'Import process failed');
		} finally {
			isImporting = false;
			showImportDialog = false;
			importFiles = null;
			importProgress = 0;
		}
	}
	
	async function exportLUT(lut: LUTInfo) {
		try {
			await lutStorage.exportLUT(lut.id);
			notificationStore.success('Export Complete', `Exported ${lut.name}`);
		} catch (error) {
			notificationStore.error('Export Failed', error instanceof Error ? error.message : 'Failed to export LUT');
		}
	}
	
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}
	
	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}
	
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			importFiles = files;
			showImportDialog = true;
		}
	}
	
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
	
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'camera': return '📷';
			case 'creative': return '🎨';
			case 'technical': return '⚙️';
			case 'custom': return '👤';
			default: return '📁';
		}
	}
	
	// Reactive updates
	$: if (searchQuery || selectedCategory) {
		filterLUTs();
	}
</script><d
iv 
	class="lut-manager" 
	class:compact 
	class:disabled
	class:drag-over={dragOver}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
>
	<!-- Header -->
	<div class="manager-header">
		<div class="header-info">
			<h2 class="manager-title">LUT Library</h2>
			<p class="manager-description">Manage and apply Look-Up Tables</p>
		</div>
		
		<div class="header-actions">
			<button 
				class="btn-import"
				on:click={() => showImportDialog = true}
				disabled={disabled}
				title="Import LUT files"
			>
				📁 Import
			</button>
		</div>
	</div>
	
	<!-- Storage Info -->
	{#if !compact}
		<div class="storage-info">
			<div class="storage-bar">
				<div class="storage-fill" style="width: {storageInfo.percentage}%"></div>
			</div>
			<div class="storage-text">
				{formatFileSize(storageInfo.used)} / {formatFileSize(storageInfo.total)} used ({storageInfo.percentage}%)
			</div>
		</div>
	{/if}
	
	<!-- Search and Filter -->
	<div class="search-filter">
		<div class="search-box">
			<input 
				type="text" 
				class="search-input"
				placeholder="Search LUTs..."
				bind:value={searchQuery}
				disabled={disabled}
			/>
			<span class="search-icon">🔍</span>
		</div>
		
		<div class="category-filter">
			{#each categories as category}
				<button 
					class="category-btn {selectedCategory === category.id ? 'active' : ''}"
					on:click={() => selectedCategory = category.id}
					disabled={disabled}
					title={category.label}
				>
					{getCategoryIcon(category.id)}
					{#if !compact}
						<span class="category-label">{category.label}</span>
					{/if}
					<span class="category-count">{category.count}</span>
				</button>
			{/each}
		</div>
	</div>
	
	<!-- LUT Grid -->
	<div class="lut-grid">
		{#each filteredLUTs as lut (lut.id)}
			<div class="lut-card {currentLUT === lut.id ? 'active' : ''}">
				<!-- LUT Thumbnail -->
				<div class="lut-thumbnail">
					{#if lut.thumbnail}
						<img src={lut.thumbnail} alt={lut.name} class="thumbnail-image" />
					{:else}
						<div class="thumbnail-placeholder">
							{getCategoryIcon(lut.category)}
						</div>
					{/if}
					
					{#if currentLUT === lut.id}
						<div class="active-indicator">✓</div>
					{/if}
				</div>
				
				<!-- LUT Info -->
				<div class="lut-info">
					<h3 class="lut-name">{lut.name}</h3>
					{#if !compact && lut.description}
						<p class="lut-description">{lut.description}</p>
					{/if}
					<div class="lut-meta">
						<span class="lut-format">{lut.format.toUpperCase()}</span>
						<span class="lut-size">{formatFileSize(lut.size)}</span>
					</div>
				</div>
				
				<!-- LUT Actions -->
				<div class="lut-actions">
					<button 
						class="btn-apply"
						on:click={() => selectLUT(lut)}
						disabled={disabled || isLoading || currentLUT === lut.id}
						title="Apply this LUT"
					>
						{#if isLoading && currentLUT === lut.id}
							<div class="loading-spinner"></div>
						{:else if currentLUT === lut.id}
							✓
						{:else}
							Apply
						{/if}
					</button>
					
					<div class="action-menu">
						<button 
							class="btn-menu"
							on:click={() => { selectedLUT = lut; showLUTDetails = true; }}
							disabled={disabled}
							title="LUT details"
						>
							⋯
						</button>
					</div>
				</div>
			</div>
		{/each}
		
		{#if filteredLUTs.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📁</div>
				<h3 class="empty-title">No LUTs Found</h3>
				<p class="empty-description">
					{#if searchQuery}
						No LUTs match your search criteria.
					{:else}
						Import LUT files to get started.
					{/if}
				</p>
				{#if !searchQuery}
					<button 
						class="btn-import-empty"
						on:click={() => showImportDialog = true}
						disabled={disabled}
					>
						Import LUTs
					</button>
				{/if}
			</div>
		{/if}
	</div>
	
	<!-- Drag Drop Overlay -->
	{#if dragOver}
		<div class="drag-overlay">
			<div class="drag-content">
				<div class="drag-icon">📁</div>
				<h3 class="drag-title">Drop LUT Files Here</h3>
				<p class="drag-description">Supports .cube, .3dl, and .csp formats</p>
			</div>
		</div>
	{/if}
</div>