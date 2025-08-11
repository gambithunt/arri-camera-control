import { describe, it, expect } from 'vitest';

// Basic utility functions for testing
export function formatTimecode(frames: number, fps: number = 24): string {
	const totalSeconds = Math.floor(frames / fps);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const remainingFrames = frames % fps;
	
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`;
}

describe('Utility Functions', () => {
	it('should format timecode correctly', () => {
		expect(formatTimecode(0, 24)).toBe('00:00:00:00');
		expect(formatTimecode(24, 24)).toBe('00:00:01:00');
		expect(formatTimecode(1440, 24)).toBe('00:01:00:00'); // 60 seconds * 24 fps
	});
});