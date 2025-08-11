/**
 * Touch Interaction Utilities
 * Provides enhanced touch interactions including haptic feedback, gestures, and optimized controls
 */

import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

export interface TouchCapabilities {
  hasHapticFeedback: boolean;
  maxTouchPoints: number;
  supportsPinch: boolean;
  supportsSwipe: boolean;
  hasPointerEvents: boolean;
}

export interface GestureEvent {
  type: 'tap' | 'doubletap' | 'press' | 'swipe' | 'pinch' | 'pan';
  target: Element;
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  deltaX: number;
  deltaY: number;
  distance?: number;
  scale?: number;
  velocity?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration: number;
}

export interface HapticOptions {
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification';
  intensity?: number; // 0-1 for custom intensity
}

// Touch capabilities detection
function detectTouchCapabilities(): TouchCapabilities {
  if (!browser) {
    return {
      hasHapticFeedback: false,
      maxTouchPoints: 0,
      supportsPinch: false,
      supportsSwipe: false,
      hasPointerEvents: false
    };
  }

  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasHaptic = 'vibrate' in navigator || 'hapticFeedback' in navigator;
  const hasPointer = 'PointerEvent' in window;
  const maxTouchPoints = navigator.maxTouchPoints || 1;

  return {
    hasHapticFeedback: hasHaptic,
    maxTouchPoints,
    supportsPinch: hasTouch && maxTouchPoints >= 2,
    supportsSwipe: hasTouch,
    hasPointerEvents: hasPointer
  };
}

export const touchCapabilities = writable<TouchCapabilities>(detectTouchCapabilities());

// Haptic feedback utilities
export class HapticFeedback {
  private static isSupported = false;
  private static vibrationAPI: any = null;

  static {
    if (browser) {
      this.isSupported = 'vibrate' in navigator;
      this.vibrationAPI = navigator.vibrate?.bind(navigator);
    }
  }

