export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Logger {
  private readonly prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private format(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}]${this.prefix ? ` [${this.prefix}]` : ''} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(this.format(LogLevel.DEBUG, message, ...args), ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(this.format(LogLevel.INFO, message, ...args), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.format(LogLevel.WARN, message, ...args), ...args);
  }

  error(message: string, error?: Error | unknown, ...args: any[]): void {
    console.error(this.format(LogLevel.ERROR, message), error, ...args);
  }
}

export const logger = new Logger('DevSprite');

/**
 * Create a new logger instance with a custom prefix
 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}
