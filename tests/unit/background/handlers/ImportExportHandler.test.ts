import { ImportExportHandler } from "@/background/handlers/ImportExportHandler"
import bookmarkService from "@/background/services/BookmarkService"
import containerManager from "@/background/services/ContainerManager"
import rulesEngine from "@/background/services/RulesEngine"
import storageService from "@/background/services/StorageService"
import { MESSAGE_TYPES } from "@/shared/constants"
import type { Bookmark, Container, Rule } from "@/shared/types"

jest.mock("@/background/services/StorageService", () => ({
  __esModule: true,
  default: {
    getRules: jest.fn(),
    getContainers: jest.fn(),
  },
}))

jest.mock("@/background/services/RulesEngine", () => ({
  __esModule: true,
  default: {
    addRule: jest.fn(),
  },
}))

jest.mock("@/background/services/ContainerManager", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}))

jest.mock("@/background/services/BookmarkService", () => ({
  __esModule: true,
  default: {
    getBookmarks: jest.fn(),
    createFolder: jest.fn(),
    setFolderMetadata: jest.fn(),
    createBookmark: jest.fn(),
    updateBookmarkMetadata: jest.fn(),
  },
}))

jest.mock("@/shared/utils/logger")

describe("ImportExportHandler", () => {
  let handler: ImportExportHandler
  let mockStorageService: jest.Mocked<typeof storageService>
  let mockRulesEngine: jest.Mocked<typeof rulesEngine>
  let mockContainerManager: jest.Mocked<typeof containerManager>
  let mockBookmarkService: jest.Mocked<typeof bookmarkService>

  const baseRule: Rule = {
    id: "rule-1",
    pattern: "example.com",
    matchType: "domain",
    ruleType: "include",
    priority: 1,
    enabled: true,
    created: 1000,
    modified: 1000,
    containerId: "firefox-container-1",
    metadata: {
      source: "user",
    },
  }

  const baseContainer: Container = {
    id: "container-1",
    name: "Work",
    icon: "briefcase",
    color: "blue",
    cookieStoreId: "firefox-container-1",
    created: 1000,
    modified: 1000,
    temporary: false,
    syncEnabled: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    handler = new ImportExportHandler()
    mockStorageService = storageService as jest.Mocked<typeof storageService>
    mockRulesEngine = rulesEngine as jest.Mocked<typeof rulesEngine>
    mockContainerManager = containerManager as jest.Mocked<
      typeof containerManager
    >
    mockBookmarkService = bookmarkService as jest.Mocked<typeof bookmarkService>

    mockStorageService.getRules.mockResolvedValue([])
    mockStorageService.getContainers.mockResolvedValue([])
    mockRulesEngine.addRule.mockResolvedValue({} as Rule)
    mockContainerManager.create.mockResolvedValue({
      ...baseContainer,
      id: "created-container",
      cookieStoreId: "created-cookie-store",
    })
    mockBookmarkService.getBookmarks.mockResolvedValue([])
    mockBookmarkService.createFolder.mockResolvedValue({
      id: "new-folder",
      title: "Imported Folder",
      type: "folder",
      index: 0,
      children: [],
    } as Bookmark)
    mockBookmarkService.setFolderMetadata.mockResolvedValue(undefined)
    mockBookmarkService.createBookmark.mockResolvedValue({
      id: "new-bookmark",
      title: "Imported Bookmark",
      type: "bookmark",
      index: 0,
      url: "https://example.com",
    } as Bookmark)
    mockBookmarkService.updateBookmarkMetadata.mockResolvedValue(undefined)
  })

  it("exports rules with filtering options and imports them back", async () => {
    const disabledRule: Rule = {
      ...baseRule,
      id: "rule-2",
      enabled: false,
    }
    mockStorageService.getRules.mockResolvedValue([baseRule, disabledRule])

    const exportResponse = await handler.handle({
      type: MESSAGE_TYPES.EXPORT_RULES,
      payload: {
        options: {
          includeDisabled: false,
          includeMetadata: false,
        },
      },
    })

    expect(exportResponse.success).toBe(true)
    const exportedRules = exportResponse.data as any[]
    expect(exportedRules).toHaveLength(1)
    expect(exportedRules[0].id).toBe("rule-1")
    expect(exportedRules[0].metadata).toBeUndefined()

    const importResponse = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_RULES,
      payload: {
        data: exportedRules,
      },
    })

    expect(importResponse.success).toBe(true)
    expect(mockRulesEngine.addRule).toHaveBeenCalledTimes(1)
  })

  it("previews rule imports and reports validation issues", async () => {
    const response = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_RULES,
      payload: {
        data: [{ matchType: "domain" }, { pattern: "ok.com" }],
        preview: true,
      },
    })

    expect(response.success).toBe(true)
    const result = response.data as any
    expect(result.rules).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.warnings).toHaveLength(1)
  })

  it("exports containers and reimports them", async () => {
    mockStorageService.getContainers.mockResolvedValue([baseContainer])

    const exportResponse = await handler.handle({
      type: MESSAGE_TYPES.EXPORT_CONTAINERS,
    })

    expect(exportResponse.success).toBe(true)
    expect(exportResponse.data).toEqual([baseContainer])

    const importResponse = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_CONTAINERS,
      payload: {
        data: exportResponse.data,
      },
    })

    expect(importResponse.success).toBe(true)
    expect(mockContainerManager.create).toHaveBeenCalledWith(baseContainer)
    expect((importResponse.data as any).importedCount).toBe(1)
  })

  it("exports Silo bookmarks and reimports with missing container creation", async () => {
    const siloBookmarks: Bookmark[] = [
      {
        id: "folder-1",
        title: "Work Folder",
        type: "folder",
        index: 0,
        containerId: "firefox-container-1",
        children: [
          {
            id: "bookmark-1",
            title: "Docs",
            type: "bookmark",
            index: 0,
            url: "https://example.com/docs",
            containerId: "firefox-container-1",
            autoOpen: true,
            description: "Team docs",
          },
        ],
      },
    ]

    mockBookmarkService.getBookmarks.mockResolvedValue(siloBookmarks)
    mockStorageService.getContainers
      .mockResolvedValueOnce([baseContainer])
      .mockResolvedValueOnce([])
    mockContainerManager.create.mockResolvedValue({
      ...baseContainer,
      id: "imported-container",
      cookieStoreId: "imported-cookie-store",
    })
    mockBookmarkService.createFolder.mockResolvedValue({
      id: "created-folder",
      title: "Work Folder",
      type: "folder",
      index: 0,
      children: [],
    } as Bookmark)
    mockBookmarkService.createBookmark.mockResolvedValue({
      id: "created-bookmark",
      title: "Docs",
      type: "bookmark",
      index: 0,
      url: "https://example.com/docs",
    } as Bookmark)

    const exportResponse = await handler.handle({
      type: MESSAGE_TYPES.EXPORT_BOOKMARKS_SILO,
    })
    expect(exportResponse.success).toBe(true)
    expect((exportResponse.data as any).bookmarks).toHaveLength(1)
    expect((exportResponse.data as any).containerProfiles).toHaveLength(1)

    const importResponse = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_BOOKMARKS_SILO,
      payload: {
        data: exportResponse.data,
        createMissingContainers: true,
      },
    })

    expect(importResponse.success).toBe(true)
    expect(mockContainerManager.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Work" }),
    )
    expect(mockBookmarkService.createFolder).toHaveBeenCalled()
    expect(mockBookmarkService.createBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: "imported-cookie-store",
      }),
    )
    expect(mockBookmarkService.updateBookmarkMetadata).toHaveBeenCalledWith(
      "created-bookmark",
      expect.objectContaining({
        autoOpen: true,
      }),
    )
    expect((importResponse.data as any).importedCount).toBe(2)
  })

  it("previews Silo imports with missing containers", async () => {
    mockStorageService.getContainers.mockResolvedValue([])

    const response = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_BOOKMARKS_SILO,
      payload: {
        data: {
          bookmarks: [
            {
              title: "Site",
              type: "bookmark",
              url: "https://example.com",
              containerId: "missing-container",
            },
          ],
        },
        preview: true,
        createMissingContainers: false,
      },
    })

    expect(response.success).toBe(true)
    const result = response.data as any
    expect(result.bookmarks).toHaveLength(1)
    expect(result.missingContainers).toEqual(["missing-container"])
    expect(mockContainerManager.create).not.toHaveBeenCalled()
  })

  it("exports and reimports standard HTML bookmarks", async () => {
    mockBookmarkService.getBookmarks.mockResolvedValue([
      {
        id: "bookmark-1",
        title: "Example",
        type: "bookmark",
        index: 0,
        url: "https://example.com",
      },
    ] as Bookmark[])

    const exportResponse = await handler.handle({
      type: MESSAGE_TYPES.EXPORT_BOOKMARKS_STANDARD,
    })

    expect(exportResponse.success).toBe(true)
    const html = (exportResponse.data as any).html as string
    expect(html).toContain("NETSCAPE-Bookmark-file-1")
    expect(html).toContain("https://example.com")

    const importResponse = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_BOOKMARKS_STANDARD,
      payload: {
        data: html,
      },
    })

    expect(importResponse.success).toBe(true)
    expect(mockBookmarkService.createBookmark).toHaveBeenCalled()
    expect((importResponse.data as any).importedCount).toBeGreaterThan(0)
  })

  it("rejects standard bookmark import when HTML is missing", async () => {
    const response = await handler.handle({
      type: MESSAGE_TYPES.IMPORT_BOOKMARKS_STANDARD,
      payload: {
        data: { not: "html" },
      },
    })

    expect(response.success).toBe(false)
    expect(response.error).toContain("HTML content as a string")
  })
})
