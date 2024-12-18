type DebouncedFunction = (...args: any[]) => void;

interface DebouncedState {
  timeout: NodeJS.Timeout | null;
  lastRun: number;
  isProcessing: boolean;
}

export function createDebouncer(cooldownPeriod: number = 2000) {
  const state: Record<string, DebouncedState> = {};

  return function debounce(
    key: string,
    fn: DebouncedFunction,
    wait: number = 500
  ): Promise<void> {
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
      console.log('Debounce rejected:', {
        key,
        timeSinceLastRun: now - currentState.lastRun,
        isProcessing: currentState.isProcessing,
        timestamp: new Date().toISOString()
      });
      return Promise.reject(new Error('Operation in cooldown'));
    }

    // Clear any existing timeout
    if (currentState.timeout) {
      clearTimeout(currentState.timeout);
    }

    return new Promise((resolve, reject) => {
      currentState.timeout = setTimeout(async () => {
        try {
          currentState.isProcessing = true;
          console.log('Executing debounced function:', {
            key,
            timestamp: new Date().toISOString()
          });
          
          await fn();
          currentState.lastRun = Date.now();
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          currentState.isProcessing = false;
        }
      }, wait);
    });
  };
}

// Create a global transaction debouncer with 2 second cooldown
export const transactionDebouncer = createDebouncer(2000);
