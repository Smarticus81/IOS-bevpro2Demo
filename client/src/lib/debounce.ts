type DebouncedFunction<T = void> = (...args: any[]) => Promise<T>;

interface DebouncedState {
  timeout: NodeJS.Timeout | null;
  lastRun: number;
  isProcessing: boolean;
}

export function createDebouncer(cooldownPeriod: number = 2000) {
  const state: Record<string, DebouncedState> = {};

  return function debounce<T>(
    key: string,
    fn: DebouncedFunction<T>,
    wait: number = 500
  ): Promise<T> {
    if (!state[key]) {
      state[key] = {
        timeout: null,
        lastRun: 0,
        isProcessing: false
      };
    }

    const currentState = state[key];
    const now = Date.now();

    // If we're in cooldown period or processing, reject
    if (now - currentState.lastRun < cooldownPeriod || currentState.isProcessing) {
      console.log('Command debounced:', {
        key,
        timeSinceLastRun: now - currentState.lastRun,
        isProcessing: currentState.isProcessing,
        timestamp: new Date().toISOString()
      });
      return Promise.reject(new Error('Command in cooldown period'));
    }

    // Clear any existing timeout
    if (currentState.timeout) {
      clearTimeout(currentState.timeout);
    }

    return new Promise((resolve, reject) => {
      currentState.timeout = setTimeout(async () => {
        try {
          currentState.isProcessing = true;
          console.log('Processing command:', {
            key,
            commandType: key.split('-')[0],
            timestamp: new Date().toISOString()
          });
          
          const result = await fn();
          currentState.lastRun = Date.now();
          resolve(result);
        } catch (error) {
          console.error('Command processing error:', {
            key,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          reject(error);
        } finally {
          currentState.isProcessing = false;
        }
      }, wait);
    });
  };
}

// Create specialized debouncers
export const voiceCommandDebouncer = createDebouncer(1500); // 1.5s cooldown for voice commands
export const orderProcessingDebouncer = createDebouncer(2000); // 2s cooldown for order processing
export const audioSynthesisDebouncer = createDebouncer(1000); // 1s cooldown for audio synthesis
