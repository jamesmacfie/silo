export interface BookmarkTag {
  id: string
  name: string
  color: string // hex color
  created: number
  modified: number
}

// This is the metadata we store on top of Firefox bookmarks
// The bookmarkId references the Firefox bookmark ID
export interface BookmarkMetadata {
  bookmarkId: string // Firefox bookmark ID - this is the key
  containerId?: string // Container association
  tags: string[] // Tag IDs
  autoOpen: boolean // Auto-open in container
  metadata: {
    description?: string
    lastAccessed?: number
    accessCount?: number
    notes?: string
  }
  created: number
  modified: number
}

// For folder-level settings that apply to all bookmarks within
export interface FolderMetadata {
  folderId: string // Firefox folder bookmark ID
  containerId?: string // Default container for bookmarks in this folder
  tags?: string[] // Default tags for bookmarks in this folder
  inheritSettings?: boolean // Whether child bookmarks inherit these settings
  created: number
  modified: number
}

// Combined view of Firefox bookmark + our metadata
export interface Bookmark {
  // Firefox bookmark properties
  id: string // Firefox bookmark ID
  title: string
  url?: string // Only for bookmarks, not folders
  parentId?: string
  index: number // Position in parent
  dateAdded?: number
  dateGroupModified?: number
  type: "bookmark" | "folder" | "separator"
  children?: Bookmark[] // For folders

  // Our metadata
  containerId?: string
  tags: string[]
  autoOpen?: boolean
  description?: string
  lastAccessed?: number
  accessCount?: number
  notes?: string

  // Computed/UI properties
  matchedContainer?: string // Container matched by rules
  folderPath?: string[] // Path from root for breadcrumbs
}

export interface BookmarkBulkAction {
  type:
    | "delete"
    | "assignTag"
    | "removeTag"
    | "assignContainer"
    | "removeContainer"
    | "openInContainer"
  bookmarkIds: string[]
  payload?: {
    tagId?: string
    containerId?: string
  }
}

export interface BookmarkImportData {
  bookmarks: Partial<BookmarkMetadata>[]
  folders: Partial<FolderMetadata>[]
  tags: Partial<BookmarkTag>[]
  createMissingTags?: boolean
  createMissingContainers?: boolean
  mergeStrategy?: "overwrite" | "skip" | "merge"
}

export interface BookmarkExportOptions {
  includeHeaders?: boolean
  includeTags?: boolean
  includeContainers?: boolean
  includeFolders?: boolean
  includeMetadata?: boolean
  format?: "csv" | "json"
}

export interface BookmarkSearchFilters {
  query?: string
  tags?: string[]
  containers?: string[]
  folders?: string[]
  dateRange?: {
    start?: number
    end?: number
  }
}

export interface BookmarkSortOptions {
  field:
    | "title"
    | "url"
    | "created"
    | "modified"
    | "position"
    | "container"
    | "tags"
  order: "asc" | "desc"
}

// For compatibility with existing BookmarkAssociation
export interface BookmarkMigrationData {
  from: "legacy"
  to: "metadata"
  bookmarks: BookmarkMetadata[]
  folders: FolderMetadata[]
  tags: BookmarkTag[]
}
