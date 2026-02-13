import "@testing-library/jest-dom"

// Ensure React 18 treats this as an act-enabled test environment.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// Mock webextension-polyfill
jest.mock("webextension-polyfill", () => ({
  __esModule: true,
  default: {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
      },
      sync: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    runtime: {
      sendMessage: jest.fn().mockResolvedValue({}),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      getManifest: jest.fn().mockReturnValue({ version: "2.0.0" }),
      getURL: jest
        .fn()
        .mockImplementation(
          (path: string) => `chrome-extension://test/${path}`,
        ),
    },
    tabs: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      get: jest
        .fn()
        .mockResolvedValue({ id: 1, cookieStoreId: "firefox-default" }),
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    contextualIdentities: {
      query: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        cookieStoreId: "firefox-container-1",
        name: "Test",
        color: "blue",
        icon: "fingerprint",
      }),
      update: jest.fn().mockResolvedValue({
        cookieStoreId: "firefox-container-1",
        name: "Test",
        color: "blue",
        icon: "fingerprint",
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({
        cookieStoreId: "firefox-container-1",
        name: "Test",
        color: "blue",
        icon: "fingerprint",
      }),
      onCreated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onRemoved: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    notifications: {
      create: jest.fn().mockResolvedValue("notification-id"),
    },
    bookmarks: {
      search: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "1" }),
      update: jest.fn().mockResolvedValue({ id: "1" }),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  },
}))

// Bind the mocked module default to global.browser/chrome so tests can assert on it
// and production code importing the module uses the same reference
import browser from "webextension-polyfill"
;(global as any).browser = browser as any
;(global as any).chrome = (global as any).browser

// Legacy aliases are now pointing to the same mocked module instance
