
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export const logger = {
  log: (level: LogLevel, message: string, context?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context: context || {},
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logEntry, null, 2));
    }
    
    // Could add remote logging service integration here
  },
  info: (message: string, context?: any) => logger.log('info', message, context),
  warn: (message: string, context?: any) => logger.log('warn', message, context),
  error: (message: string, context?: any) => logger.log('error', message, context),
  debug: (message: string, context?: any) => logger.log('debug', message, context),
};
