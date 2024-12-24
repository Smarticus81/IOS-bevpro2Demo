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

    // Allow voice commands to override cooldown if previous command failed
    const isCooldownActive = now - currentState.lastRun < cooldownPeriod;
    if (isCooldownActive && currentState.isProcessing && !key.includes('voice')) {
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

// Create specialized debouncers with more flexible cooldowns for voice commands
export const voiceCommandDebouncer = createDebouncer(1000); // 1s cooldown for voice commands
export const orderProcessingDebouncer = createDebouncer(1500); // 1.5s cooldown for order processing
export const audioSynthesisDebouncer = createDebouncer(500); // 0.5s cooldown for audio synthesis