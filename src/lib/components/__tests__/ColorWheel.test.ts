/**
 * ColorWheel Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ColorWheel from '../ColorWheel.svelte';

// Mock browser environment
Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  value: 1,
});

// Mock canvas context
const mockContext = {
  scale: vi.fn(),
  clearRect: vi.fn(),
  createImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4 * 200 * 200)
  })),
  putImageData: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  stroke: vi.fn(),
  fillStyle: '',
  fill: vi.fn(),
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high'
};

// Mock canvas
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  getBoundingClientRect: vi.fn(() => ({
    left: 0,
    top: 0,
    width: 200,
    height: 200
  })),
  setPointerCapture: vi.fn(),
  releasePointerCapture: vi.fn(),
  width: 200,
  height: 200,
  style: {}
};

// Mock HTMLCanvasElement
global.HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);
global.HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 200,
  height: 200
}));

describe('ColorWheel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders color wheel with default props', () => {
    render(ColorWheel);
    
    expect(screen.getByText('shadows - Lift')).toBeInTheDocument();
    expect(screen.getByText('Adjusts shadows/blacks')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('renders different wheel types correctly', () => {
    const { rerender } = render(ColorWheel, {
      props: { wheelType: 'midtones', controlType: 'gamma' }
    });
    
    expect(screen.getByText('midtones - Gamma')).toBeInTheDocument();
    expect(screen.getByText('Adjusts midtones')).toBeInTheDocument();
    
    rerender({ wheelType: 'highlights', controlType: 'gain' });
    
    expect(screen.getByText('highlights - Gain')).toBeInTheDocument();
    expect(screen.getByText('Adjusts highlights/whites')).toBeInTheDocument();
  });

  it('displays current values when showValues is true', () => {
    render(ColorWheel, {
      props: {
        values: { r: 0.5, g: -0.3, b: 0.8 },
        showValues: true
      }
    });
    
    expect(screen.getByText('R:')).toBeInTheDocument();
    expect(screen.getByText('0.500')).toBeInTheDocument();
    expect(screen.getByText('G:')).toBeInTheDocument();
    expect(screen.getByText('-0.300')).toBeInTheDocument();
    expect(screen.getByText('B:')).toBeInTheDocument();
    expect(screen.getByText('0.800')).toBeInTheDocument();
  });

  it('hides values when showValues is false', () => {
    render(ColorWheel, {
      props: {
        values: { r: 0.5, g: -0.3, b: 0.8 },
        showValues: false
      }
    });
    
    expect(screen.queryByText('R:')).not.toBeInTheDocument();
    expect(screen.queryByText('G:')).not.toBeInTheDocument();
    expect(screen.queryByText('B:')).not.toBeInTheDocument();
  });

  it('handles pointer down events', async () => {
    const handleChange = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('change', handleChange);
    
    const canvas = screen.getByRole('slider');
    
    await fireEvent.pointerDown(canvas, {
      clientX: 150,
      clientY: 100,
      pointerId: 1
    });
    
    expect(mockCanvas.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('handles pointer move events during drag', async () => {
    const handleChange = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('change', handleChange);
    
    const canvas = screen.getByRole('slider');
    
    // Start drag
    await fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1
    });
    
    // Move pointer
    await fireEvent.pointerMove(canvas, {
      clientX: 120,
      clientY: 110,
      pointerId: 1
    });
    
    // Should trigger change event
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });
  });

  it('handles pointer up events', async () => {
    render(ColorWheel);
    
    const canvas = screen.getByRole('slider');
    
    // Start drag
    await fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1
    });
    
    // End drag
    await fireEvent.pointerUp(canvas, {
      pointerId: 1
    });
    
    expect(mockCanvas.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('handles reset button click', async () => {
    const handleReset = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('reset', handleReset);
    
    const resetButton = screen.getByTitle('Reset to default');
    await fireEvent.click(resetButton);
    
    expect(handleReset).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          wheelType: 'shadows',
          controlType: 'lift'
        }
      })
    );
  });

  it('handles fullscreen toggle', async () => {
    const handleFullscreenToggle = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('fullscreenToggle', handleFullscreenToggle);
    
    const expandButton = screen.getByTitle('Expand to fullscreen');
    await fireEvent.click(expandButton);
    
    expect(handleFullscreenToggle).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          wheelType: 'shadows',
          controlType: 'lift'
        }
      })
    );
  });

  it('renders fullscreen mode correctly', () => {
    render(ColorWheel, {
      props: {
        fullscreen: true
      }
    });
    
    expect(screen.getByTitle('Exit fullscreen')).toBeInTheDocument();
    expect(screen.queryByTitle('Expand to fullscreen')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const handleChange = vi.fn();
    
    const { component } = render(ColorWheel, {
      props: {
        values: { r: 0, g: 0, b: 0 }
      }
    });
    component.$on('change', handleChange);
    
    const canvas = screen.getByRole('slider');
    canvas.focus();
    
    // Test arrow key navigation
    await fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            values: expect.objectContaining({
              r: expect.any(Number)
            })
          })
        })
      );
    });
  });

  it('handles Home key for reset', async () => {
    const handleReset = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('reset', handleReset);
    
    const canvas = screen.getByRole('slider');
    canvas.focus();
    
    await fireEvent.keyDown(canvas, { key: 'Home' });
    
    expect(handleReset).toHaveBeenCalled();
  });

  it('handles Enter/Space for fullscreen toggle', async () => {
    const handleFullscreenToggle = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('fullscreenToggle', handleFullscreenToggle);
    
    const canvas = screen.getByRole('slider');
    canvas.focus();
    
    await fireEvent.keyDown(canvas, { key: 'Enter' });
    
    expect(handleFullscreenToggle).toHaveBeenCalled();
  });

  it('disables interactions when disabled prop is true', async () => {
    const handleChange = vi.fn();
    
    const { component } = render(ColorWheel, {
      props: {
        disabled: true
      }
    });
    component.$on('change', handleChange);
    
    const canvas = screen.getByRole('slider');
    const resetButton = screen.getByTitle('Reset to default');
    
    expect(canvas).toHaveAttribute('tabindex', '-1');
    expect(resetButton).toBeDisabled();
    
    // Pointer events should not trigger changes
    await fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1
    });
    
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('applies correct ARIA attributes', () => {
    render(ColorWheel, {
      props: {
        wheelType: 'midtones',
        controlType: 'gamma',
        values: { r: 0.5, g: 0.3, b: -0.2 }
      }
    });
    
    const canvas = screen.getByRole('slider');
    
    expect(canvas).toHaveAttribute('aria-label', 'midtones Gamma color wheel');
    expect(canvas).toHaveAttribute('aria-valuemin', '0.1');
    expect(canvas).toHaveAttribute('aria-valuemax', '3');
    expect(canvas).toHaveAttribute('aria-valuenow');
  });

  it('handles different control types with correct ranges', () => {
    const { rerender } = render(ColorWheel, {
      props: {
        controlType: 'lift',
        values: { r: 0, g: 0, b: 0 }
      }
    });
    
    let canvas = screen.getByRole('slider');
    expect(canvas).toHaveAttribute('aria-valuemin', '-1');
    expect(canvas).toHaveAttribute('aria-valuemax', '1');
    
    rerender({
      controlType: 'gamma',
      values: { r: 1, g: 1, b: 1 }
    });
    
    canvas = screen.getByRole('slider');
    expect(canvas).toHaveAttribute('aria-valuemin', '0.1');
    expect(canvas).toHaveAttribute('aria-valuemax', '3');
    
    rerender({
      controlType: 'gain',
      values: { r: 1, g: 1, b: 1 }
    });
    
    canvas = screen.getByRole('slider');
    expect(canvas).toHaveAttribute('aria-valuemin', '0.1');
    expect(canvas).toHaveAttribute('aria-valuemax', '3');
  });

  it('handles double-tap for fullscreen toggle', async () => {
    const handleFullscreenToggle = vi.fn();
    
    const { component } = render(ColorWheel);
    component.$on('fullscreenToggle', handleFullscreenToggle);
    
    const canvas = screen.getByRole('slider');
    
    // First tap
    await fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1
    });
    await fireEvent.pointerUp(canvas, { pointerId: 1 });
    
    // Second tap within 300ms
    await fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1
    });
    
    await waitFor(() => {
      expect(handleFullscreenToggle).toHaveBeenCalled();
    });
  });

  it('updates canvas size based on size prop', () => {
    const { rerender } = render(ColorWheel, {
      props: { size: 150 }
    });
    
    // Canvas should be created with the specified size
    expect(mockContext.scale).toHaveBeenCalled();
    
    rerender({ size: 300 });
    
    // Should update when size changes
    expect(mockContext.scale).toHaveBeenCalledTimes(2);
  });

  it('handles sensitivity prop for input scaling', async () => {
    const handleChange = vi.fn();
    
    const { component } = render(ColorWheel, {
      props: {
        sensitivity: 2.0
      }
    });
    component.$on('change', handleChange);
    
    const canvas = screen.getByRole('slider');
    
    await fireEvent.pointerDown(canvas, {
      clientX: 110,
      clientY: 100,
      pointerId: 1
    });
    
    // With higher sensitivity, small movements should produce larger value changes
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });
  });
});