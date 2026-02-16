import { BackupHandler } from "@/background/handlers/BackupHandler"
import storageService from "@/background/services/StorageService"
import { MESSAGE_TYPES } from "@/shared/constants"
import type { BackupData } from "@/shared/types"

jest.mock("@/background/services/StorageService", () => ({
  __esModule: true,
  default: {
    backup: jest.fn(),
    restore: jest.fn(),
  },
}))

jest.mock("@/shared/utils/logger")

describe("BackupHandler", () => {
  let handler: BackupHandler
  let mockStorageService: jest.Mocked<typeof storageService>

  const backupData: BackupData = {
    version: "2.0.0",
    timestamp: 1700000000000,
    containers: [
      {
        id: "container-1",
        name: "Work",
        icon: "briefcase",
        color: "blue",
        cookieStoreId: "firefox-container-1",
        created: 1000,
        modified: 1000,
        temporary: false,
        syncEnabled: true,
      },
    ],
    rules: [],
    preferences: {
      theme: "auto",
      keepOldTabs: false,
      matchDomainOnly: true,
      syncEnabled: false,
      syncOptions: {
        syncRules: true,
        syncContainers: true,
        syncPreferences: true,
      },
      notifications: {
        showOnRuleMatch: false,
        showOnRestrict: true,
        showOnExclude: false,
      },
      advanced: {
        debugMode: false,
        performanceMode: false,
        cacheTimeout: 60000,
      },
    },
    bookmarks: [],
    categories: ["Work"],
    stats: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()

    handler = new BackupHandler()
    mockStorageService = storageService as jest.Mocked<typeof storageService>

    mockStorageService.backup.mockResolvedValue(backupData)
    mockStorageService.restore.mockResolvedValue(undefined)
  })

  it("exports backup data", async () => {
    const response = await handler.handle({
      type: MESSAGE_TYPES.BACKUP_DATA,
    })

    expect(response.success).toBe(true)
    expect(response.data).toEqual(backupData)
    expect(mockStorageService.backup).toHaveBeenCalledTimes(1)
  })

  it("supports restore preview with wrapped payload", async () => {
    const response = await handler.handle({
      type: MESSAGE_TYPES.RESTORE_DATA,
      payload: {
        data: backupData,
        preview: true,
      },
    })

    expect(response.success).toBe(true)
    expect(mockStorageService.restore).not.toHaveBeenCalled()

    const result = response.data as any
    expect(result.containers).toHaveLength(1)
    expect(result.rules).toHaveLength(0)
    expect(result.bookmarks).toHaveLength(0)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it("restores from wrapped payload and returns summary data", async () => {
    const response = await handler.handle({
      type: MESSAGE_TYPES.RESTORE_DATA,
      payload: {
        data: backupData,
      },
    })

    expect(response.success).toBe(true)
    expect(mockStorageService.restore).toHaveBeenCalledWith(backupData)

    const result = response.data as any
    expect(result.containers).toHaveLength(1)
    expect(result.rules).toHaveLength(0)
    expect(result.bookmarks).toHaveLength(0)
  })

  it("rejects invalid restore payloads", async () => {
    const response = await handler.handle({
      type: MESSAGE_TYPES.RESTORE_DATA,
      payload: {
        data: {
          version: "2.0.0",
          containers: [],
        },
      },
    })

    expect(response.success).toBe(false)
    expect(response.error).toBe("Invalid backup data format")
  })
})
