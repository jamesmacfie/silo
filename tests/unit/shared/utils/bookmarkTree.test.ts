import type { Bookmark } from "@/shared/types"
import {
  flattenBookmarkTree,
  getBookmarkIdsInFolder,
  getBookmarkIdsInFolders,
  getFolderIds,
} from "@/shared/utils/bookmarkTree"

const createBookmark = (overrides: Partial<Bookmark>): Bookmark => ({
  id: "bookmark-id",
  title: "Bookmark",
  index: 0,
  type: "bookmark",
  autoOpen: false,
  ...overrides,
})

const createFolder = (
  overrides: Partial<Bookmark> & { id: string; children?: Bookmark[] },
): Bookmark => ({
  id: overrides.id,
  title: overrides.title || "Folder",
  index: 0,
  type: "folder",
  autoOpen: false,
  children: overrides.children || [],
  ...overrides,
})

describe("bookmarkTree", () => {
  const bookmarkTree: Bookmark[] = [
    createFolder({
      id: "root-folder",
      children: [
        createBookmark({
          id: "bookmark-1",
          title: "Silo",
          url: "https://silo.example.com",
        }),
        createFolder({
          id: "nested-folder",
          children: [
            createBookmark({
              id: "bookmark-2",
              title: "Nested",
              url: "https://nested.example.com",
            }),
          ],
        }),
      ],
    }),
    createBookmark({
      id: "bookmark-3",
      title: "Root Bookmark",
      url: "https://root.example.com",
    }),
    createBookmark({
      id: "bookmark-without-url",
      title: "Not a link yet",
      url: undefined,
    }),
  ]

  describe("flattenBookmarkTree", () => {
    it("returns all bookmark nodes with URLs from the full tree", () => {
      expect(
        flattenBookmarkTree(bookmarkTree).map((bookmark) => bookmark.id),
      ).toEqual(["bookmark-1", "bookmark-2", "bookmark-3"])
    })
  })

  describe("getBookmarkIdsInFolder", () => {
    it("returns descendant bookmark IDs for a folder", () => {
      expect(getBookmarkIdsInFolder(bookmarkTree, "root-folder")).toEqual([
        "bookmark-1",
        "bookmark-2",
      ])
    })

    it("returns an empty list for unknown folders", () => {
      expect(getBookmarkIdsInFolder(bookmarkTree, "missing-folder")).toEqual([])
    })
  })

  describe("getBookmarkIdsInFolders", () => {
    it("deduplicates IDs when nested folders are both selected", () => {
      expect(
        getBookmarkIdsInFolders(bookmarkTree, ["root-folder", "nested-folder"]),
      ).toEqual(["bookmark-1", "bookmark-2"])
    })
  })

  describe("getFolderIds", () => {
    it("returns all folder IDs in traversal order", () => {
      expect(getFolderIds(bookmarkTree)).toEqual([
        "root-folder",
        "nested-folder",
      ])
    })
  })
})
