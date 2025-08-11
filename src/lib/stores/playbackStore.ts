/**
 * Playback State Store
 * Manages playback mode, clips, and transport controls
 */

import { writable, derived } from 'svelte/store';
import { createAsyncStore } from './storeUtils';

export interface ClipInfo {
  id: string;
  index: number;
  name: string;
  duration: string;
  totalFrames: number;
  resolution: string;
  codec: string;
  frameRate: number;
  size: string;
  timestamp: string;
  thumbnail?: string;
}

export interface PlaybackState {
  // Playback mode
  isInPlaybackMode: boolean;
  enteringPlaybackMode: boolean;
  
  // Current clip
  currentClip: ClipInfo | null;
  currentClipIndex: number;
  
  // Transport state
  playbackStatus: 'stopped' | 'playing' | 'paused';
  playbackSpeed: number;
  currentPosition: number; // in frames
  currentTimecode: string;
  
  // Clip list
  clipList: ClipInfo[];
  totalClips: number;
  clipListLoading: boolean;
  clipListLastRefresh: Date | null;
  
  // Playback capabilities
  supportedSpeeds: number[];
  canSeek: boolean;
  canSkipClips: boolean;
  
  // Playback statistics and health
  playbackStats?: {
    totalPlayTime: number;
    framesPlayed: number;
    averageFrameRate: number;
    droppedFrames: number;
    lastFrameTime: number;
  };
  bufferHealth?: number;
  
  // Metadata
  lastUpdate: Date | null;
}

const initialPlaybackState: PlaybackState = {
  isInPlaybackMode: false,
  enteringPlaybackMode: false,
  currentClip: null,
  currentClipIndex: -1,
  playbackStatus: 'stopped',
  playbackSpeed: 1.0,
  currentPosition: 0,
  currentTimecode: '00:00:00:00',
  clipList: [],
  totalClips: 0,
  clipListLoading: false,
  clipListLastRefresh: null,
  supportedSpeeds: [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4],
  canSeek: true,
  canSkipClips: true,
  lastUpdate: null
};

// Main playback state store
const playbackState = writable<PlaybackState>(initialPlaybackState);

// Async operations store
const playbackOperations = createAsyncStore({
  lastCommand: null as string | null,
  pendingCommands: [] as string[]
});

// Derived stores for specific aspects
const playbackMode = derived(
  playbackState,
  ($playback) => ({
    isInPlaybackMode: $playback.isInPlaybackMode,
    enteringPlaybackMode: $playback.enteringPlaybackMode
  })
);

const transportState = derived(
  playbackState,
  ($playback) => ({
    status: $playback.playbackStatus,
    speed: $playback.playbackSpeed,
    position: $playback.currentPosition,
    timecode: $playback.currentTimecode,
    canSeek: $playback.canSeek
  })
);

const currentClipInfo = derived(
  playbackState,
  ($playback) => ({
    clip: $playback.currentClip,
    index: $playback.currentClipIndex,
    totalClips: $playback.totalClips,
    canSkipClips: $playback.canSkipClips
  })
);

const clipBrowser = derived(
  playbackState,
  ($playback) => ({
    clips: $playback.clipList,
    totalClips: $playback.totalClips,
    loading: $playback.clipListLoading,
    lastRefresh: $playback.clipListLastRefresh
  })
);

const playbackProgress = derived(
  playbackState,
  ($playback) => {
    if (!$playback.currentClip) {
      return {
        position: 0,
        duration: 0,
        percentage: 0,
        remaining: 0
      };
    }

    const duration = $playback.currentClip.totalFrames;
    const position = $playback.currentPosition;
    const percentage = duration > 0 ? (position / duration) * 100 : 0;
    const remaining = Math.max(0, duration - position);

    return {
      position,
      duration,
      percentage,
      remaining
    };
  }
);

