/**
 * Camera API Client
 * High-level API for camera control operations via WebSocket
 */

import { socketClient } from '../websocket/socketClient';
import { writable, type Writable } from 'svelte/store';
import { 
  handleCAPError, 
  handleConnectionError, 
  handleNetworkError, 
  showError, 
  showSuccess,
  showWarning,
  type ErrorContext 
} from '$lib/utils/errorManager';
import {
  updateWebSocketStatus,
  updateCameraStatus,
  logProtocolMessage
} from '$lib/utils/connectionDiagnostics';

export interface CameraState {
  connected: boolean;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  frameRate: number;
  whiteBalance: {
    kelvin: number;
    tint: number;
  };
  iso: number;
  ndFilter: number;
  frameLinesEnabled: boolean;
  currentLUT: string;
  recording: boolean;
  currentTimecode: string;
  timecodeMode: string;
  userBits: string;
  timecode: {
    current: string;
    mode: string;
    syncStatus: string;
  };
  cdlValues?: CDLValues;
}

export interface PlaybackState {
  isInPlaybackMode: boolean;
  currentClip: any | null;
  playbackStatus: 'stopped' | 'playing' | 'paused';
  currentPosition: number;
  totalFrames: number;
  playbackSpeed: number;
  clipList: any[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface CDLValues {
  shadows: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
  midtones: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
  highlights: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
}

class CameraApiClient {
  private socket: any;
  
  // Reactive stores
  public cameraState: Writable<CameraState>;
  public playbackState: Writable<PlaybackState>;
  public connectionStatus = socketClient.connectionStatus;

  constructor(socket: any = socketClient) {
    this.socket = socket;
    
    // Initialize stores
    this.cameraState = writable<CameraState>({
      connected: false,
      model: '',
      serialNumber: '',
      firmwareVersion: '',
      frameRate: 24,
      whiteBalance: { kelvin: 5600, tint: 0 },
      iso: 800,
      ndFilter: 0,
      frameLinesEnabled: false,
      currentLUT: 'Rec709',
      recording: false,
      currentTimecode: '00:00:00:00',
      timecodeMode: 'free_run',
      userBits: '00:00:00:00',
      timecode: { current: '00:00:00:00', mode: 'free_run', syncStatus: 'synced' }
    });

    this.playbackState = writable<PlaybackState>({
      isInPlaybackMode: false,
      currentClip: null,
      playbackStatus: 'stopped',
      currentPosition: 0,
      totalFrames: 0,
      playbackSpeed: 1.0,
      clipList: []
    });

    this.setupEventHandlers();
  }

  /**
   * Connect to camera
   */
  async connect(cameraIP?: string): Promise<ApiResponse> {
    const context: ErrorContext = {
      component: 'CameraApiClient',
      operation: 'connect',
      additionalData: { cameraIP }
    };

    try {
      // Update WebSocket status
      updateWebSocketStatus('connecting');
      
      // First connect to WebSocket server
      const socketConnected = await this.socket.connect();
      if (!socketConnected) {
        updateWebSocketStatus('error', 'Failed to connect to WebSocket server');
        const error = handleConnectionError('Failed to connect to WebSocket server', context);
        return {
          success: false,
          error: error.userMessage || error.message,
          code: error.code
        };
      }
      
      updateWebSocketStatus('connected');

      // Then connect to camera
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          const error = handleCAPError('CAP_001', 'Camera connection timeout', context);
          resolve({
            success: false,
            error: error.userMessage || error.message,
            code: error.code
          });
        }, 10000);

        this.socket.once('camera:connect:success', (data: any) => {
          clearTimeout(timeout);
          
          // Update camera status
          updateCameraStatus('connected');
          
          // Log protocol message
          logProtocolMessage('received', 'cap', 'camera:connect:success', data);
          
          this.updateCameraState({
            connected: true,
            model: data.model || 'ARRI Camera',
            serialNumber: data.serialNumber || '',
            firmwareVersion: data.firmwareVersion || ''
          });
          
          showSuccess(
            'Camera Connected',
            `Successfully connected to ${data.model || 'ARRI Camera'}`
          );
          
          resolve({
            success: true,
            data
          });
        });

        this.socket.once('camera:connect:error', (data: any) => {
          clearTimeout(timeout);
          const error = handleCAPError(
            data.code || 'CAP_002', 
            data.details || 'Camera connection failed', 
            context
          );
          
          resolve({
            success: false,
            error: error.userMessage || error.message,
            code: error.code
          });
        });

        this.socket.emit('camera:connect', { ip: cameraIP });
      });
    } catch (error) {
      const appError = handleConnectionError(
        error instanceof Error ? error.message : 'Unknown connection error',
        context
      );
      
      return {
        success: false,
        error: appError.userMessage || appError.message,
        code: appError.code
      };
    }
  }

  /**
   * Disconnect from camera
   */
  async disconnect(): Promise<ApiResponse> {
    try {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Disconnect timeout'
          });
        }, 5000);

        this.socket.once('camera:disconnect:success', () => {
          clearTimeout(timeout);
          this.updateCameraState({ connected: false });
          resolve({ success: true });
        });

        this.socket.once('camera:disconnect:error', (data) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: data.message || 'Disconnect failed'
          });
        });

        this.socket.emit('camera:disconnect');
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set frame rate
   */
  async setFrameRate(frameRate: number): Promise<ApiResponse> {
    return this.sendCameraCommand('camera:frameRate:set', { frameRate }, 'camera:frameRate:success', 'camera:frameRate:error');
  }

  /**
   * Set white balance
   */
  async setWhiteBalance(kelvin: number, tint?: number): Promise<ApiResponse> {
    const data: any = { kelvin };
    if (tint !== undefined) {
      data.tint = tint;
    }
    return this.sendCameraCommand('camera:whiteBalance:set', data, 'camera:whiteBalance:success', 'camera:whiteBalance:error');
  }

  /**
   * Set ISO
   */
  async setISO(iso: number): Promise<ApiResponse> {
    return this.sendCameraCommand('camera:iso:set', { iso }, 'camera:iso:success', 'camera:iso:error');
  }

  /**
   * Set ND filter
   */
  async setNDFilter(ndStop: number): Promise<ApiResponse> {
    return this.sendCameraCommand('camera:ndFilter:set', { ndStop }, 'camera:ndFilter:success', 'camera:ndFilter:error');
  }

  /**
   * Set frame lines
   */
  async setFrameLines(enabled: boolean): Promise<ApiResponse> {
    return this.sendCameraCommand('camera:frameLines:set', { enabled }, 'camera:frameLines:success', 'camera:frameLines:error');
  }

  /**
   * Set LUT
   */
  async setLUT(lutName: string): Promise<ApiResponse> {
    return this.sendCameraCommand('camera:lut:set', { lutName }, 'camera:lut:success', 'camera:lut:error');
  }

  /**
   * Playback control methods
   */
  async enterPlaybackMode(): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:enter', {}, 'playback:enter:success', 'playback:enter:error');
  }

  async exitPlaybackMode(): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:exit', {}, 'playback:exit:success', 'playback:exit:error');
  }

  async getClipList(refresh = false): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:clipList:get', { refresh }, 'playback:clipList:success', 'playback:clipList:error');
  }

  async startPlayback(clipIndex?: number): Promise<ApiResponse> {
    const data = clipIndex !== undefined ? { clipIndex } : {};
    return this.sendCameraCommand('playback:start', data, 'playback:start:success', 'playback:start:error');
  }

  async pausePlayback(): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:pause', {}, 'playback:pause:success', 'playback:pause:error');
  }

  async setPlaybackSpeed(speed: number): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:speed:set', { speed }, 'playback:speed:success', 'playback:speed:error');
  }

  async shuttlePlayback(position: number): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:shuttle', { position }, 'playback:shuttle:success', 'playback:shuttle:error');
  }

  async skipToClip(clipIndex: number): Promise<ApiResponse> {
    return this.sendCameraCommand('playback:clip:skip', { clipIndex }, 'playback:clipSkip:success', 'playback:clipSkip:error');
  }

  /**
   * Timecode control methods
   */
  async setTimecode(timecode: string): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:set', { timecode }, 'timecode:set:success', 'timecode:set:error');
  }

  async setTimecodeMode(mode: string): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:setMode', { mode }, 'timecode:setMode:success', 'timecode:setMode:error');
  }

  async syncTimecode(): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:sync', {}, 'timecode:sync:success', 'timecode:sync:error');
  }

  async syncTimecodeToTimeOfDay(): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:syncToTimeOfDay', {}, 'timecode:syncToTimeOfDay:success', 'timecode:syncToTimeOfDay:error');
  }

  async setUserBits(userBits: string): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:setUserBits', { userBits }, 'timecode:setUserBits:success', 'timecode:setUserBits:error');
  }

  async getSyncStatus(): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:getSyncStatus', {}, 'timecode:syncStatus:success', 'timecode:syncStatus:error');
  }

  async manualSync(): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:manualSync', {}, 'timecode:manualSync:success', 'timecode:manualSync:error');
  }

  async getSyncDiagnostics(): Promise<ApiResponse> {
    return this.sendCameraCommand('timecode:getDiagnostics', {}, 'timecode:diagnostics:success', 'timecode:diagnostics:error');
  }

  /**
   * Color grading methods
   */
  async setCDL(cdlValues: CDLValues): Promise<ApiResponse> {
    return this.sendCameraCommand('grading:setCDL', { cdl: cdlValues }, 'grading:setCDL:success', 'grading:setCDL:error');
  }

  async resetCDL(): Promise<ApiResponse> {
    return this.sendCameraCommand('grading:resetCDL', {}, 'grading:resetCDL:success', 'grading:resetCDL:error');
  }

  async getCDL(): Promise<ApiResponse> {
    return this.sendCameraCommand('grading:getCDL', {}, 'grading:getCDL:success', 'grading:getCDL:error');
  }

  async saveLUT(name: string): Promise<ApiResponse> {
    return this.sendCameraCommand('grading:saveLUT', { name }, 'grading:saveLUT:success', 'grading:saveLUT:error');
  }

  async loadLUT(lutId: string): Promise<ApiResponse> {
    return this.sendCameraCommand('grading:loadLUT', { lutId }, 'grading:loadLUT:success', 'grading:loadLUT:error');
  }

  /**
   * Generic camera command sender
   */
  private async sendCameraCommand(
    command: string,
    data: any,
    successEvent: string,
    errorEvent: string,
    timeout = 5000
  ): Promise<ApiResponse> {
    const context: ErrorContext = {
      component: 'CameraApiClient',
      operation: command,
      additionalData: { command, data }
    };

    if (!this.socket.isConnected()) {
      const error = handleConnectionError('Not connected to camera server', context);
      return {
        success: false,
        error: error.userMessage || error.message,
        code: error.code
      };
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const error = handleCAPError('CAP_009', `Command ${command} timed out`, context);
        resolve({
          success: false,
          error: error.userMessage || error.message,
          code: error.code
        });
      }, timeout);

      this.socket.once(successEvent, (response: any) => {
        clearTimeout(timeoutId);
        
        // Show success notification for important operations
        if (this.shouldShowSuccessNotification(command)) {
          showSuccess(
            'Command Successful',
            this.getSuccessMessage(command, response)
          );
        }
        
        resolve({
          success: true,
          data: response
        });
      });

      this.socket.once(errorEvent, (response: any) => {
        clearTimeout(timeoutId);
        
        const error = handleCAPError(
          response.code || 'CAP_002',
          response.details || response.message || 'Command failed',
          context
        );
        
        resolve({
          success: false,
          error: error.userMessage || error.message,
          code: error.code
        });
      });

      this.socket.emit(command, data);
    });
  }

  /**
   * Determine if success notification should be shown
   */
  private shouldShowSuccessNotification(command: string): boolean {
    const importantCommands = [
      'camera:connect',
      'camera:disconnect',
      'playback:enter',
      'playback:exit',
      'timecode:sync',
      'grading:saveLUT',
      'grading:loadLUT'
    ];
    return importantCommands.includes(command);
  }

  /**
   * Get success message for command
   */
  private getSuccessMessage(command: string, response: any): string {
    switch (command) {
      case 'camera:frameRate:set':
        return `Frame rate set to ${response.frameRate} fps`;
      case 'camera:whiteBalance:set':
        return `White balance set to ${response.kelvin}K`;
      case 'camera:iso:set':
        return `ISO set to ${response.iso}`;
      case 'camera:ndFilter:set':
        return `ND filter set to ${response.ndStop} stops`;
      case 'camera:lut:set':
        return `LUT changed to ${response.lutName}`;
      case 'playback:enter':
        return 'Entered playback mode';
      case 'playback:exit':
        return 'Exited playback mode';
      case 'timecode:sync':
        return 'Timecode synchronized';
      case 'grading:saveLUT':
        return `LUT saved as ${response.name}`;
      case 'grading:loadLUT':
        return `LUT ${response.name} loaded`;
      default:
        return 'Operation completed successfully';
    }
  }

  /**
   * Setup event handlers for real-time updates
   */
  private setupEventHandlers(): void {
    // Camera state updates
    this.socket.on('camera:frameRate:changed', (data) => {
      this.updateCameraState({ frameRate: data.frameRate });
    });

    this.socket.on('camera:whiteBalance:changed', (data) => {
      this.updateCameraState({ whiteBalance: data.whiteBalance });
    });

    this.socket.on('camera:iso:changed', (data) => {
      this.updateCameraState({ iso: data.iso });
    });

    this.socket.on('camera:ndFilter:changed', (data) => {
      this.updateCameraState({ ndFilter: data.ndStop });
    });

    this.socket.on('camera:frameLines:changed', (data) => {
      this.updateCameraState({ frameLinesEnabled: data.enabled });
    });

    this.socket.on('camera:lut:changed', (data) => {
      this.updateCameraState({ currentLUT: data.lutName });
    });

    // Timecode state updates
    this.socket.on('timecode:changed', (data) => {
      this.cameraState.update(current => ({
        ...current,
        currentTimecode: data.current,
        timecode: {
          ...current.timecode,
          current: data.current,
          mode: data.mode || current.timecode.mode,
          syncStatus: 'synced'
        }
      }));
    });

    this.socket.on('timecode:mode:changed', (data) => {
      this.cameraState.update(current => ({
        ...current,
        timecodeMode: data.mode,
        timecode: {
          ...current.timecode,
          mode: data.mode,
          syncStatus: 'synced'
        }
      }));
    });

    this.socket.on('timecode:userBits:changed', (data) => {
      this.updateCameraState({ userBits: data.userBits });
    });

    // Timecode sync status updates
    this.socket.on('timecode:syncStatus:changed', (data) => {
      this.cameraState.update(current => ({
        ...current,
        timecode: {
          ...current.timecode,
          syncStatus: data.syncStatus
        }
      }));
    });

    // Color grading updates
    this.socket.on('grading:cdl:changed', (data) => {
      this.updateCameraState({ cdlValues: data.cdl });
    });

    // Playback state updates
    this.socket.on('playback:mode:changed', (data) => {
      this.updatePlaybackState({ isInPlaybackMode: data.isInPlaybackMode });
    });

    this.socket.on('playback:status:changed', (data) => {
      this.updatePlaybackState({
        playbackStatus: data.status,
        currentClip: data.currentClip,
        playbackSpeed: data.speed
      });
    });

    this.socket.on('playback:position:changed', (data) => {
      this.updatePlaybackState({
        currentPosition: data.position,
        totalFrames: data.totalFrames
      });
    });

    this.socket.on('playback:clip:changed', (data) => {
      this.updatePlaybackState({
        currentClip: data.currentClip,
        currentPosition: data.position || 0
      });
    });

    this.socket.on('playback:clipList:success', (data) => {
      this.updatePlaybackState({ clipList: data.clips });
    });

    // Connection status updates
    this.socket.on('disconnect', () => {
      this.updateCameraState({ connected: false });
      this.updatePlaybackState({
        isInPlaybackMode: false,
        playbackStatus: 'stopped',
        currentClip: null
      });
      
      showWarning(
        'Camera Disconnected',
        'Connection to camera has been lost. Attempting to reconnect...'
      );
    });

    // Handle connection errors
    this.socket.on('connect_error', (error: any) => {
      handleConnectionError(
        'Failed to connect to camera server',
        {
          component: 'CameraApiClient',
          operation: 'socket_connect',
          additionalData: { error: error.message }
        }
      );
    });

    // Handle CAP protocol errors
    this.socket.on('cap:error', (data: any) => {
      handleCAPError(
        data.code || 'CAP_000',
        data.message || 'CAP protocol error',
        {
          component: 'CameraApiClient',
          operation: 'cap_protocol',
          additionalData: data
        }
      );
    });
  }

  /**
   * Update camera state
   */
  private updateCameraState(updates: Partial<CameraState>): void {
    this.cameraState.update(current => ({
      ...current,
      ...updates
    }));
  }

  /**
   * Update playback state
   */
  private updatePlaybackState(updates: Partial<PlaybackState>): void {
    this.playbackState.update(current => ({
      ...current,
      ...updates
    }));
  }

  /**
   * Get current camera state (non-reactive)
   */
  getCurrentCameraState(): Promise<CameraState> {
    return new Promise((resolve) => {
      const unsubscribe = this.cameraState.subscribe((state) => {
        unsubscribe();
        resolve(state);
      });
    });
  }

  /**
   * Get current playback state (non-reactive)
   */
  getCurrentPlaybackState(): Promise<PlaybackState> {
    return new Promise((resolve) => {
      const unsubscribe = this.playbackState.subscribe((state) => {
        unsubscribe();
        resolve(state);
      });
    });
  }
}

// Export singleton instance
export const cameraApi = new CameraApiClient();

/**
 * Initialize camera API with custom socket client
 */
export function initializeCameraApi(socket?: any): CameraApiClient {
  if (socket) {
    return new CameraApiClient(socket);
  }
  return cameraApi;
}