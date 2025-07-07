// Logger utility to control console output in production
const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args);
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment && localStorage.getItem('debug') === 'true') {
      console.log('🐛 DEBUG:', ...args);
    }
  }
};

// Enable debug logging with: localStorage.setItem('debug', 'true')
// Disable debug logging with: localStorage.removeItem('debug')