  static async trigger(options: HapticOptions): Promise<void> {
    if (!this.isSupported || !this.vibrationAPI) return;

    try {
      // Map haptic types to vibration patterns
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        selection: [5],
        impact: [15],
        notification: [10, 50, 10]
      };

      const pattern = patterns[options.type] || patterns.medium;
      
      // Apply intensity if provided
      if (options.intensity && options.intensity !== 1) {
        const adjustedPattern = pattern.map(duration => 
          Math.round(duration * options.intensity!)
        );
        this.vibrationAPI(adjustedPattern);
      } else {
        this.vibrationAPI(pattern);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  static isAvailable(): boolean {
    return this.isSupported;
  }
}

// Gesture recognition system
export class GestureRecognizer {
  private element: Element;
  private callbacks: Map<string, (event: GestureEvent) => void> = new Map();
  private touchStartTime = 0;
  private touchStartPoint = { x: 0, y: 0 };
  private lastTouchPoint = { x: 0, y: 0 };
  private touchCount = 0;
  private lastTapTime = 0;
  private isTracking = false;
  private touchStartDistance = 0;
  private lastScale = 1;

  // Configuration
  private config = {
    tapThreshold: 10, // pixels
    pressThreshold: 500, // ms
    doubleTapThreshold: 300, // ms
    swipeThreshold: 50, // pixels
    swipeVelocityThreshold: 0.5, // pixels/ms
    pinchThreshold: 10, // pixels
  };

  constructor(element: Element) {
    this.element = element;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!browser) return;

    const capabilities = detectTouchCapabilities();
    
    if (capabilities.hasPointerEvents) {
      this.element.addEventListener('pointerdown', this.handlePointerDown.bind(this));
      this.element.addEventListener('pointermove', this.handlePointerMove.bind(this));
      this.element.addEventListener('pointerup', this.handlePointerUp.bind(this));
      this.element.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
    } else {
      this.element.addEventListener('touchstart', this.handleTouchStart.bind(this));
      this.element.addEventListener('touchmove', this.handleTouchMove.bind(this));
      this.element.addEventListener('touchend', this.handleTouchEnd.bind(this));
      this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
      
      // Fallback to mouse events for non-touch devices
      this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
      this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
      this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
  }

  on(gestureType: GestureEvent['type'], callback: (event: GestureEvent) => void): void {
    this.callbacks.set(gestureType, callback);
  }

  off(gestureType: GestureEvent['type']): void {
    this.callbacks.delete(gestureType);
  }

  private handlePointerDown(event: PointerEvent): void {
    this.startTracking(event.clientX, event.clientY, 1);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.isTracking) return;
    this.updateTracking(event.clientX, event.clientY);
  }

  private handlePointerUp(event: PointerEvent): void {
    this.endTracking(event.clientX, event.clientY);
  }

  private handlePointerCancel(): void {
    this.cancelTracking();
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touches = event.touches;
    this.touchCount = touches.length;

    if (touches.length === 1) {
      this.startTracking(touches[0].clientX, touches[0].clientY, 1);
    } else if (touches.length === 2) {
      // Handle pinch gesture start
      const touch1 = touches[0];
      const touch2 = touches[1];
      const distance = this.calculateDistance(touch1, touch2);
      this.touchStartDistance = distance;
      this.lastScale = 1;
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      this.startTracking(centerX, centerY, 2);
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.isTracking) return;
    event.preventDefault();
    
    const touches = event.touches;
    
    if (touches.length === 1) {
      this.updateTracking(touches[0].clientX, touches[0].clientY);
    } else if (touches.length === 2) {
      // Handle pinch gesture
      const touch1 = touches[0];
      const touch2 = touches[1];
      const distance = this.calculateDistance(touch1, touch2);
      const scale = distance / this.touchStartDistance;
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      this.updateTracking(centerX, centerY);
      
      if (Math.abs(scale - this.lastScale) > 0.1) {
        this.emitGesture('pinch', centerX, centerY, { scale });
        this.lastScale = scale;
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    const touches = event.touches;
    
    if (touches.length === 0) {
      const changedTouch = event.changedTouches[0];
      this.endTracking(changedTouch.clientX, changedTouch.clientY);
    }
  }

  private handleTouchCancel(): void {
    this.cancelTracking();
  }

  private handleMouseDown(event: MouseEvent): void {
    this.startTracking(event.clientX, event.clientY, 1);
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isTracking) return;
    this.updateTracking(event.clientX, event.clientY);
  }

  private handleMouseUp(event: MouseEvent): void {
    this.endTracking(event.clientX, event.clientY);
  }

  private startTracking(x: number, y: number, touchCount: number): void {
    this.isTracking = true;
    this.touchStartTime = Date.now();
    this.touchStartPoint = { x, y };
    this.lastTouchPoint = { x, y };
    this.touchCount = touchCount;
  }

  private updateTracking(x: number, y: number): void {
    this.lastTouchPoint = { x, y };
    
    // Check for pan gesture
    const deltaX = x - this.touchStartPoint.x;
    const deltaY = y - this.touchStartPoint.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > this.config.tapThreshold) {
      this.emitGesture('pan', x, y);
    }
  }

  private endTracking(x: number, y: number): void {
    if (!this.isTracking) return;
    
    const duration = Date.now() - this.touchStartTime;
    const deltaX = x - this.touchStartPoint.x;
    const deltaY = y - this.touchStartPoint.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / duration;

    // Determine gesture type
    if (distance < this.config.tapThreshold) {
      // Tap or double tap
      const now = Date.now();
      if (now - this.lastTapTime < this.config.doubleTapThreshold) {
        this.emitGesture('doubletap', x, y);
      } else {
        this.emitGesture('tap', x, y);
      }
      this.lastTapTime = now;
    } else if (duration > this.config.pressThreshold && distance < this.config.tapThreshold) {
      // Long press
      this.emitGesture('press', x, y);
    } else if (distance > this.config.swipeThreshold && velocity > this.config.swipeVelocityThreshold) {
      // Swipe
      const direction = this.getSwipeDirection(deltaX, deltaY);
      this.emitGesture('swipe', x, y, { direction, velocity });
    }

    this.cancelTracking();
  }

  private cancelTracking(): void {
    this.isTracking = false;
    this.touchCount = 0;
  }

  private calculateDistance(touch1: Touch, touch2: Touch): number {
    const deltaX = touch2.clientX - touch1.clientX;
    const deltaY = touch2.clientY - touch1.clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  private getSwipeDirection(deltaX: number, deltaY: number): 'up' | 'down' | 'left' | 'right' {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  private emitGesture(type: GestureEvent['type'], x: number, y: number, extra: any = {}): void {
    const callback = this.callbacks.get(type);
    if (!callback) return;

    const gestureEvent: GestureEvent = {
      type,
      target: this.element,
      startPoint: this.touchStartPoint,
      currentPoint: { x, y },
      deltaX: x - this.touchStartPoint.x,
      deltaY: y - this.touchStartPoint.y,
      duration: Date.now() - this.touchStartTime,
      ...extra
    };

    // Trigger haptic feedback for certain gestures
    if (type === 'tap') {
      HapticFeedback.trigger({ type: 'selection' });
    } else if (type === 'press') {
      HapticFeedback.trigger({ type: 'medium' });
    }

    callback(gestureEvent);
  }

  destroy(): void {
    // Remove all event listeners
    if (!browser) return;

    const capabilities = detectTouchCapabilities();
    
    if (capabilities.hasPointerEvents) {
      this.element.removeEventListener('pointerdown', this.handlePointerDown.bind(this));
      this.element.removeEventListener('pointermove', this.handlePointerMove.bind(this));
      this.element.removeEventListener('pointerup', this.handlePointerUp.bind(this));
      this.element.removeEventListener('pointercancel', this.handlePointerCancel.bind(this));
    } else {
      this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
      this.element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
      
      this.element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.element.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.element.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    this.callbacks.clear();
  }
}

// Touch-optimized slider utility
export interface SliderOptions {
  min: number;
  max: number;
  step?: number;
  value: number;
  orientation?: 'horizontal' | 'vertical';
  sensitivity?: number;
  hapticFeedback?: boolean;
  snapToSteps?: boolean;
}

export class TouchSlider {
  private element: Element;
  private options: Required<SliderOptions>;
  private gestureRecognizer: GestureRecognizer;
  private isDragging = false;
  private startValue = 0;
  private onChangeCallback?: (value: number) => void;

  constructor(element: Element, options: SliderOptions) {
    this.element = element;
    this.options = {
      step: 1,
      orientation: 'horizontal',
      sensitivity: 1,
      hapticFeedback: true,
      snapToSteps: true,
      ...options
    };

    this.gestureRecognizer = new GestureRecognizer(element);
    this.setupGestures();
  }

  private setupGestures(): void {
    this.gestureRecognizer.on('pan', (event) => {
      if (!this.isDragging) {
        this.isDragging = true;
        this.startValue = this.options.value;
      }

      const delta = this.options.orientation === 'horizontal' 
        ? event.deltaX 
        : -event.deltaY; // Invert Y for natural feel

      const range = this.options.max - this.options.min;
      const elementSize = this.options.orientation === 'horizontal'
        ? this.element.clientWidth
        : this.element.clientHeight;

      const deltaValue = (delta / elementSize) * range * this.options.sensitivity;
      let newValue = this.startValue + deltaValue;

      // Clamp to bounds
      newValue = Math.max(this.options.min, Math.min(this.options.max, newValue));

      // Snap to steps if enabled
      if (this.options.snapToSteps) {
        newValue = Math.round(newValue / this.options.step) * this.options.step;
      }

      // Trigger haptic feedback on value change
      if (this.options.hapticFeedback && newValue !== this.options.value) {
        HapticFeedback.trigger({ type: 'light' });
      }

      this.options.value = newValue;
      this.onChangeCallback?.(newValue);
    });

    this.gestureRecognizer.on('tap', () => {
      this.isDragging = false;
    });
  }

  onChange(callback: (value: number) => void): void {
    this.onChangeCallback = callback;
  }

  setValue(value: number): void {
    this.options.value = Math.max(this.options.min, Math.min(this.options.max, value));
  }

  getValue(): number {
    return this.options.value;
  }

  destroy(): void {
    this.gestureRecognizer.destroy();
  }
}

// Performance optimization utilities
export class TouchPerformance {
  private static rafId: number | null = null;
  private static pendingCallbacks: (() => void)[] = [];

  // Debounce touch events to maintain 100ms response time
  static optimizeCallback(callback: () => void): void {
    this.pendingCallbacks.push(callback);
    
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        const callbacks = [...this.pendingCallbacks];
        this.pendingCallbacks.length = 0;
        this.rafId = null;
        
        callbacks.forEach(cb => cb());
      });
    }
  }

  // Throttle high-frequency events
  static throttle<T extends (...args: any[]) => void>(
    func: T, 
    limit: number = 16 // ~60fps
  ): T {
    let inThrottle: boolean;
    return ((...args: any[]) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  }

  // Debounce for final value updates
  static debounce<T extends (...args: any[]) => void>(
    func: T, 
    delay: number = 100
  ): T {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    }) as T;
  }
}

// Export utility functions
export function createGestureRecognizer(element: Element): GestureRecognizer {
  return new GestureRecognizer(element);
}

export function createTouchSlider(element: Element, options: SliderOptions): TouchSlider {
  return new TouchSlider(element, options);
}

export function triggerHaptic(options: HapticOptions): Promise<void> {
  return HapticFeedback.trigger(options);
}

export const isHapticAvailable = () => HapticFeedback.isAvailable();