export const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLevel: jest.fn(),
  getHistory: jest.fn(() => []),
  clearHistory: jest.fn(),
  withContext: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  exportLogs: jest.fn(() => Promise.resolve("")),
}

export default logger
