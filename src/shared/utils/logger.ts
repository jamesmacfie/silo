import browser from 'webextension-polyfill';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
  context?: string;
}

class Logger {
  private isDev: boolean;
  private logLevel: LogLevel;
  private maxEntries = 1000;
  private logs: LogEntry[] = [];

  constructor() {
    // Check if we're in development mode based on manifest or browser API
    this.isDev = typeof browser !== 'undefined' && browser.runtime?.getManifest?.()?.version?.includes?.('dev') || false;
    this.logLevel = this.isDev ? 'debug' : 'warn';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${ctx} ${message}`;
  }

  private addToHistory(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }
  }

  debug(message: string, data?: any, context?: string): void {
    if (!this.shouldLog('debug')) return;
    
    const entry: LogEntry = {
      level: 'debug',
      message,
      data,
      timestamp: Date.now(),
      context,
    };

    this.addToHistory(entry);
    
    if (this.isDev) {
      console.debug(this.formatMessage('debug', message, context), data);
    }
  }

  info(message: string, data?: any, context?: string): void {
    if (!this.shouldLog('info')) return;
    
    const entry: LogEntry = {
      level: 'info',
      message,
      data,
      timestamp: Date.now(),
      context,
    };

    this.addToHistory(entry);
    console.info(this.formatMessage('info', message, context), data);
  }

  warn(message: string, data?: any, context?: string): void {
    if (!this.shouldLog('warn')) return;
    
    const entry: LogEntry = {
      level: 'warn',
      message,
      data,
      timestamp: Date.now(),
      context,
    };

    this.addToHistory(entry);
    console.warn(this.formatMessage('warn', message, context), data);
  }

  error(message: string, data?: any, context?: string): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      data,
      timestamp: Date.now(),
      context,
    };

    this.addToHistory(entry);
    console.error(this.formatMessage('error', message, context), data);
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getHistory(): LogEntry[] {
    return [...this.logs];
  }

  clearHistory(): void {
    this.logs = [];
  }

  // Create a logger with context
  withContext(context: string) {
    return {
      debug: (message: string, data?: any) => this.debug(message, data, context),
      info: (message: string, data?: any) => this.info(message, data, context),
      warn: (message: string, data?: any) => this.warn(message, data, context),
      error: (message: string, data?: any) => this.error(message, data, context),
    };
  }

  // Export logs for debugging
  async exportLogs(): Promise<string> {
    const manifest = browser.runtime.getManifest();
    const exportData = {
      extension: {
        name: manifest.name,
        version: manifest.version,
      },
      timestamp: new Date().toISOString(),
      logs: this.logs,
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

export const logger = new Logger();
export default logger;