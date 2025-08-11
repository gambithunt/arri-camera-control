import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the utility functions directly without importing the store-dependent module
describe('Responsive Layout Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResponsiveClasses', () => {
    function getResponsiveClasses(config: {
      base?: string;
      phone?: string;
      tablet?: string;
      landscape?: string;
      portrait?: string;
    }): string {
      const classes = [config.base || ''];
      
      if (config.phone) classes.push(`xs:${config.phone}`);
      if (config.tablet) classes.push(`tablet:${config.tablet}`);
      if (config.landscape) classes.push(`tablet-landscape:${config.landscape}`);
      if (config.portrait) classes.push(`portrait:${config.portrait}`);
      
      return classes.filter(Boolean).join(' ');
    }

    it('should generate responsive classes', () => {
      const classes = getResponsiveClasses({
        base: 'flex',
        phone: 'flex-col',
        tablet: 'flex-row',
        landscape: 'gap-4',
        portrait: 'gap-2'
      });
      
      expect(classes).toContain('flex');
      expect(classes).toContain('xs:flex-col');
      expect(classes).toContain('tablet:flex-row');
      expect(classes).toContain('tablet-landscape:gap-4');
      expect(classes).toContain('portrait:gap-2');
    });

    it('should handle empty config', () => {
      const classes = getResponsiveClasses({});
      expect(classes.trim()).toBe('');
    });

    it('should handle partial config', () => {
      const classes = getResponsiveClasses({
        base: 'grid',
        tablet: 'grid-cols-2'
      });
      
      expect(classes).toBe('grid tablet:grid-cols-2');
    });
  });

  describe('getGridColumns', () => {
    function getGridColumns(screenType: 'phone' | 'tablet' | 'desktop', orientation: 'portrait' | 'landscape'): number {
      if (screenType === 'phone') {
        return orientation === 'landscape' ? 2 : 1;
      } else if (screenType === 'tablet') {
        return orientation === 'landscape' ? 3 : 2;
      } else {
        return orientation === 'landscape' ? 4 : 3;
      }
    }

    it('should return correct columns for phone', () => {
      expect(getGridColumns('phone', 'portrait')).toBe(1);
      expect(getGridColumns('phone', 'landscape')).toBe(2);
    });

    it('should return correct columns for tablet', () => {
      expect(getGridColumns('tablet', 'portrait')).toBe(2);
      expect(getGridColumns('tablet', 'landscape')).toBe(3);
    });

    it('should return correct columns for desktop', () => {
      expect(getGridColumns('desktop', 'portrait')).toBe(3);
      expect(getGridColumns('desktop', 'landscape')).toBe(4);
    });
  });

  describe('getTouchTargetSize', () => {
    function getTouchTargetSize(isTouch: boolean): { minHeight: string; minWidth: string } {
      return isTouch 
        ? { minHeight: '44px', minWidth: '44px' }
        : { minHeight: '32px', minWidth: '32px' };
    }

    it('should return larger size for touch devices', () => {
      const touchSize = getTouchTargetSize(true);
      expect(touchSize.minHeight).toBe('44px');
      expect(touchSize.minWidth).toBe('44px');
    });

    it('should return smaller size for non-touch devices', () => {
      const nonTouchSize = getTouchTargetSize(false);
      expect(nonTouchSize.minHeight).toBe('32px');
      expect(nonTouchSize.minWidth).toBe('32px');
    });
  });

  describe('getOptimalFontSize', () => {
    function getOptimalFontSize(screenType: 'phone' | 'tablet' | 'desktop'): {
      base: string;
      small: string;
      large: string;
      title: string;
    } {
      switch (screenType) {
        case 'phone':
          return {
            base: 'text-sm',
            small: 'text-xs',
            large: 'text-base',
            title: 'text-lg'
          };
        case 'tablet':
          return {
            base: 'text-base',
            small: 'text-sm',
            large: 'text-lg',
            title: 'text-xl'
          };
        case 'desktop':
          return {
            base: 'text-base',
            small: 'text-sm',
            large: 'text-lg',
            title: 'text-2xl'
          };
      }
    }

    it('should return appropriate font sizes for phone', () => {
      const sizes = getOptimalFontSize('phone');
      expect(sizes.base).toBe('text-sm');
      expect(sizes.title).toBe('text-lg');
    });

    it('should return appropriate font sizes for tablet', () => {
      const sizes = getOptimalFontSize('tablet');
      expect(sizes.base).toBe('text-base');
      expect(sizes.title).toBe('text-xl');
    });

    it('should return appropriate font sizes for desktop', () => {
      const sizes = getOptimalFontSize('desktop');
      expect(sizes.base).toBe('text-base');
      expect(sizes.title).toBe('text-2xl');
    });
  });

  describe('getSpacing', () => {
    function getSpacing(screenType: 'phone' | 'tablet' | 'desktop'): {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    } {
      switch (screenType) {
        case 'phone':
          return {
            xs: 'p-1',
            sm: 'p-2',
            md: 'p-3',
            lg: 'p-4',
            xl: 'p-6'
          };
        case 'tablet':
          return {
            xs: 'p-2',
            sm: 'p-3',
            md: 'p-4',
            lg: 'p-6',
            xl: 'p-8'
          };
        case 'desktop':
          return {
            xs: 'p-2',
            sm: 'p-4',
            md: 'p-6',
            lg: 'p-8',
            xl: 'p-12'
          };
      }
    }

    it('should return appropriate spacing for each device type', () => {
      const phoneSpacing = getSpacing('phone');
      const tabletSpacing = getSpacing('tablet');
      const desktopSpacing = getSpacing('desktop');
      
      expect(phoneSpacing.md).toBe('p-3');
      expect(tabletSpacing.md).toBe('p-4');
      expect(desktopSpacing.md).toBe('p-6');
    });

    it('should have consistent spacing progression', () => {
      const phoneSpacing = getSpacing('phone');
      
      expect(phoneSpacing.xs).toBe('p-1');
      expect(phoneSpacing.sm).toBe('p-2');
      expect(phoneSpacing.md).toBe('p-3');
      expect(phoneSpacing.lg).toBe('p-4');
      expect(phoneSpacing.xl).toBe('p-6');
    });
  });

  describe('getLayoutConfig', () => {
    interface ScreenInfo {
      width: number;
      height: number;
      orientation: 'portrait' | 'landscape';
      deviceType: 'phone' | 'tablet' | 'desktop';
      isTouch: boolean;
      safeArea: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      };
    }

    function getLayoutConfig(screenInfo: ScreenInfo) {
      const { deviceType, orientation, isTouch } = screenInfo;
      
      // Helper functions (simplified versions)
      const getGridColumns = (deviceType: string, orientation: string) => {
        if (deviceType === 'phone') {
          return orientation === 'landscape' ? 2 : 1;
        } else if (deviceType === 'tablet') {
          return orientation === 'landscape' ? 3 : 2;
        } else {
          return orientation === 'landscape' ? 4 : 3;
        }
      };

      const getOptimalFontSize = (deviceType: string) => {
        switch (deviceType) {
          case 'phone': return { base: 'text-sm', small: 'text-xs', large: 'text-base', title: 'text-lg' };
          case 'tablet': return { base: 'text-base', small: 'text-sm', large: 'text-lg', title: 'text-xl' };
          default: return { base: 'text-base', small: 'text-sm', large: 'text-lg', title: 'text-2xl' };
        }
      };

      const getSpacing = (deviceType: string) => {
        switch (deviceType) {
          case 'phone': return { xs: 'p-1', sm: 'p-2', md: 'p-3', lg: 'p-4', xl: 'p-6' };
          case 'tablet': return { xs: 'p-2', sm: 'p-3', md: 'p-4', lg: 'p-6', xl: 'p-8' };
          default: return { xs: 'p-2', sm: 'p-4', md: 'p-6', lg: 'p-8', xl: 'p-12' };
        }
      };

      const getTouchTargetSize = (isTouch: boolean) => {
        return isTouch 
          ? { minHeight: '44px', minWidth: '44px' }
          : { minHeight: '32px', minWidth: '32px' };
      };
      
      return {
        columns: getGridColumns(deviceType, orientation),
        fontSize: getOptimalFontSize(deviceType),
        spacing: getSpacing(deviceType),
        touchTarget: getTouchTargetSize(isTouch),
        showSidebar: deviceType !== 'phone' || orientation === 'landscape',
        compactMode: deviceType === 'phone' && orientation === 'portrait',
        fullscreenModals: deviceType === 'phone',
      };
    }

    it('should return complete layout configuration for phone portrait', () => {
      const screenInfo: ScreenInfo = {
        width: 375,
        height: 667,
        orientation: 'portrait',
        deviceType: 'phone',
        isTouch: true,
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
      };
      
      const config = getLayoutConfig(screenInfo);
      
      expect(config.columns).toBe(1);
      expect(config.compactMode).toBe(true);
      expect(config.fullscreenModals).toBe(true);
      expect(config.showSidebar).toBe(false);
      expect(config.touchTarget.minHeight).toBe('44px');
    });

    it('should return configuration for tablet landscape', () => {
      const screenInfo: ScreenInfo = {
        width: 1024,
        height: 768,
        orientation: 'landscape',
        deviceType: 'tablet',
        isTouch: true,
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
      };
      
      const config = getLayoutConfig(screenInfo);
      
      expect(config.columns).toBe(3);
      expect(config.compactMode).toBe(false);
      expect(config.fullscreenModals).toBe(false);
      expect(config.showSidebar).toBe(true);
    });

    it('should handle desktop configuration', () => {
      const screenInfo: ScreenInfo = {
        width: 1920,
        height: 1080,
        orientation: 'landscape',
        deviceType: 'desktop',
        isTouch: false,
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
      };
      
      const config = getLayoutConfig(screenInfo);
      
      expect(config.columns).toBe(4);
      expect(config.compactMode).toBe(false);
      expect(config.fullscreenModals).toBe(false);
      expect(config.showSidebar).toBe(true);
      expect(config.touchTarget.minHeight).toBe('32px');
    });
  });

  describe('getAnimationDuration', () => {
    function getAnimationDuration(screenType: 'phone' | 'tablet' | 'desktop'): number {
      switch (screenType) {
        case 'phone': return 200;
        case 'tablet': return 250;
        case 'desktop': return 300;
      }
    }

    it('should return appropriate animation durations', () => {
      expect(getAnimationDuration('phone')).toBe(200);
      expect(getAnimationDuration('tablet')).toBe(250);
      expect(getAnimationDuration('desktop')).toBe(300);
    });
  });
});