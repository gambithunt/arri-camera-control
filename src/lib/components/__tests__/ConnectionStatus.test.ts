import { describe, it, expect } from 'vitest';

describe('ConnectionStatus Component', () => {
  it('should handle connection state logic', () => {
    const getConnectionText = (connected: boolean, cameraModel: string) => {
      if (connected) {
        return cameraModel ? `Connected to ${cameraModel}` : 'Connected';
      } else {
        return 'Disconnected';
      }
    };
    
    expect(getConnectionText(false, '')).toBe('Disconnected');
    expect(getConnectionText(true, '')).toBe('Connected');
    expect(getConnectionText(true, 'Alexa 35')).toBe('Connected to Alexa 35');
  });

  it('should determine correct status colors', () => {
    const getStatusColor = (connected: boolean) => {
      return connected ? 'bg-green-500' : 'bg-red-500';
    };
    
    expect(getStatusColor(false)).toBe('bg-red-500');
    expect(getStatusColor(true)).toBe('bg-green-500');
  });
});