import type { Bookmark } from "@/shared/types"

/**
 * Cross-browser bookmark formats utilities
 */

export interface StandardBookmarkFolder {
  title: string
  url?: string
  children?: StandardBookmarkFolder[]
  type: "folder" | "bookmark"
  dateAdded?: number
}

export interface NetscapeBookmarkFormat {
  html: string
}

export interface ChromeBookmarkFormat {
  version: number
  roots: {
    bookmark_bar: ChromeBookmarkNode
    other: ChromeBookmarkNode
    synced?: ChromeBookmarkNode
  }
}

export interface ChromeBookmarkNode {
  children?: ChromeBookmarkNode[]
  date_added?: string
  date_modified?: string
  id?: string
  name: string
  type: "folder" | "url"
  url?: string
}

export interface FirefoxBookmarkBackup {
  title: string
  id?: number
  children?: FirefoxBookmarkBackup[]
  uri?: string
  type?: "text/x-moz-place" | "text/x-moz-place-container"
  dateAdded?: number
  lastModified?: number
}

/**
 * Export bookmarks to standard HTML format (Netscape Bookmark File Format)
 * This is the most widely supported format across browsers
 */
export function exportToNetscapeFormat(
  bookmarks: Bookmark[],
  options?: {
    includeIcons?: boolean
    includeFolders?: boolean
  },
): NetscapeBookmarkFormat {
  const { includeIcons = false, includeFolders = true } = options || {}

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`

  const rootBookmarks = bookmarks.filter(
    (b) => !b.parentId || b.parentId === "0",
  )

  function renderBookmarkNode(
    bookmark: Bookmark,
    indent: string = "    ",
  ): string {
    if (bookmark.type === "folder" && includeFolders) {
      const addDate = bookmark.dateAdded
        ? ` ADD_DATE="${Math.floor(bookmark.dateAdded / 1000)}"`
        : ""
      const modDate = bookmark.dateGroupModified
        ? ` LAST_MODIFIED="${Math.floor(bookmark.dateGroupModified / 1000)}"`
        : ""

      let folderHtml = `${indent}<DT><H3${addDate}${modDate}>${escapeHtml(bookmark.title)}</H3>\n`
      folderHtml += `${indent}<DL><p>\n`

      if (bookmark.children) {
        for (const child of bookmark.children) {
          folderHtml += renderBookmarkNode(child, `${indent}    `)
        }
      }

      folderHtml += `${indent}</DL><p>\n`
      return folderHtml
    } else if (bookmark.type === "bookmark" && bookmark.url) {
      const addDate = bookmark.dateAdded
        ? ` ADD_DATE="${Math.floor(bookmark.dateAdded / 1000)}"`
        : ""
      const icon =
        includeIcons && bookmark.url
          ? ` ICON="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="`
          : ""

      return `${indent}<DT><A HREF="${escapeHtml(bookmark.url)}"${addDate}${icon}>${escapeHtml(bookmark.title)}</A>\n`
    }

    return ""
  }

  for (const bookmark of rootBookmarks) {
    html += renderBookmarkNode(bookmark)
  }

  html += `</DL><p>`

  return { html }
}

/**
 * Export bookmarks to Chrome format (JSON)
 */
export function exportToChromeFormat(
  bookmarks: Bookmark[],
): ChromeBookmarkFormat {
  function convertToChrome(bookmark: Bookmark): ChromeBookmarkNode {
    const node: ChromeBookmarkNode = {
      name: bookmark.title,
      type: bookmark.type === "folder" ? "folder" : "url",
    }

    if (bookmark.id) node.id = bookmark.id
    if (bookmark.url && bookmark.type === "bookmark") node.url = bookmark.url
    if (bookmark.dateAdded)
      node.date_added = (bookmark.dateAdded * 1000).toString()
    if (bookmark.dateGroupModified)
      node.date_modified = (bookmark.dateGroupModified * 1000).toString()

    if (bookmark.children && bookmark.type === "folder") {
      node.children = bookmark.children.map(convertToChrome)
    }

    return node
  }

  const bookmarkBar = bookmarks.find(
    (b) => b.title === "Bookmarks Toolbar" || b.title === "Bookmarks Bar",
  ) || { title: "Bookmarks Bar", type: "folder" as const, children: [] }
  const otherBookmarks = bookmarks.find(
    (b) => b.title === "Other Bookmarks",
  ) || { title: "Other Bookmarks", type: "folder" as const, children: [] }

  return {
    version: 1,
    roots: {
      bookmark_bar: convertToChrome(bookmarkBar as Bookmark),
      other: convertToChrome(otherBookmarks as Bookmark),
    },
  }
}

/**
 * Parse standard HTML bookmark format (Netscape)
 */
export function parseNetscapeFormat(html: string): StandardBookmarkFolder[] {
  const bookmarks: StandardBookmarkFolder[] = []

  // Basic regex parsing - in a real implementation you'd want a proper HTML parser
  const folderRegex = /<H3[^>]*>([^<]+)<\/H3>/gi
  const bookmarkRegex = /<A[^>]+HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi

  let match: RegExpExecArray | null = null

  match = folderRegex.exec(html)
  while (match !== null) {
    bookmarks.push({
      title: match[1],
      type: "folder",
      children: [],
    })
    match = folderRegex.exec(html)
  }

  match = bookmarkRegex.exec(html)
  while (match !== null) {
    bookmarks.push({
      title: match[2],
      url: match[1],
      type: "bookmark",
    })
    match = bookmarkRegex.exec(html)
  }

  return bookmarks
}

/**
 * Parse Chrome bookmark format
 */
export function parseChromeFormat(
  data: ChromeBookmarkFormat,
): StandardBookmarkFolder[] {
  function convertFromChrome(node: ChromeBookmarkNode): StandardBookmarkFolder {
    const bookmark: StandardBookmarkFolder = {
      title: node.name,
      type: node.type === "folder" ? "folder" : "bookmark",
    }

    if (node.url) bookmark.url = node.url
    if (node.date_added)
      bookmark.dateAdded = parseInt(node.date_added, 10) / 1000

    if (node.children) {
      bookmark.children = node.children.map(convertFromChrome)
    }

    return bookmark
  }

  const bookmarks: StandardBookmarkFolder[] = []

  if (data.roots.bookmark_bar) {
    bookmarks.push(convertFromChrome(data.roots.bookmark_bar))
  }

  if (data.roots.other) {
    bookmarks.push(convertFromChrome(data.roots.other))
  }

  if (data.roots.synced) {
    bookmarks.push(convertFromChrome(data.roots.synced))
  }

  return bookmarks
}

/**
 * Convert standard bookmarks to Silo format with metadata
 */
export function convertStandardToSilo(
  standardBookmarks: StandardBookmarkFolder[],
  containerMap?: Map<string, string>, // URL pattern -> container ID
): Bookmark[] {
  let idCounter = 1

  function convertNode(
    node: StandardBookmarkFolder,
    parentId?: string,
  ): Bookmark {
    const bookmark: Bookmark = {
      id: (idCounter++).toString(),
      title: node.title,
      type: node.type === "folder" ? "folder" : "bookmark",
      index: 0,
      parentId,
      dateAdded: node.dateAdded,
      autoOpen: false,
    }

    if (node.url && node.type === "bookmark") {
      bookmark.url = node.url

      // Try to match container based on URL
      if (containerMap) {
        for (const [pattern, containerId] of containerMap.entries()) {
          if (node.url.includes(pattern)) {
            bookmark.containerId = containerId
            break
          }
        }
      }
    }

    if (node.children && node.type === "folder") {
      bookmark.children = node.children.map((child, index) => {
        const childBookmark = convertNode(child, bookmark.id)
        childBookmark.index = index
        return childBookmark
      })
    }

    return bookmark
  }

  return standardBookmarks.map((node, index) => {
    const bookmark = convertNode(node)
    bookmark.index = index
    return bookmark
  })
}

/**
 * HTML escape utility
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

/**
 * Generate cross-browser bookmark export options
 */
export interface BookmarkExportFormats {
  netscape: NetscapeBookmarkFormat
  chrome: ChromeBookmarkFormat
  silo: {
    bookmarks: Bookmark[]
    metadata: Record<string, any>
  }
}

export function exportBookmarksAllFormats(
  bookmarks: Bookmark[],
): BookmarkExportFormats {
  return {
    netscape: exportToNetscapeFormat(bookmarks),
    chrome: exportToChromeFormat(bookmarks),
    silo: {
      bookmarks,
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0",
        source: "silo",
      },
    },
  }
}