// Store actions
const playbackActions = {
  /**
   * Set playback mode
   */
  setPlaybackMode(isInPlaybackMode: boolean, entering: boolean = false) {
    playbackState.update(state => ({
      ...state,
      isInPlaybackMode,
      enteringPlaybackMode: entering,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update clip list
   */
  updateClipList(clips: ClipInfo[], loading: boolean = false) {
    playbackState.update(state => ({
      ...state,
      clipList: clips,
      totalClips: clips.length,
      clipListLoading: loading,
      clipListLastRefresh: loading ? state.clipListLastRefresh : new Date(),
      lastUpdate: new Date()
    }));
  },

  /**
   * Set current clip
   */
  setCurrentClip(clip: ClipInfo | null, index: number = -1) {
    playbackState.update(state => ({
      ...state,
      currentClip: clip,
      currentClipIndex: index,
      currentPosition: 0, // Reset position when changing clips
      currentTimecode: '00:00:00:00',
      lastUpdate: new Date()
    }));
  },

  /**
   * Update transport state
   */
  updateTransport(updates: Partial<Pick<PlaybackState, 'playbackStatus' | 'playbackSpeed' | 'currentPosition' | 'currentTimecode'>>) {
    playbackState.update(state => ({
      ...state,
      ...updates,
      lastUpdate: new Date()
    }));
  },

  /**
   * Set playback position
   */
  setPosition(position: number, timecode?: string) {
    playbackState.update(state => ({
      ...state,
      currentPosition: position,
      currentTimecode: timecode || state.currentTimecode,
      lastUpdate: new Date()
    }));
  },

  /**
   * Skip to clip by index
   */
  skipToClip(index: number) {
    playbackState.update(state => {
      const clip = state.clipList[index];
      if (!clip) return state;

      return {
        ...state,
        currentClip: clip,
        currentClipIndex: index,
        currentPosition: 0,
        currentTimecode: '00:00:00:00',
        lastUpdate: new Date()
      };
    });
  },

  /**
   * Skip to next clip
   */
  skipToNext() {
    playbackState.update(state => {
      const nextIndex = state.currentClipIndex + 1;
      if (nextIndex >= state.clipList.length) return state;

      const nextClip = state.clipList[nextIndex];
      return {
        ...state,
        currentClip: nextClip,
        currentClipIndex: nextIndex,
        currentPosition: 0,
        currentTimecode: '00:00:00:00',
        lastUpdate: new Date()
      };
    });
  },

  /**
   * Skip to previous clip
   */
  skipToPrevious() {
    playbackState.update(state => {
      const prevIndex = state.currentClipIndex - 1;
      if (prevIndex < 0) return state;

      const prevClip = state.clipList[prevIndex];
      return {
        ...state,
        currentClip: prevClip,
        currentClipIndex: prevIndex,
        currentPosition: 0,
        currentTimecode: '00:00:00:00',
        lastUpdate: new Date()
      };
    });
  },

  /**
   * Update playback capabilities
   */
  updateCapabilities(capabilities: Partial<Pick<PlaybackState, 'supportedSpeeds' | 'canSeek' | 'canSkipClips'>>) {
    playbackState.update(state => ({
      ...state,
      ...capabilities,
      lastUpdate: new Date()
    }));
  },

  /**
   * Reset playback state
   */
  reset() {
    playbackState.set(initialPlaybackState);
  },

  /**
   * Exit playback mode and reset
   */
  exitPlaybackMode() {
    playbackState.update(state => ({
      ...initialPlaybackState,
      clipList: state.clipList, // Keep clip list
      totalClips: state.totalClips,
      clipListLastRefresh: state.clipListLastRefresh,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update playback statistics
   */
  updatePlaybackStats(stats: any) {
    playbackState.update(state => ({
      ...state,
      playbackStats: stats,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update buffer health
   */
  updateBufferHealth(bufferHealth: number) {
    playbackState.update(state => ({
      ...state,
      bufferHealth,
      lastUpdate: new Date()
    }));
  },

  /**
   * Set operation loading state
   */
  setOperationLoading(operation: string, loading: boolean) {
    playbackOperations.setLoading(loading);
    if (loading) {
      playbackOperations.update(state => ({
        ...state,
        lastCommand: operation,
        pendingCommands: [...state.pendingCommands, operation]
      }));
    } else {
      playbackOperations.update(state => ({
        ...state,
        pendingCommands: state.pendingCommands.filter(cmd => cmd !== operation)
      }));
    }
  },

  /**
   * Set operation loading state
   */
  setOperationLoading(command: string, loading: boolean) {
    if (loading) {
      playbackOperations.update(ops => ({
        ...ops,
        lastCommand: command,
        pendingCommands: [...ops.pendingCommands, command]
      }));
      playbackOperations.setLoading(true);
    } else {
      playbackOperations.update(ops => ({
        ...ops,
        pendingCommands: ops.pendingCommands.filter(cmd => cmd !== command)
      }));
      playbackOperations.setLoading(false);
    }
  },

  /**
   * Set operation error
   */
  setOperationError(error: string | null) {
    playbackOperations.setError(error);
  },

  /**
   * Format timecode from frame position
   */
  formatTimecode(frames: number, frameRate: number = 24): string {
    const totalSeconds = Math.floor(frames / frameRate);
    const remainingFrames = frames % frameRate;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`;
  },

  /**
   * Parse timecode to frame position
   */
  parseTimecode(timecode: string, frameRate: number = 24): number {
    const parts = timecode.split(':').map(Number);
    if (parts.length !== 4) return 0;
    
    const [hours, minutes, seconds, frames] = parts;
    return (hours * 3600 + minutes * 60 + seconds) * frameRate + frames;
  }
};

// Export the store and related utilities
export const playbackStore = {
  // Main store
  subscribe: playbackState.subscribe,
  
  // Derived stores
  playbackMode,
  transportState,
  currentClipInfo,
  clipBrowser,
  playbackProgress,
  
  // Operations store
  operations: playbackOperations,
  
  // Actions
  ...playbackActions
};

export type { PlaybackState, ClipInfo };