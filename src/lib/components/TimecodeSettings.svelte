<script lang="ts">
	import { cameraStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	import TimecodeSync from './TimecodeSync.svelte';
	
	// Props
	export let disabled = false;
	export let compact = false;
	export let showAdvanced = true;
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: currentTimecode = cameraState.currentTimecode || '00:00:00:00';
	$: timecodeMode = cameraState.timecodeMode || 'free_run';
	$: frameRate = cameraState.frameRate || 24;
	$: userBits = cameraState.userBits || '00:00:00:00';
	$: isLoading = cameraState.operations?.timecode || false;
	
	// Local state
	let manualTimecode = '';
	let manualUserBits = '';
	let showManualEntry = false;
	let showUserBitsEntry = false;
	let selectedPreset = 'none';
	
	// Timecode modes available on ARRI cameras
	const timecodeModes = [
		{
			id: 'free_run',
			label: 'Free Run',
			description: 'Timecode runs continuously regardless of recording',
			icon: '🔄'
		},
		{
			id: 'record_run',
			label: 'Record Run',
			description: 'Timecode only advances during recording',
			icon: '⏺️'
		},
		{
			id: 'external',
			label: 'External',
			description: 'Synchronized to external timecode source',
			icon: '🔗'
		},
		{
			id: 'time_of_day',
			label: 'Time of Day',
			description: 'Synchronized to current time of day',
			icon: '🕐'
		}
	];
	
	// Timecode presets for common scenarios
	const timecodePresets = [
		{
			id: 'none',
			label: 'No Preset',
			description: 'Manual configuration'
		},
		{
			id: 'production_start',
			label: 'Production Start',
			description: 'Set to 01:00:00:00 for production beginning',
			timecode: '01:00:00:00'
		},
		{
			id: 'scene_start',
			label: 'Scene Start',
			description: 'Set to scene-based timecode',
			timecode: '10:00:00:00'
		},
		{
			id: 'midnight',
			label: 'Midnight Reset',
			description: 'Reset to 00:00:00:00',
			timecode: '00:00:00:00'
		},
		{
			id: 'current_time',
			label: 'Current Time',
			description: 'Set to current time of day',
			timecode: 'current'
		}
	];
	
	// Frame rate options
	const frameRateOptions = [
		{ value: 23.98, label: '23.98 fps', description: 'Cinema standard' },
		{ value: 24, label: '24 fps', description: 'Film standard' },
		{ value: 25, label: '25 fps', description: 'PAL standard' },
		{ value: 29.97, label: '29.97 fps', description: 'NTSC standard' },
		{ value: 30, label: '30 fps', description: 'Progressive' },
		{ value: 50, label: '50 fps', description: 'PAL high frame rate' },
		{ value: 59.94, label: '59.94 fps', description: 'NTSC high frame rate' },
		{ value: 60, label: '60 fps', description: 'High frame rate' }
	];
	
	async function setTimecodeMode(mode: string) {
		if (disabled) return;
		
		cameraStore.setOperationLoading('timecode', true);
		
		try {
			const result = await cameraApi.setTimecodeMode(mode);
			if (result.success) {
				cameraStore.updateSettings({ timecodeMode: mode });
				notificationStore.success('Timecode Mode', `Switched to ${getModeLabel(mode)}`);
			} else {
				notificationStore.error('Mode Change Failed', result.error || 'Failed to change timecode mode');
			}
		} catch (error) {
			notificationStore.error('Mode Change Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('timecode', false);
		}
	}
	
	async function syncToTimeOfDay() {
		if (disabled) return;
		
		cameraStore.setOperationLoading('timecode', true);
		
		try {
			const result = await cameraApi.syncTimecodeToTimeOfDay();
			if (result.success) {
				notificationStore.success('Timecode Synced', 'Synchronized to current time of day');
				// The timecode will be updated through the normal update cycle
			} else {
				notificationStore.error('Sync Failed', result.error || 'Failed to sync timecode');
			}
		} catch (error) {
			notificationStore.error('Sync Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('timecode', false);
		}
	}
	
	async function setManualTimecode() {
		if (!validateTimecode(manualTimecode)) {
			notificationStore.warning('Invalid Format', 'Please use HH:MM:SS:FF format (e.g., 01:23:45:12)');
			return;
		}
		
		if (disabled) return;
		
		cameraStore.setOperationLoading('timecode', true);
		
		try {
			const result = await cameraApi.setTimecode(manualTimecode);
			if (result.success) {
				cameraStore.updateSettings({ currentTimecode: manualTimecode });
				showManualEntry = false;
				manualTimecode = '';
				notificationStore.success('Timecode Set', `Set to ${manualTimecode}`);
			} else {
				notificationStore.error('Set Failed', result.error || 'Failed to set timecode');
			}
		} catch (error) {
			notificationStore.error('Set Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('timecode', false);
		}
	}
	
	async function setUserBits() {
		if (!validateTimecode(manualUserBits)) {
			notificationStore.warning('Invalid Format', 'Please use HH:MM:SS:FF format for user bits');
			return;
		}
		
		if (disabled) return;
		
		cameraStore.setOperationLoading('timecode', true);
		
		try {
			const result = await cameraApi.setUserBits(manualUserBits);
			if (result.success) {
				cameraStore.updateSettings({ userBits: manualUserBits });
				showUserBitsEntry = false;
				manualUserBits = '';
				notificationStore.success('User Bits Set', `Set to ${manualUserBits}`);
			} else {
				notificationStore.error('Set Failed', result.error || 'Failed to set user bits');
			}
		} catch (error) {
			notificationStore.error('Set Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('timecode', false);
		}
	}
	
	async function applyPreset(presetId: string) {
		const preset = timecodePresets.find(p => p.id === presetId);
		if (!preset || preset.id === 'none') return;
		
		if (preset.timecode === 'current') {
			await syncToTimeOfDay();
		} else if (preset.timecode) {
			manualTimecode = preset.timecode;
			await setManualTimecode();
		}
		
		selectedPreset = 'none';
	}
	
	async function setFrameRate(fps: number) {
		if (disabled) return;
		
		cameraStore.setOperationLoading('timecode', true);
		
		try {
			const result = await cameraApi.setFrameRate(fps);
			if (result.success) {
				cameraStore.updateSettings({ frameRate: fps });
				notificationStore.success('Frame Rate', `Set to ${fps} fps`);
			} else {
				notificationStore.error('Frame Rate Failed', result.error || 'Failed to set frame rate');
			}
		} catch (error) {
			notificationStore.error('Frame Rate Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('timecode', false);
		}
	}
	
	function validateTimecode(tc: string): boolean {
		const tcRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]):([0-2][0-9]|3[0-1])$/;
		return tcRegex.test(tc);
	}
	
	function getModeLabel(mode: string): string {
		const modeInfo = timecodeModes.find(m => m.id === mode);
		return modeInfo?.label || mode;
	}
	
	function getCurrentTimeAsTimecode(): string {
		const now = new Date();
		const hours = now.getHours().toString().padStart(2, '0');
		const minutes = now.getMinutes().toString().padStart(2, '0');
		const seconds = now.getSeconds().toString().padStart(2, '0');
		const frames = Math.floor((now.getMilliseconds() / 1000) * frameRate).toString().padStart(2, '0');
		return `${hours}:${minutes}:${seconds}:${frames}`;
	}
	
	function formatTimecodeInput(event: Event) {
		const input = event.target as HTMLInputElement;
		let value = input.value.replace(/[^\d]/g, '');
		
		// Auto-format as user types
		if (value.length >= 2) {
			value = value.substring(0, 2) + ':' + value.substring(2);
		}
		if (value.length >= 5) {
			value = value.substring(0, 5) + ':' + value.substring(5);
		}
		if (value.length >= 8) {
			value = value.substring(0, 8) + ':' + value.substring(8);
		}
		if (value.length > 11) {
			value = value.substring(0, 11);
		}
		
		input.value = value;
		if (input === document.activeElement) {
			manualTimecode = value;
		} else {
			manualUserBits = value;
		}
	}
</script>

<div class="timecode-settings {compact ? 'compact' : ''}">
	<!-- Timecode Mode Selection -->
	<div class="settings-section">
		<h3 class="section-title">Timecode Mode</h3>
		<div class="mode-grid">
			{#each timecodeModes as mode}
				<button
					class="mode-button {timecodeMode === mode.id ? 'active' : ''}"
					on:click={() => setTimecodeMode(mode.id)}
					disabled={disabled || isLoading}
					aria-label="Set timecode mode to {mode.label}"
				>
					<div class="mode-icon">{mode.icon}</div>
					<div class="mode-info">
						<div class="mode-label">{mode.label}</div>
						{#if !compact}
							<div class="mode-description">{mode.description}</div>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>
	
	<!-- Sync Status -->
	{#if showAdvanced}
		<div class="settings-section">
			<h3 class="section-title">Sync Status</h3>
			<TimecodeSync compact={compact} showDiagnostics={true} />
		</div>
	{/if}
	
	<!-- Quick Actions -->
	<div class="settings-section">
		<h3 class="section-title">Quick Actions</h3>
		<div class="action-buttons">
			<button 
				class="action-button"
				on:click={syncToTimeOfDay}
				disabled={disabled || isLoading}
			>
				<span class="action-icon">🕐</span>
				<div class="action-text">
					<div class="action-label">Sync to Time of Day</div>
					<div class="action-description">Set to current time: {getCurrentTimeAsTimecode()}</div>
				</div>
			</button>
			
			<button 
				class="action-button"
				on:click={() => showManualEntry = true}
				disabled={disabled || isLoading}
			>
				<span class="action-icon">✏️</span>
				<div class="action-text">
					<div class="action-label">Manual Entry</div>
					<div class="action-description">Set custom timecode value</div>
				</div>
			</button>
			
			{#if showAdvanced}
				<button 
					class="action-button"
					on:click={() => showUserBitsEntry = true}
					disabled={disabled || isLoading}
				>
					<span class="action-icon">🔢</span>
					<div class="action-text">
						<div class="action-label">User Bits</div>
						<div class="action-description">Set user bits: {userBits}</div>
					</div>
				</button>
			{/if}
		</div>
	</div>
	
	<!-- Presets -->
	<div class="settings-section">
		<h3 class="section-title">Timecode Presets</h3>
		<div class="preset-container">
			<select 
				class="preset-select"
				bind:value={selectedPreset}
				on:change={() => applyPreset(selectedPreset)}
				disabled={disabled || isLoading}
			>
				{#each timecodePresets as preset}
					<option value={preset.id}>{preset.label}</option>
				{/each}
			</select>
			<div class="preset-description">
				{timecodePresets.find(p => p.id === selectedPreset)?.description || 'Select a preset to apply'}
			</div>
		</div>
	</div>
	
	<!-- Frame Rate Settings -->
	{#if showAdvanced}
		<div class="settings-section">
			<h3 class="section-title">Frame Rate</h3>
			<div class="frame-rate-grid">
				{#each frameRateOptions as fps}
					<button
						class="frame-rate-button {frameRate === fps.value ? 'active' : ''}"
						on:click={() => setFrameRate(fps.value)}
						disabled={disabled || isLoading}
						title={fps.description}
					>
						{fps.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}
	
	<!-- Manual Timecode Entry Modal -->
	{#if showManualEntry}
		<div class="modal-overlay" on:click={() => showManualEntry = false}>
			<div class="modal-content" on:click|stopPropagation>
				<h3 class="modal-title">Set Manual Timecode</h3>
				<div class="manual-entry">
					<input 
						type="text" 
						class="timecode-input"
						placeholder="HH:MM:SS:FF"
						bind:value={manualTimecode}
						on:input={formatTimecodeInput}
						maxlength="11"
						pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}:[0-9]{2}"
						autofocus
					/>
					<div class="input-help">
						Format: Hours:Minutes:Seconds:Frames (e.g., 01:23:45:12)
					</div>
					<div class="current-time-hint">
						Current time: {getCurrentTimeAsTimecode()}
					</div>
				</div>
				<div class="modal-actions">
					<button 
						class="btn-secondary" 
						on:click={() => {
							showManualEntry = false;
							manualTimecode = '';
						}}
					>
						Cancel
					</button>
					<button 
						class="btn-primary" 
						on:click={setManualTimecode}
						disabled={!validateTimecode(manualTimecode) || isLoading}
					>
						{#if isLoading}
							Setting...
						{:else}
							Set Timecode
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- User Bits Entry Modal -->
	{#if showUserBitsEntry}
		<div class="modal-overlay" on:click={() => showUserBitsEntry = false}>
			<div class="modal-content" on:click|stopPropagation>
				<h3 class="modal-title">Set User Bits</h3>
				<div class="manual-entry">
					<input 
						type="text" 
						class="timecode-input"
						placeholder="HH:MM:SS:FF"
						bind:value={manualUserBits}
						on:input={formatTimecodeInput}
						maxlength="11"
						pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}:[0-9]{2}"
						autofocus
					/>
					<div class="input-help">
						Format: Same as timecode (HH:MM:SS:FF) but for user data
					</div>
					<div class="current-ub-hint">
						Current user bits: {userBits}
					</div>
				</div>
				<div class="modal-actions">
					<button 
						class="btn-secondary" 
						on:click={() => {
							showUserBitsEntry = false;
							manualUserBits = '';
						}}
					>
						Cancel
					</button>
					<button 
						class="btn-primary" 
						on:click={setUserBits}
						disabled={!validateTimecode(manualUserBits) || isLoading}
					>
						{#if isLoading}
							Setting...
						{:else}
							Set User Bits
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.timecode-settings {
		@apply space-y-6;
	}
	
	.timecode-settings.compact {
		@apply space-y-4;
	}
	
	.settings-section {
		@apply space-y-3;
	}
	
	.section-title {
		@apply text-sm font-medium text-gray-300 uppercase tracking-wide;
	}
	
	.mode-grid {
		@apply grid grid-cols-1 gap-3;
	}
	
	.mode-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4 transition-all duration-200;
		@apply flex items-center gap-4 min-h-touch;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.mode-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.mode-icon {
		@apply text-2xl flex-shrink-0;
	}
	
	.mode-info {
		@apply flex-1 text-left;
	}
	
	.mode-label {
		@apply font-medium;
	}
	
	.mode-description {
		@apply text-sm text-gray-300 mt-1;
	}
	
	.action-buttons {
		@apply space-y-3;
	}
	
	.action-button {
		@apply w-full bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4;
		@apply flex items-center gap-4 min-h-touch transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.action-icon {
		@apply text-xl flex-shrink-0;
	}
	
	.action-text {
		@apply flex-1 text-left;
	}
	
	.action-label {
		@apply font-medium;
	}
	
	.action-description {
		@apply text-sm text-gray-300 mt-1;
	}
	
	.preset-container {
		@apply space-y-2;
	}
	
	.preset-select {
		@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3;
		@apply text-white focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50;
	}
	
	.preset-description {
		@apply text-sm text-gray-400;
	}
	
	.frame-rate-grid {
		@apply grid grid-cols-2 gap-2;
	}
	
	.frame-rate-button {
		@apply bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 px-3;
		@apply text-sm font-medium transition-colors min-h-touch;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.frame-rate-button.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.modal-overlay {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
	}
	
	.modal-content {
		@apply bg-arri-gray rounded-lg p-6 w-full max-w-sm space-y-4;
	}
	
	.modal-title {
		@apply text-lg font-medium text-center;
	}
	
	.manual-entry {
		@apply space-y-3;
	}
	
	.timecode-input {
		@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3;
		@apply text-white text-center text-lg font-mono;
		@apply focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red;
	}
	
	.input-help {
		@apply text-xs text-gray-400 text-center;
	}
	
	.current-time-hint, .current-ub-hint {
		@apply text-xs text-blue-400 text-center font-mono;
	}
	
	.modal-actions {
		@apply flex gap-3;
	}
	
	.btn-secondary, .btn-primary {
		@apply flex-1 py-2 px-4 rounded-lg font-medium transition-colors min-h-touch;
	}
	
	.btn-secondary {
		@apply bg-gray-600 hover:bg-gray-500 text-white;
	}
	
	.btn-primary {
		@apply bg-arri-red hover:bg-red-600 text-white;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.mode-grid {
			@apply gap-2;
		}
		
		.mode-button {
			@apply p-3;
		}
		
		.mode-icon {
			@apply text-xl;
		}
		
		.frame-rate-grid {
			@apply grid-cols-2 gap-1;
		}
		
		.frame-rate-button {
			@apply text-xs px-2 py-2;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.mode-button {
			@apply border-white;
		}
		
		.mode-button.active {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.mode-button, .action-button, .frame-rate-button {
			@apply transition-none;
		}
	}
</style>"