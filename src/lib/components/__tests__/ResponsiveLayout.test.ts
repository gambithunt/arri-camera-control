import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ResponsiveLayout from '../ResponsiveLayout.svelte';

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
  },
  getLayoutConfig: vi.fn(() => ({
    columns: 1,
    fontSize: {
      base: 'text-sm',
      small: 'text-xs',
      large: 'text-base',
      title: 'text-lg'
    },
    spacing: {
      xs: 'p-1',
      sm: 'p-2',
      md: 'p-3',
      lg: 'p-4',
      xl: 'p-6'
    },
    touchTarget: { minHeight: '44px', minWidth: '44px' },
    showSidebar: false,
    compactMode: true,
    fullscreenModals: true
  }))
}));

describe('ResponsiveLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default props', () => {
    render(ResponsiveLayout, {
      props: {},
      slots: {
        default: 'Test content'
      }
    });

    const layout = screen.getByText('Test content').parentElement;
    expect(layout).toHaveClass('responsive-layout');
  });

  it('should apply grid variant classes', () => {
    render(ResponsiveLayout, {
      props: {
        variant: 'grid'
      },
      slots: {
        default: 'Grid content'
      }
    });

    const layout = screen.getByText('Grid content').parentElement;
    expect(layout).toHaveClass('grid');
    expect(layout).toHaveClass('grid-cols-1');
  });

  it('should apply stack variant classes', () => {
    render(ResponsiveLayout, {
      props: {
        variant: 'stack'
      },
      slots: {
        default: 'Stack content'
      }
    });

    const layout = screen.getByText('Stack content').parentElement;
    expect(layout).toHaveClass('flex');
    expect(layout).toHaveClass('flex-col');
  });

  it('should apply sidebar variant classes', () => {
    render(ResponsiveLayout, {
      props: {
        variant: 'sidebar'
      },
      slots: {
        default: 'Sidebar content'
      }
    });

    const layout = screen.getByText('Sidebar content').parentElement;
    // Should use flex-col for phone (compact mode)
    expect(layout).toHaveClass('flex');
    expect(layout).toHaveClass('flex-col');
  });

  it('should apply gap classes', () => {
    render(ResponsiveLayout, {
      props: {
        gap: 'lg'
      },
      slots: {
        default: 'Gap content'
      }
    });

    const layout = screen.getByText('Gap content').parentElement;
    expect(layout).toHaveClass('gap-4');
    expect(layout).toHaveClass('tablet:gap-6');
  });

  it('should apply padding classes', () => {
    render(ResponsiveLayout, {
      props: {
        padding: 'lg'
      },
      slots: {
        default: 'Padding content'
      }
    });

    const layout = screen.getByText('Padding content').parentElement;
    expect(layout).toHaveClass('p-4'); // lg spacing for phone
  });

  it('should apply max width classes', () => {
    render(ResponsiveLayout, {
      props: {
        maxWidth: 'md'
      },
      slots: {
        default: 'Max width content'
      }
    });

    const layout = screen.getByText('Max width content').parentElement;
    expect(layout).toHaveClass('max-w-md');
  });

  it('should apply center classes', () => {
    render(ResponsiveLayout, {
      props: {
        center: true
      },
      slots: {
        default: 'Centered content'
      }
    });

    const layout = screen.getByText('Centered content').parentElement;
    expect(layout).toHaveClass('mx-auto');
  });

  it('should apply animation classes by default', () => {
    render(ResponsiveLayout, {
      props: {},
      slots: {
        default: 'Animated content'
      }
    });

    const layout = screen.getByText('Animated content').parentElement;
    expect(layout).toHaveClass('transition-all');
    expect(layout).toHaveClass('duration-200');
    expect(layout).toHaveClass('ease-in-out');
  });

  it('should not apply animation classes when disabled', () => {
    render(ResponsiveLayout, {
      props: {
        animate: false
      },
      slots: {
        default: 'Non-animated content'
      }
    });

    const layout = screen.getByText('Non-animated content').parentElement;
    expect(layout).not.toHaveClass('transition-all');
  });

  it('should apply compact mode classes', () => {
    render(ResponsiveLayout, {
      props: {},
      slots: {
        default: 'Compact content'
      }
    });

    const layout = screen.getByText('Compact content').parentElement;
    expect(layout).toHaveClass('compact-mode');
  });

  it('should apply custom className', () => {
    render(ResponsiveLayout, {
      props: {
        className: 'custom-class'
      },
      slots: {
        default: 'Custom content'
      }
    });

    const layout = screen.getByText('Custom content').parentElement;
    expect(layout).toHaveClass('custom-class');
  });

  it('should pass screen info and layout config to slot', () => {
    const TestComponent = `
      <script>
        import ResponsiveLayout from '../ResponsiveLayout.svelte';
      </script>
      
      <ResponsiveLayout let:currentScreenInfo let:layoutConfig>
        <div data-testid="screen-info">
          Device: {currentScreenInfo?.deviceType || 'unknown'}
        </div>
        <div data-testid="layout-config">
          Columns: {layoutConfig?.columns || 0}
        </div>
      </ResponsiveLayout>
    `;

    render(TestComponent);

    expect(screen.getByTestId('screen-info')).toHaveTextContent('Device: phone');
    expect(screen.getByTestId('layout-config')).toHaveTextContent('Columns: 1');
  });

  it('should handle different gap values', () => {
    const { rerender } = render(ResponsiveLayout, {
      props: { gap: 'none' },
      slots: { default: 'Content' }
    });

    let layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveClass('gap-0');

    rerender({ gap: 'sm' });
    layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveClass('gap-2');
    expect(layout).toHaveClass('tablet:gap-3');

    rerender({ gap: 'md' });
    layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveClass('gap-3');
    expect(layout).toHaveClass('tablet:gap-4');
  });

  it('should handle different padding values', () => {
    const { rerender } = render(ResponsiveLayout, {
      props: { padding: 'none' },
      slots: { default: 'Content' }
    });

    let layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveClass('p-0');

    rerender({ padding: 'sm' });
    layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveClass('p-2'); // sm spacing for phone

    rerender({ padding: 'md' });
    layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveClass('p-3'); // md spacing for phone
  });

  it('should set CSS custom property for columns', () => {
    render(ResponsiveLayout, {
      props: {},
      slots: {
        default: 'Content'
      }
    });

    const layout = screen.getByText('Content').parentElement;
    expect(layout).toHaveStyle('--columns: 1');
  });
});