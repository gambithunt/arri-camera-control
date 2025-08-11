import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ResponsiveGrid from '../ResponsiveGrid.svelte';

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

describe('ResponsiveGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default props', () => {
    render(ResponsiveGrid, {
      props: {},
      slots: {
        default: 'Grid content'
      }
    });

    const grid = screen.getByText('Grid content').parentElement;
    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('responsive-grid');
    expect(grid).toHaveClass('gap-3'); // default gap md
    expect(grid).toHaveClass('tablet:gap-4');
    expect(grid).toHaveClass('grid-cols-1'); // phone portrait
  });

  it('should apply gap classes correctly', () => {
    const { rerender } = render(ResponsiveGrid, {
      props: { gap: 'sm' },
      slots: { default: 'Content' }
    });

    let grid = screen.getByText('Content').parentElement;
    expect(grid).toHaveClass('gap-2');
    expect(grid).toHaveClass('tablet:gap-3');

    rerender({ gap: 'lg' });
    grid = screen.getByText('Content').parentElement;
    expect(grid).toHaveClass('gap-4');
    expect(grid).toHaveClass('tablet:gap-6');
  });

  it('should apply equal height classes when requested', () => {
    render(ResponsiveGrid, {
      props: { equalHeight: true },
      slots: { default: 'Equal height content' }
    });

    const grid = screen.getByText('Equal height content').parentElement;
    expect(grid).toHaveClass('items-stretch');
  });

  it('should not apply equal height classes by default', () => {
    render(ResponsiveGrid, {
      props: {},
      slots: { default: 'Normal content' }
    });

    const grid = screen.getByText('Normal content').parentElement;
    expect(grid).not.toHaveClass('items-stretch');
  });

  it('should apply custom className', () => {
    render(ResponsiveGrid, {
      props: {
        className: 'custom-grid-class'
      },
      slots: {
        default: 'Custom content'
      }
    });

    const grid = screen.getByText('Custom content').parentElement;
    expect(grid).toHaveClass('custom-grid-class');
  });

  it('should set CSS custom properties for grid template', () => {
    render(ResponsiveGrid, {
      props: {
        minItemWidth: '250px',
        autoFit: true
      },
      slots: {
        default: 'Grid content'
      }
    });

    const grid = screen.getByText('Grid content').parentElement;
    expect(grid).toHaveStyle('--grid-template: repeat(auto-fit, minmax(250px, 1fr))');
    expect(grid).toHaveStyle('--min-item-width: 250px');
  });

  it('should use auto-fill when autoFit is false', () => {
    render(ResponsiveGrid, {
      props: {
        minItemWidth: '200px',
        autoFit: false
      },
      slots: {
        default: 'Grid content'
      }
    });

    const grid = screen.getByText('Grid content').parentElement;
    expect(grid).toHaveStyle('--grid-template: repeat(auto-fill, minmax(200px, 1fr))');
  });

  it('should use grid-auto-fit class for larger screens', () => {
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

    render(ResponsiveGrid, {
      props: {},
      slots: {
        default: 'Tablet content'
      }
    });

    const grid = screen.getByText('Tablet content').parentElement;
    expect(grid).toHaveClass('grid-auto-fit');
    expect(grid).not.toHaveClass('grid-cols-1');
  });

  it('should pass screen info to slot', () => {
    const TestComponent = `
      <script>
        import ResponsiveGrid from '../ResponsiveGrid.svelte';
      </script>
      
      <ResponsiveGrid let:currentScreenInfo>
        <div data-testid="device-info">
          {currentScreenInfo?.deviceType || 'unknown'} - {currentScreenInfo?.orientation || 'unknown'}
        </div>
      </ResponsiveGrid>
    `;

    render(TestComponent);

    expect(screen.getByTestId('device-info')).toHaveTextContent('phone - portrait');
  });

  it('should handle different minItemWidth values', () => {
    const { rerender } = render(ResponsiveGrid, {
      props: { minItemWidth: '150px' },
      slots: { default: 'Content' }
    });

    let grid = screen.getByText('Content').parentElement;
    expect(grid).toHaveStyle('--min-item-width: 150px');
    expect(grid).toHaveStyle('--grid-template: repeat(auto-fit, minmax(150px, 1fr))');

    rerender({ minItemWidth: '300px' });
    grid = screen.getByText('Content').parentElement;
    expect(grid).toHaveStyle('--min-item-width: 300px');
    expect(grid).toHaveStyle('--grid-template: repeat(auto-fit, minmax(300px, 1fr))');
  });

  it('should combine all classes correctly', () => {
    render(ResponsiveGrid, {
      props: {
        gap: 'lg',
        equalHeight: true,
        className: 'extra-grid-class'
      },
      slots: {
        default: 'Combined content'
      }
    });

    const grid = screen.getByText('Combined content').parentElement;
    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('responsive-grid');
    expect(grid).toHaveClass('gap-4');
    expect(grid).toHaveClass('tablet:gap-6');
    expect(grid).toHaveClass('items-stretch');
    expect(grid).toHaveClass('grid-cols-1'); // phone portrait
    expect(grid).toHaveClass('extra-grid-class');
  });

  it('should handle landscape phone orientation', () => {
    // Mock phone landscape screen info
    vi.mocked(vi.importMock('$lib/utils/responsiveLayout')).screenInfo = {
      subscribe: vi.fn((callback) => {
        callback({
          width: 667,
          height: 375,
          orientation: 'landscape',
          deviceType: 'phone',
          isTouch: true,
          safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
        });
        return () => {};
      })
    };

    render(ResponsiveGrid, {
      props: {},
      slots: {
        default: 'Landscape content'
      }
    });

    const grid = screen.getByText('Landscape content').parentElement;
    expect(grid).toHaveClass('grid-auto-fit'); // Should use auto-fit for landscape
  });
});