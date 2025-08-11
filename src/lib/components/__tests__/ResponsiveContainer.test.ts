import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ResponsiveContainer from '../ResponsiveContainer.svelte';

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

describe('ResponsiveContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default props', () => {
    render(ResponsiveContainer, {
      props: {},
      slots: {
        default: 'Container content'
      }
    });

    const container = screen.getByText('Container content').parentElement;
    expect(container).toHaveClass('responsive-container');
    expect(container).toHaveClass('max-w-lg'); // default size
    expect(container).toHaveClass('tablet:max-w-2xl');
    expect(container).toHaveClass('p-4'); // default padding md
    expect(container).toHaveClass('tablet:p-6');
    expect(container).toHaveClass('mx-auto'); // default center
    expect(container).toHaveClass('w-full');
  });

  it('should apply size classes correctly', () => {
    const { rerender } = render(ResponsiveContainer, {
      props: { size: 'sm' },
      slots: { default: 'Content' }
    });

    let container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('max-w-sm');

    rerender({ size: 'md' });
    container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('max-w-md');
    expect(container).toHaveClass('tablet:max-w-lg');

    rerender({ size: 'xl' });
    container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('max-w-xl');
    expect(container).toHaveClass('tablet:max-w-4xl');

    rerender({ size: 'full' });
    container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('max-w-full');
  });

  it('should apply padding classes correctly', () => {
    const { rerender } = render(ResponsiveContainer, {
      props: { padding: 'none' },
      slots: { default: 'Content' }
    });

    let container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('p-0');

    rerender({ padding: 'sm' });
    container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('p-3');
    expect(container).toHaveClass('tablet:p-4');

    rerender({ padding: 'lg' });
    container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('p-6');
    expect(container).toHaveClass('tablet:p-8');
  });

  it('should handle center prop', () => {
    const { rerender } = render(ResponsiveContainer, {
      props: { center: false },
      slots: { default: 'Content' }
    });

    let container = screen.getByText('Content').parentElement;
    expect(container).not.toHaveClass('mx-auto');

    rerender({ center: true });
    container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('mx-auto');
  });

  it('should apply custom className', () => {
    render(ResponsiveContainer, {
      props: {
        className: 'custom-container-class'
      },
      slots: {
        default: 'Custom content'
      }
    });

    const container = screen.getByText('Custom content').parentElement;
    expect(container).toHaveClass('custom-container-class');
  });

  it('should add safe area classes for phone devices', () => {
    render(ResponsiveContainer, {
      props: {},
      slots: {
        default: 'Phone content'
      }
    });

    const container = screen.getByText('Phone content').parentElement;
    expect(container).toHaveClass('px-safe-left');
    expect(container).toHaveClass('pr-safe-right');
  });

  it('should pass screen info to slot', () => {
    const TestComponent = `
      <script>
        import ResponsiveContainer from '../ResponsiveContainer.svelte';
      </script>
      
      <ResponsiveContainer let:currentScreenInfo>
        <div data-testid="device-type">
          {currentScreenInfo?.deviceType || 'unknown'}
        </div>
      </ResponsiveContainer>
    `;

    render(TestComponent);

    expect(screen.getByTestId('device-type')).toHaveTextContent('phone');
  });

  it('should handle tablet device differently', () => {
    // Mock tablet screen info
    vi.mocked(vi.importMock('$lib/utils/responsiveLayout')).screenInfo = {
      subscribe: vi.fn((callback) => {
        callback({
          width: 768,
          height: 1024,
          orientation: 'portrait',
          deviceType: 'tablet',
          isTouch: true,
          safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
        });
        return () => {};
      })
    };

    render(ResponsiveContainer, {
      props: {},
      slots: {
        default: 'Tablet content'
      }
    });

    const container = screen.getByText('Tablet content').parentElement;
    // Should not have safe area classes for tablet
    expect(container).not.toHaveClass('px-safe-left');
    expect(container).not.toHaveClass('pr-safe-right');
  });

  it('should always have full width', () => {
    render(ResponsiveContainer, {
      props: { size: 'sm' },
      slots: { default: 'Content' }
    });

    const container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('w-full');
  });

  it('should combine all classes correctly', () => {
    render(ResponsiveContainer, {
      props: {
        size: 'lg',
        padding: 'md',
        center: true,
        className: 'extra-class'
      },
      slots: {
        default: 'Combined content'
      }
    });

    const container = screen.getByText('Combined content').parentElement;
    expect(container).toHaveClass('responsive-container');
    expect(container).toHaveClass('max-w-lg');
    expect(container).toHaveClass('tablet:max-w-2xl');
    expect(container).toHaveClass('p-4');
    expect(container).toHaveClass('tablet:p-6');
    expect(container).toHaveClass('mx-auto');
    expect(container).toHaveClass('w-full');
    expect(container).toHaveClass('px-safe-left');
    expect(container).toHaveClass('pr-safe-right');
    expect(container).toHaveClass('extra-class');
  });
});