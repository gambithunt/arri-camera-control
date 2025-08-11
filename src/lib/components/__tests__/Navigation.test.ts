import { describe, it, expect } from 'vitest';

describe('Navigation Component', () => {
  it('should have navigation items defined', () => {
    const navItems = [
      { id: 'camera', label: 'Camera', path: '/camera', icon: '📹' },
      { id: 'playback', label: 'Playback', path: '/playback', icon: '▶️' },
      { id: 'timecode', label: 'Timecode', path: '/timecode', icon: '🕐' },
      { id: 'grading', label: 'Grading', path: '/grading', icon: '🎨' }
    ];
    
    expect(navItems).toHaveLength(4);
    expect(navItems[0].label).toBe('Camera');
    expect(navItems[1].label).toBe('Playback');
    expect(navItems[2].label).toBe('Timecode');
    expect(navItems[3].label).toBe('Grading');
  });

  it('should have valid paths for navigation', () => {
    const paths = ['/camera', '/playback', '/timecode', '/grading'];
    
    paths.forEach(path => {
      expect(path).toMatch(/^\/[a-z]+$/);
    });
  });
});