/**
 * Responsive Layout Utility
 * Provides utilities for managing responsive layouts and screen size detection
 */

import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

export interface ScreenInfo {
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

export interface LayoutBreakpoints {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  tablet: number;
}

export const breakpoints: LayoutBreakpoints = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  tablet: 768,
};

// Create reactive screen info store
function createScreenStore() {
  const { subscribe, set, update } = writable<ScreenInfo>({
    width: 0,
    height: 0,
    orientation: 'portrait',
    deviceType: 'phone',
    isTouch: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  function updateScreenInfo() {
    if (!browser) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width > height ? 'landscape' : 'portrait';
    
    // Determine device type based on screen size and touch capability
    let deviceType: 'phone' | 'tablet' | 'desktop' = 'phone';
    if (width >= breakpoints.tablet) {
      deviceType = window.matchMedia('(hover: none) and (pointer: coarse)').matches ? 'tablet' : 'desktop';
    }

    // Check for touch capability
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Get safe area insets (for devices with notches, etc.)
    const safeArea = {
      top: getSafeAreaInset('top'),
      bottom: getSafeAreaInset('bottom'),
      left: getSafeAreaInset('left'),
      right: getSafeAreaInset('right'),
    };

    set({
      width,
      height,
      orientation,
      deviceType,
      isTouch,
      safeArea
    });
  }

  function getSafeAreaInset(side: 'top' | 'bottom' | 'left' | 'right'): number {
    if (!browser) return 0;
    
    try {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--safe-area-inset-${side}`)
        .trim();
      
      if (value && value !== '0px') {
        return parseInt(value.replace('px', '')) || 0;
      }
    } catch (error) {
      console.warn(`Failed to get safe area inset for ${side}:`, error);
    }
    
    return 0;
  }

  // Initialize and set up listeners
  if (browser) {
    updateScreenInfo();
    
    window.addEventListener('resize', updateScreenInfo);
    window.addEventListener('orientationchange', () => {
      // Delay to ensure orientation change is complete
      setTimeout(updateScreenInfo, 100);
    });
  }

  return {
    subscribe,
    refresh: updateScreenInfo
  };
}

export const screenInfo = createScreenStore();

// Derived stores for common responsive conditions
export const isPhone = derived(screenInfo, ($screen) => $screen.deviceType === 'phone');
export const isTablet = derived(screenInfo, ($screen) => $screen.deviceType === 'tablet');
export const isDesktop = derived(screenInfo, ($screen) => $screen.deviceType === 'desktop');
export const isLandscape = derived(screenInfo, ($screen) => $screen.orientation === 'landscape');
export const isPortrait = derived(screenInfo, ($screen) => $screen.orientation === 'portrait');
export const isTouch = derived(screenInfo, ($screen) => $screen.isTouch);

// Utility functions for responsive design
export function getResponsiveClasses(config: {
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

export function getGridColumns(screenType: 'phone' | 'tablet' | 'desktop', orientation: 'portrait' | 'landscape'): number {
  if (screenType === 'phone') {
    return orientation === 'landscape' ? 2 : 1;
  } else if (screenType === 'tablet') {
    return orientation === 'landscape' ? 3 : 2;
  } else {
    return orientation === 'landscape' ? 4 : 3;
  }
}

export function getTouchTargetSize(isTouch: boolean): { minHeight: string; minWidth: string } {
  return isTouch 
    ? { minHeight: '44px', minWidth: '44px' }
    : { minHeight: '32px', minWidth: '32px' };
}

export function getOptimalFontSize(screenType: 'phone' | 'tablet' | 'desktop'): {
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

export function getSpacing(screenType: 'phone' | 'tablet' | 'desktop'): {
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

// Layout component helpers
export function getLayoutConfig(screenInfo: ScreenInfo) {
  const { deviceType, orientation, isTouch } = screenInfo;
  
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

// Media query utilities for JavaScript
export function matchesMediaQuery(query: string): boolean {
  if (!browser) return false;
  return window.matchMedia(query).matches;
}

export function createMediaQueryStore(query: string) {
  const { subscribe, set } = writable(false);
  
  if (browser) {
    const mediaQuery = window.matchMedia(query);
    set(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => set(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return {
      subscribe,
      destroy: () => mediaQuery.removeEventListener('change', handler)
    };
  }
  
  return { subscribe, destroy: () => {} };
}

// Viewport utilities
export function getViewportDimensions() {
  if (!browser) return { width: 0, height: 0 };
  
  return {
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
  };
}

export function isElementInViewport(element: Element): boolean {
  if (!browser) return false;
  
  const rect = element.getBoundingClientRect();
  const viewport = getViewportDimensions();
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= viewport.height &&
    rect.right <= viewport.width
  );
}

// Animation utilities for responsive design
export function getAnimationDuration(screenType: 'phone' | 'tablet' | 'desktop'): number {
  // Faster animations on mobile for better perceived performance
  switch (screenType) {
    case 'phone': return 200;
    case 'tablet': return 250;
    case 'desktop': return 300;
  }
}

export function shouldReduceMotion(): boolean {
  if (!browser) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}