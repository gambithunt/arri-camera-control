/**
 * LUT Storage Utility
 * Handles local storage, file operations, and LUT management
 */

import { browser } from '$app/environment';

export interface LUTInfo {
  id: string;
  name: string;
  description?: string;
  category: 'creative' | 'technical' | 'custom' | 'camera';
  format: 'cube' | '3dl' | 'csp';
  size: number; // File size in bytes
  createdAt: Date;
  modifiedAt: Date;
  thumbnail?: string; // Base64 encoded thumbnail
  metadata?: {
    author?: string;
    version?: string;
    inputColorSpace?: string;
    outputColorSpace?: string;
    lutSize?: number; // e.g., 33 for 33x33x33
  };
}

export interface LUTData {
  info: LUTInfo;
  data: string; // LUT file content
}

export interface LUTPreview {
  id: string;
  thumbnail: string;
  previewImage?: string; // Base64 encoded preview
}

class LUTStorageManager {
  private readonly STORAGE_KEY = 'arri-camera-luts';
  private readonly PREVIEW_KEY = 'arri-camera-lut-previews';
  private readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit
  private readonly SUPPORTED_FORMATS = ['.cube', '.3dl', '.csp'];

  /**
   * Get all stored LUTs
   */
  async getAllLUTs(): Promise<LUTInfo[]> {
    if (!browser) return [];

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return this.getBuiltInLUTs();

      const luts = JSON.parse(stored) as LUTInfo[];
      
      // Convert date strings back to Date objects
      return luts.map(lut => ({
        ...lut,
        createdAt: new Date(lut.createdAt),
        modifiedAt: new Date(lut.modifiedAt)
      }));
    } catch (error) {
      console.error('Error loading LUTs from storage:', error);
      return this.getBuiltInLUTs();
    }
  }

  /**
   * Get a specific LUT by ID
   */
  async getLUT(id: string): Promise<LUTData | null> {
    if (!browser) return null;

    try {
      const luts = await this.getAllLUTs();
      const lutInfo = luts.find(lut => lut.id === id);
      
      if (!lutInfo) return null;

      // For built-in LUTs, generate the data
      if (lutInfo.category === 'camera') {
        return {
          info: lutInfo,
          data: this.generateBuiltInLUTData(id)
        };
      }

      // For custom LUTs, retrieve from IndexedDB
      const data = await this.getLUTDataFromIndexedDB(id);
      if (!data) return null;

      return {
        info: lutInfo,
        data
      };
    } catch (error) {
      console.error('Error loading LUT:', error);
      return null;
    }
  }

  /**
   * Save a new LUT
   */
  async saveLUT(name: string, description: string, data: string, format: 'cube' | '3dl' | 'csp'): Promise<string> {
    if (!browser) throw new Error('Storage not available');

    const id = this.generateLUTId();
    const size = new Blob([data]).size;

    // Check storage limits
    await this.checkStorageLimit(size);

    const lutInfo: LUTInfo = {
      id,
      name,
      description,
      category: 'custom',
      format,
      size,
      createdAt: new Date(),
      modifiedAt: new Date(),
      metadata: this.parseLUTMetadata(data, format)
    };

    try {
      // Save LUT data to IndexedDB
      await this.saveLUTDataToIndexedDB(id, data);

      // Generate thumbnail
      const thumbnail = await this.generateLUTThumbnail(data, format);
      if (thumbnail) {
        lutInfo.thumbnail = thumbnail;
      }

      // Update LUT list in localStorage
      const luts = await this.getAllLUTs();
      luts.push(lutInfo);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(luts));

      return id;
    } catch (error) {
      console.error('Error saving LUT:', error);
      throw new Error('Failed to save LUT');
    }
  }

  /**
   * Delete a LUT
   */
  async deleteLUT(id: string): Promise<void> {
    if (!browser) return;

    try {
      const luts = await this.getAllLUTs();
      const lutIndex = luts.findIndex(lut => lut.id === id);
      
      if (lutIndex === -1) {
        throw new Error('LUT not found');
      }

      const lut = luts[lutIndex];
      
      // Don't allow deletion of built-in LUTs
      if (lut.category === 'camera') {
        throw new Error('Cannot delete built-in LUTs');
      }

      // Remove from IndexedDB
      await this.deleteLUTDataFromIndexedDB(id);

      // Remove from list
      luts.splice(lutIndex, 1);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(luts));

      // Remove preview
      await this.deleteLUTPreview(id);
    } catch (error) {
      console.error('Error deleting LUT:', error);
      throw error;
    }
  }

  /**
   * Update LUT metadata
   */
  async updateLUT(id: string, updates: Partial<Pick<LUTInfo, 'name' | 'description' | 'category'>>): Promise<void> {
    if (!browser) return;

    try {
      const luts = await this.getAllLUTs();
      const lutIndex = luts.findIndex(lut => lut.id === id);
      
      if (lutIndex === -1) {
        throw new Error('LUT not found');
      }

      // Update the LUT info
      luts[lutIndex] = {
        ...luts[lutIndex],
        ...updates,
        modifiedAt: new Date()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(luts));
    } catch (error) {
      console.error('Error updating LUT:', error);
      throw error;
    }
  }

  /**
   * Import LUT from file
   */
  async importLUTFromFile(file: File): Promise<string> {
    if (!browser) throw new Error('File operations not available');

    // Validate file format
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!this.SUPPORTED_FORMATS.includes(extension)) {
      throw new Error(`Unsupported LUT format: ${extension}`);
    }

    // Check file size
    if (file.size > 10 * 1024 * 1024) { // 10MB limit per file
      throw new Error('LUT file too large (max 10MB)');
    }

    try {
      const data = await this.readFileAsText(file);
      const format = extension.substring(1) as 'cube' | '3dl' | 'csp';
      const name = file.name.replace(extension, '');
      
      return await this.saveLUT(name, `Imported from ${file.name}`, data, format);
    } catch (error) {
      console.error('Error importing LUT file:', error);
      throw new Error('Failed to import LUT file');
    }
  }

  /**
   * Export LUT to file
   */
  async exportLUT(id: string): Promise<void> {
    if (!browser) return;

    try {
      const lutData = await this.getLUT(id);
      if (!lutData) {
        throw new Error('LUT not found');
      }

      const blob = new Blob([lutData.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lutData.info.name}.${lutData.info.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting LUT:', error);
      throw error;
    }
  }

  /**
   * Get LUT categories
   */
  async getCategories(): Promise<Array<{ id: string; label: string; count: number }>> {
    const luts = await this.getAllLUTs();
    const categories = new Map<string, number>();

    luts.forEach(lut => {
      categories.set(lut.category, (categories.get(lut.category) || 0) + 1);
    });

    return [
      { id: 'all', label: 'All LUTs', count: luts.length },
      { id: 'camera', label: 'Camera LUTs', count: categories.get('camera') || 0 },
      { id: 'creative', label: 'Creative', count: categories.get('creative') || 0 },
      { id: 'technical', label: 'Technical', count: categories.get('technical') || 0 },
      { id: 'custom', label: 'Custom', count: categories.get('custom') || 0 }
    ];
  }

  /**
   * Search LUTs
   */
  async searchLUTs(query: string, category?: string): Promise<LUTInfo[]> {
    const luts = await this.getAllLUTs();
    
    return luts.filter(lut => {
      const matchesQuery = !query || 
        lut.name.toLowerCase().includes(query.toLowerCase()) ||
        lut.description?.toLowerCase().includes(query.toLowerCase());
      
      const matchesCategory = !category || category === 'all' || lut.category === category;
      
      return matchesQuery && matchesCategory;
    });
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ used: number; total: number; percentage: number }> {
    if (!browser) return { used: 0, total: this.MAX_STORAGE_SIZE, percentage: 0 };

    try {
      const luts = await this.getAllLUTs();
      const used = luts.reduce((total, lut) => total + lut.size, 0);
      const percentage = (used / this.MAX_STORAGE_SIZE) * 100;

      return {
        used,
        total: this.MAX_STORAGE_SIZE,
        percentage: Math.round(percentage * 100) / 100
      };
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return { used: 0, total: this.MAX_STORAGE_SIZE, percentage: 0 };
    }
  }

  // Private methods

  private getBuiltInLUTs(): LUTInfo[] {
    return [
      {
        id: 'rec709',
        name: 'Rec.709',
        description: 'Standard Rec.709 color space',
        category: 'camera',
        format: 'cube',
        size: 1024,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01'),
        metadata: {
          inputColorSpace: 'Linear',
          outputColorSpace: 'Rec.709',
          lutSize: 33
        }
      },
      {
        id: 'arri-logc',
        name: 'ARRI LogC',
        description: 'ARRI LogC to Rec.709 conversion',
        category: 'camera',
        format: 'cube',
        size: 1024,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01'),
        metadata: {
          inputColorSpace: 'ARRI LogC',
          outputColorSpace: 'Rec.709',
          lutSize: 33
        }
      },
      {
        id: 'neutral',
        name: 'Neutral',
        description: 'No color correction applied',
        category: 'camera',
        format: 'cube',
        size: 512,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-01'),
        metadata: {
          inputColorSpace: 'Linear',
          outputColorSpace: 'Linear',
          lutSize: 17
        }
      }
    ];
  }

  private generateBuiltInLUTData(id: string): string {
    // Generate basic LUT data for built-in LUTs
    // In a real implementation, these would be actual LUT files
    switch (id) {
      case 'neutral':
        return this.generateIdentityLUT(17);
      case 'rec709':
        return this.generateRec709LUT();
      case 'arri-logc':
        return this.generateLogCLUT();
      default:
        return this.generateIdentityLUT(33);
    }
  }

  private generateIdentityLUT(size: number): string {
    let lut = `TITLE "Identity LUT"\n`;
    lut += `LUT_3D_SIZE ${size}\n\n`;
    
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);
          lut += `${rVal.toFixed(6)} ${gVal.toFixed(6)} ${bVal.toFixed(6)}\n`;
        }
      }
    }
    
    return lut;
  }

  private generateRec709LUT(): string {
    // Simplified Rec.709 LUT generation
    let lut = `TITLE "Rec.709 LUT"\n`;
    lut += `LUT_3D_SIZE 33\n\n`;
    
    for (let b = 0; b < 33; b++) {
      for (let g = 0; g < 33; g++) {
        for (let r = 0; r < 33; r++) {
          let rVal = r / 32;
          let gVal = g / 32;
          let bVal = b / 32;
          
          // Apply basic Rec.709 gamma curve
          rVal = rVal < 0.018 ? 4.5 * rVal : 1.09929682680944 * Math.pow(rVal, 0.45) - 0.099296826809442;
          gVal = gVal < 0.018 ? 4.5 * gVal : 1.09929682680944 * Math.pow(gVal, 0.45) - 0.099296826809442;
          bVal = bVal < 0.018 ? 4.5 * bVal : 1.09929682680944 * Math.pow(bVal, 0.45) - 0.099296826809442;
          
          lut += `${rVal.toFixed(6)} ${gVal.toFixed(6)} ${bVal.toFixed(6)}\n`;
        }
      }
    }
    
    return lut;
  }

  private generateLogCLUT(): string {
    // Simplified ARRI LogC to Rec.709 LUT
    let lut = `TITLE "ARRI LogC to Rec.709"\n`;
    lut += `LUT_3D_SIZE 33\n\n`;
    
    for (let b = 0; b < 33; b++) {
      for (let g = 0; g < 33; g++) {
        for (let r = 0; r < 33; r++) {
          let rVal = r / 32;
          let gVal = g / 32;
          let bVal = b / 32;
          
          // Apply LogC to Linear conversion (simplified)
          rVal = rVal > 0.1496582 ? Math.pow(10, (rVal - 0.385537) / 0.2471896) : (rVal - 0.092809) / 5.367655;
          gVal = gVal > 0.1496582 ? Math.pow(10, (gVal - 0.385537) / 0.2471896) : (gVal - 0.092809) / 5.367655;
          bVal = bVal > 0.1496582 ? Math.pow(10, (bVal - 0.385537) / 0.2471896) : (bVal - 0.092809) / 5.367655;
          
          // Apply Rec.709 gamma
          rVal = rVal < 0.018 ? 4.5 * rVal : 1.09929682680944 * Math.pow(rVal, 0.45) - 0.099296826809442;
          gVal = gVal < 0.018 ? 4.5 * gVal : 1.09929682680944 * Math.pow(gVal, 0.45) - 0.099296826809442;
          bVal = bVal < 0.018 ? 4.5 * bVal : 1.09929682680944 * Math.pow(bVal, 0.45) - 0.099296826809442;
          
          lut += `${rVal.toFixed(6)} ${gVal.toFixed(6)} ${bVal.toFixed(6)}\n`;
        }
      }
    }
    
    return lut;
  }

  private generateLUTId(): string {
    return `lut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkStorageLimit(additionalSize: number): Promise<void> {
    const storageInfo = await this.getStorageInfo();
    if (storageInfo.used + additionalSize > this.MAX_STORAGE_SIZE) {
      throw new Error('Storage limit exceeded. Please delete some LUTs to free up space.');
    }
  }

  private parseLUTMetadata(data: string, format: string): LUTInfo['metadata'] {
    const metadata: LUTInfo['metadata'] = {};
    
    if (format === 'cube') {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('TITLE')) {
          metadata.version = line.replace('TITLE', '').trim().replace(/"/g, '');
        } else if (line.startsWith('LUT_3D_SIZE')) {
          metadata.lutSize = parseInt(line.split(' ')[1]);
        }
      }
    }
    
    return metadata;
  }

  private async generateLUTThumbnail(data: string, format: string): Promise<string | undefined> {
    // Generate a simple color gradient thumbnail
    // In a real implementation, this would apply the LUT to a test image
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return undefined;
      
      // Create a simple gradient
      const gradient = ctx.createLinearGradient(0, 0, 64, 64);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.5, '#808080');
      gradient.addColorStop(1, '#ffffff');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating LUT thumbnail:', error);
      return undefined;
    }
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // IndexedDB operations for large LUT data storage
  private async saveLUTDataToIndexedDB(id: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ArriCameraLUTs', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('luts')) {
          db.createObjectStore('luts', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['luts'], 'readwrite');
        const store = transaction.objectStore('luts');
        
        const putRequest = store.put({ id, data });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to save LUT data'));
      };
    });
  }

  private async getLUTDataFromIndexedDB(id: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ArriCameraLUTs', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['luts'], 'readonly');
        const store = transaction.objectStore('luts');
        
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.data : null);
        };
        getRequest.onerror = () => reject(new Error('Failed to get LUT data'));
      };
    });
  }

  private async deleteLUTDataFromIndexedDB(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ArriCameraLUTs', 1);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['luts'], 'readwrite');
        const store = transaction.objectStore('luts');
        
        const deleteRequest = store.delete(id);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(new Error('Failed to delete LUT data'));
      };
    });
  }

  private async deleteLUTPreview(id: string): Promise<void> {
    try {
      const previews = JSON.parse(localStorage.getItem(this.PREVIEW_KEY) || '{}');
      delete previews[id];
      localStorage.setItem(this.PREVIEW_KEY, JSON.stringify(previews));
    } catch (error) {
      console.error('Error deleting LUT preview:', error);
    }
  }
}

// Export singleton instance
export const lutStorage = new LUTStorageManager();