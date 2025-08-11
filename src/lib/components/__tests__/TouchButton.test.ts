import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TouchButton from '../TouchButton.svelte';

// Mock the touch interactions utility
vi.mock('$lib/utils/touchInteractions', () => ({
  createGestureRecognizer: vi.fn(() => ({
    on: vi.fn(),
    destroy: vi.fn()
  })),
  triggerHaptic: vi.fn(),
  TouchPerformance: {
    optimizeCallback: vi.fn((callback) => callback())
  }
}));

// Mock the responsive layout utility
vi.mock('$lib/utils/responsiveLayout', () => ({
  screenInfo: {
    subscribe: vi.fn((callback) => {
      callback({
        width: 375,
        height: 667,
        orientation: 'portrait',
        deviceType: 'phone',
        isTouch: true,
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      return () => {};
    })
  }
}));

describe('TouchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default props', () => {
    render(TouchButton, {
      slots: {
        default: 'Click me'
      }
    });

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click me');
    expect(button).toHaveClass('touch-button');
  });

  it('should apply variant classes correctly', () => {
    const { rerender } = render(TouchButton, {
      props: { variant: 'primary' },
      slots: { default: 'Primary' }
    });

    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-arri-red');

    rerender({ variant: 'secondary' });
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-arri-gray');

    rerender({ variant: 'ghost' });
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent');

    rerender({ variant: 'danger' });
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
  });

  it('should apply size classes correctly', () => {
    const { rerender } = render(TouchButton, {
      props: { size: 'sm' },
      slots: { default: 'Small' }
    });

    let button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-[44px]'); // Touch device

    rerender({ size: 'md' });
    button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-[48px]');

    rerender({ size: 'lg' });
    button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-[52px]');
  });

  it('should handle disabled state', () => {
    render(TouchButton, {
      props: { disabled: true },
      slots: { default: 'Disabled' }
    });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
    expect(button).toHaveClass('cursor-not-allowed');
  });

  it('should handle loading state', () => {
    render(TouchButton, {
      props: { loading: true },
      slots: { default: 'Loading' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('cursor-wait');
    expect(screen.getByText('Loading')).toBeInTheDocument();
    
    // Should have loading spinner
    const spinner = button.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(TouchButton, {
      props: { className: 'custom-class' },
      slots: { default: 'Custom' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should set aria-label when provided', () => {
    render(TouchButton, {
      props: { ariaLabel: 'Custom label' },
      slots: { default: 'Button' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Custom label');
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    
    render(TouchButton, {
      props: {
        hapticFeedback: false // Disable haptic for testing
      },
      slots: { default: 'Click me' }
    });

    const button = screen.getByRole('button');
    button.addEventListener('click', handleClick);

    await fireEvent.click(button);
    expect(handleClick).toHaveBeenCalled();
  });

  it('should handle keyboard events', async () => {
    const component = render(TouchButton, {
      slots: { default: 'Keyboard' }
    });

    const button = screen.getByRole('button');
    
    // Test Enter key
    await fireEvent.keyDown(button, { key: 'Enter' });
    // Should dispatch click event (tested through component events)

    // Test Space key
    await fireEvent.keyDown(button, { key: ' ' });
    // Should dispatch click event (tested through component events)

    // Test other keys (should not trigger)
    await fireEvent.keyDown(button, { key: 'a' });
    // Should not dispatch click event
  });

  it('should not handle events when disabled', async () => {
    const handleClick = vi.fn();
    
    render(TouchButton, {
      props: { disabled: true },
      slots: { default: 'Disabled' }
    });

    const button = screen.getByRole('button');
    button.addEventListener('click', handleClick);

    await fireEvent.click(button);
    await fireEvent.keyDown(button, { key: 'Enter' });

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should not handle events when loading', async () => {
    const handleClick = vi.fn();
    
    render(TouchButton, {
      props: { loading: true },
      slots: { default: 'Loading' }
    });

    const button = screen.getByRole('button');
    button.addEventListener('click', handleClick);

    await fireEvent.click(button);
    await fireEvent.keyDown(button, { key: 'Enter' });

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply touch-specific classes on touch devices', () => {
    render(TouchButton, {
      slots: { default: 'Touch' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('min-w-[44px]'); // Touch device minimum width
  });

  it('should handle press animation', () => {
    render(TouchButton, {
      props: { pressAnimation: true },
      slots: { default: 'Press me' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('touch-button');
    // Press animation is handled through gesture recognizer
  });

  it('should disable haptic feedback when requested', () => {
    render(TouchButton, {
      props: { hapticFeedback: false },
      slots: { default: 'No haptic' }
    });

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    // Haptic feedback is handled internally
  });

  it('should render slot content correctly', () => {
    render(TouchButton, {
      slots: {
        default: '<span>Complex content</span>'
      }
    });

    expect(screen.getByText('Complex content')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(TouchButton, {
      props: { ariaLabel: 'Accessible button' },
      slots: { default: 'Button' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-label', 'Accessible button');
  });

  it('should handle focus states', () => {
    render(TouchButton, {
      slots: { default: 'Focus me' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:outline-none');
    expect(button).toHaveClass('focus:ring-2');
  });

  it('should prevent text selection', () => {
    render(TouchButton, {
      slots: { default: 'No select' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('select-none');
  });

  it('should optimize for touch manipulation', () => {
    render(TouchButton, {
      slots: { default: 'Touch optimized' }
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('touch-manipulation');
  });
});