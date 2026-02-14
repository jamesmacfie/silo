import type { Bookmark } from "@/shared/types"

const collectBookmarkNodes = (nodes: Bookmark[], output: Bookmark[]): void => {
  for (const node of nodes) {
    if (node.type === "bookmark" && node.url) {
      output.push(node)
    }

    if (node.children) {
      collectBookmarkNodes(node.children, output)
    }
  }
}

const findFolderNode = (
  nodes: Bookmark[],
  folderId: string,
): Bookmark | undefined => {
  for (const node of nodes) {
    if (node.id === folderId && node.type === "folder") {
      return node
    }

    if (node.children) {
      const found = findFolderNode(node.children, folderId)
      if (found) {
        return found
      }
    }
  }

  return undefined
}

const collectFolderNodes = (nodes: Bookmark[], output: string[]): void => {
  for (const node of nodes) {
    if (node.type === "folder") {
      output.push(node.id)
    }

    if (node.children) {
      collectFolderNodes(node.children, output)
    }
  }
}

export const flattenBookmarkTree = (bookmarkTree: Bookmark[]): Bookmark[] => {
  const flattenedBookmarks: Bookmark[] = []
  collectBookmarkNodes(bookmarkTree, flattenedBookmarks)
  return flattenedBookmarks
}

export const getBookmarkIdsInFolder = (
  bookmarkTree: Bookmark[],
  folderId: string,
): string[] => {
  const folderNode = findFolderNode(bookmarkTree, folderId)
  if (!folderNode?.children) {
    return []
  }

  return flattenBookmarkTree(folderNode.children).map((bookmark) => bookmark.id)
}

export const getBookmarkIdsInFolders = (
  bookmarkTree: Bookmark[],
  folderIds: string[],
): string[] => {
  const bookmarkIds = new Set<string>()

  for (const folderId of folderIds) {
    for (const bookmarkId of getBookmarkIdsInFolder(bookmarkTree, folderId)) {
      bookmarkIds.add(bookmarkId)
    }
  }

  return [...bookmarkIds]
}

export const getFolderIds = (bookmarkTree: Bookmark[]): string[] => {
  const folderIds: string[] = []
  collectFolderNodes(bookmarkTree, folderIds)
  return folderIds
}
