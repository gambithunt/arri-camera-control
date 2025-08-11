/**
 * LUTManager Component Tests
 * Tests for the LUT management component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import LUTManager from '../LUTManager.svelte';

// Mock dependencies
vi.mock('$lib/utils/lutStorage', () => ({
  lutStorage: {
    getAllLUTs: vi.fn().mockResolvedValue([]),
    saveLUT: vi.fn().mockResolvedValue('lut-id'),
    loadLUT: vi.fn().mockResolvedValue({}),
    deleteLUT: vi.fn().mockResolvedValue(undefined),
    exportLUT: vi.fn().mockResolvedValue('lut-data'),
    importLUT: vi.fn().mockResolvedValue('imported-lut-id')
  }
}));

vi.mock('$lib/utils/responsiveLayout', () => ({
  screenInfo: writable({
    deviceType: 'desktop',
    screenSize: 'lg',
    orientation: 'landscape'
  })
}));

vi.mock('$lib/utils/touchInteractions', () => ({
  triggerHaptic: vi.fn()
}));

vi.mock('$lib/utils/errorManager', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  handleValidationError: vi.fn()
}));

vi.mock('$lib/api/cameraApi', () => ({
  cameraApi: {
    loadLUT: vi.fn().mockResolvedValue({ success: true }),
    saveLUT: vi.fn().mockResolvedValue({ success: true, data: { name: 'saved-lut' } })
  }
}));

describe('LUTManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render LUT manager interface', () => {
      render(LUTManager);
      
      expect(screen.getByText('LUT Manager')).toBeInTheDocument();
      expect(screen.getByText('Save Current LUT')).toBeInTheDocument();
      expect(screen.getByText('Import LUT')).toBeInTheDocument();
    });

    it('should show loading state initially', async () => {
      render(LUTManager);
      
      expect(screen.getByText('Loading LUTs...')).toBeInTheDocument();
    });

    it('should show empty state when no LUTs', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue([]);
      
      render(LUTManager);
      
      await waitFor(() => {
        expect(screen.getByText('No LUTs Available')).toBeInTheDocument();
        expect(screen.getByText('Save your first LUT to get started')).toBeInTheDocument();
      });
    });
  });

  describe('LUT List', () => {
    it('should display available LUTs', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Cinematic Look',
          description: 'Warm cinematic grading',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        },
        {
          id: 'lut-2',
          name: 'Cool Tone',
          description: 'Cool blue grading',
          createdAt: Date.now() - 86400000,
          size: 2048,
          type: 'cube'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        expect(screen.getByText('Cinematic Look')).toBeInTheDocument();
        expect(screen.getByText('Cool Tone')).toBeInTheDocument();
        expect(screen.getByText('Warm cinematic grading')).toBeInTheDocument();
        expect(screen.getByText('Cool blue grading')).toBeInTheDocument();
      });
    });

    it('should show LUT metadata', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        expect(screen.getByText('CDL')).toBeInTheDocument();
        expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      });
    });
  });

  describe('Save LUT', () => {
    it('should show save LUT dialog', async () => {
      render(LUTManager);
      
      const saveButton = screen.getByText('Save Current LUT');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Save LUT')).toBeInTheDocument();
        expect(screen.getByLabelText('LUT Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
      });
    });

    it('should validate LUT name input', async () => {
      const { handleValidationError } = await import('$lib/utils/errorManager');
      
      render(LUTManager);
      
      const saveButton = screen.getByText('Save Current LUT');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText('LUT Name');
        const saveDialogButton = screen.getByText('Save');
        
        // Try to save without name
        fireEvent.click(saveDialogButton);
        
        expect(handleValidationError).toHaveBeenCalledWith(
          'name',
          '',
          'LUT name is required'
        );
      });
    });

    it('should save LUT with valid input', async () => {
      const { cameraApi } = await import('$lib/api/cameraApi');
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const { showSuccess, triggerHaptic } = await import('$lib/utils/errorManager');
      
      render(LUTManager);
      
      const saveButton = screen.getByText('Save Current LUT');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText('LUT Name');
        const descriptionInput = screen.getByLabelText('Description');
        const saveDialogButton = screen.getByText('Save');
        
        fireEvent.input(nameInput, { target: { value: 'My Custom LUT' } });
        fireEvent.input(descriptionInput, { target: { value: 'Custom description' } });
        fireEvent.click(saveDialogButton);
        
        expect(cameraApi.saveLUT).toHaveBeenCalledWith('My Custom LUT');
      });
    });

    it('should handle save errors', async () => {
      const { cameraApi } = await import('$lib/api/cameraApi');
      const { showError } = await import('$lib/utils/errorManager');
      
      vi.mocked(cameraApi.saveLUT).mockResolvedValue({
        success: false,
        error: 'Save failed'
      });
      
      render(LUTManager);
      
      const saveButton = screen.getByText('Save Current LUT');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText('LUT Name');
        const saveDialogButton = screen.getByText('Save');
        
        fireEvent.input(nameInput, { target: { value: 'Test LUT' } });
        fireEvent.click(saveDialogButton);
        
        expect(showError).toHaveBeenCalledWith(
          'Save Failed',
          'Failed to save LUT: Save failed'
        );
      });
    });
  });

  describe('Load LUT', () => {
    it('should load LUT when clicked', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const { cameraApi } = await import('$lib/api/cameraApi');
      const { triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        const loadButton = screen.getByText('Load');
        fireEvent.click(loadButton);
        
        expect(triggerHaptic).toHaveBeenCalledWith({ type: 'medium' });
        expect(cameraApi.loadLUT).toHaveBeenCalledWith('lut-1');
      });
    });

    it('should handle load errors', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const { cameraApi } = await import('$lib/api/cameraApi');
      const { showError } = await import('$lib/utils/errorManager');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      vi.mocked(cameraApi.loadLUT).mockResolvedValue({
        success: false,
        error: 'Load failed'
      });
      
      render(LUTManager);
      
      await waitFor(() => {
        const loadButton = screen.getByText('Load');
        fireEvent.click(loadButton);
        
        expect(showError).toHaveBeenCalledWith(
          'Load Failed',
          'Failed to load LUT: Load failed'
        );
      });
    });
  });

  describe('Delete LUT', () => {
    it('should show delete confirmation', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);
        
        expect(screen.getByText('Delete LUT')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to delete "Test LUT"?')).toBeInTheDocument();
      });
    });

    it('should delete LUT when confirmed', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const { showSuccess, triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);
        
        const confirmButton = screen.getByText('Delete');
        fireEvent.click(confirmButton);
        
        expect(lutStorage.deleteLUT).toHaveBeenCalledWith('lut-1');
      });
    });
  });

  describe('Import LUT', () => {
    it('should show import dialog', async () => {
      render(LUTManager);
      
      const importButton = screen.getByText('Import LUT');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import LUT File')).toBeInTheDocument();
        expect(screen.getByText('Choose File')).toBeInTheDocument();
      });
    });

    it('should handle file selection', async () => {
      render(LUTManager);
      
      const importButton = screen.getByText('Import LUT');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        const fileInput = screen.getByLabelText('LUT File');
        const mockFile = new File(['lut content'], 'test.cube', { type: 'text/plain' });
        
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
        
        expect(screen.getByText('test.cube')).toBeInTheDocument();
      });
    });

    it('should validate file type', async () => {
      const { handleValidationError } = await import('$lib/utils/errorManager');
      
      render(LUTManager);
      
      const importButton = screen.getByText('Import LUT');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        const fileInput = screen.getByLabelText('LUT File');
        const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
        
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
        
        expect(handleValidationError).toHaveBeenCalledWith(
          'file',
          'test.txt',
          'Only .cube and .3dl files are supported'
        );
      });
    });
  });

  describe('Export LUT', () => {
    it('should export LUT when clicked', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      const { showSuccess } = await import('$lib/utils/errorManager');
      
      // Mock URL.createObjectURL and document.createElement
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockClick = vi.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      vi.mocked(lutStorage.exportLUT).mockResolvedValue('lut-data');
      
      render(LUTManager);
      
      await waitFor(() => {
        const exportButton = screen.getByText('Export');
        fireEvent.click(exportButton);
        
        expect(lutStorage.exportLUT).toHaveBeenCalledWith('lut-1');
        expect(mockClick).toHaveBeenCalled();
        expect(showSuccess).toHaveBeenCalledWith(
          'Export Complete',
          'LUT exported successfully'
        );
      });
    });
  });

  describe('Search and Filter', () => {
    it('should filter LUTs by search term', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Cinematic Look',
          description: 'Warm cinematic grading',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        },
        {
          id: 'lut-2',
          name: 'Cool Tone',
          description: 'Cool blue grading',
          createdAt: Date.now(),
          size: 2048,
          type: 'cube'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search LUTs...');
        fireEvent.input(searchInput, { target: { value: 'cinematic' } });
        
        expect(screen.getByText('Cinematic Look')).toBeInTheDocument();
        expect(screen.queryByText('Cool Tone')).not.toBeInTheDocument();
      });
    });

    it('should filter LUTs by type', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'CDL LUT',
          type: 'cdl',
          createdAt: Date.now(),
          size: 1024
        },
        {
          id: 'lut-2',
          name: 'Cube LUT',
          type: 'cube',
          createdAt: Date.now(),
          size: 2048
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        const typeFilter = screen.getByLabelText('Filter by type');
        fireEvent.change(typeFilter, { target: { value: 'cdl' } });
        
        expect(screen.getByText('CDL LUT')).toBeInTheDocument();
        expect(screen.queryByText('Cube LUT')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile layout', async () => {
      const { screenInfo } = await import('$lib/utils/responsiveLayout');
      screenInfo.set({
        deviceType: 'phone',
        screenSize: 'sm',
        orientation: 'portrait'
      });
      
      render(LUTManager);
      
      // Should adapt layout for mobile
      expect(screen.getByText('LUT Manager')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(LUTManager);
      
      expect(screen.getByLabelText('Search LUTs')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const { lutStorage } = await import('$lib/utils/lutStorage');
      
      const mockLUTs = [
        {
          id: 'lut-1',
          name: 'Test LUT',
          description: 'Test description',
          createdAt: Date.now(),
          size: 1024,
          type: 'cdl'
        }
      ];
      
      vi.mocked(lutStorage.getAllLUTs).mockResolvedValue(mockLUTs);
      
      render(LUTManager);
      
      await waitFor(() => {
        const loadButton = screen.getByText('Load');
        expect(loadButton).toHaveAttribute('tabindex');
      });
    });
  });
});