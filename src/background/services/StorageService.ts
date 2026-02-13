import browser from "webextension-polyfill"
import { z } from "zod"
import { DEFAULT_PREFERENCES, STORAGE_KEYS } from "@/shared/constants"
import type {
  BackupData,
  BookmarkAssociation,
  Container,
  ContainerStats,
  ContainerTemplate,
  Preferences,
  Rule,
  ValidationResult,
} from "@/shared/types"

const ContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  cookieStoreId: z.string(),
  created: z.number(),
  modified: z.number(),
  temporary: z.boolean(),
  syncEnabled: z.boolean(),
  metadata: z
    .object({
      description: z.string().optional(),
      customIcon: z.string().optional(),
      lifetime: z.enum(["permanent", "untilLastTab"]).optional(),
      categories: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .optional(),
})

const RuleSchema = z.object({
  id: z.string(),
  containerId: z.string().optional(), // EXCLUDE rules can omit containerId
  pattern: z.string(),
  matchType: z.enum(["exact", "domain", "glob", "regex"]),
  ruleType: z.enum(["include", "exclude", "restrict"]),
  priority: z.number(),
  enabled: z.boolean(),
  created: z.number(),
  modified: z.number(),
  metadata: z.object({
    description: z.string().optional(),
    source: z.enum(["user", "bookmark", "import"]).optional(),
    tags: z.array(z.string()).optional(),
  }),
})

export class StorageService {
  private readonly CURRENT_VERSION = "2.0.0"
  private readonly hasOwnKey = (obj: object, key: string): boolean =>
    Object.getOwnPropertyDescriptor(obj, key) !== undefined

  async migrate(): Promise<void> {
    const version = await this.getVersion()

    if (!version) {
      // Fresh install - set up defaults
      await this.setupDefaults()
      await this.setVersion(this.CURRENT_VERSION)
      return
    }

    // Update version if needed (no data migration required)
    if (version !== this.CURRENT_VERSION) {
      await this.setVersion(this.CURRENT_VERSION)
    }
  }

  private async setupDefaults(): Promise<void> {
    await browser.storage.local.set({
      [STORAGE_KEYS.CONTAINERS]: [],
      [STORAGE_KEYS.RULES]: [],
      [STORAGE_KEYS.PREFERENCES]: DEFAULT_PREFERENCES,
      [STORAGE_KEYS.BOOKMARKS]: [],
      [STORAGE_KEYS.CATEGORIES]: ["Work", "Personal"],
      [STORAGE_KEYS.STATS]: {},
      [STORAGE_KEYS.TEMPLATES]: [
        {
          name: "Work",
          color: "blue",
          icon: "briefcase",
          metadata: { lifetime: "permanent", categories: ["Work"] },
        },
        {
          name: "Personal",
          color: "purple",
          icon: "gift",
          metadata: { lifetime: "permanent", categories: ["Personal"] },
        },
        {
          name: "Banking",
          color: "green",
          icon: "dollar",
          metadata: { lifetime: "untilLastTab", categories: ["Personal"] },
        },
        {
          name: "Social",
          color: "pink",
          icon: "fruit",
          metadata: { lifetime: "permanent" },
        },
        {
          name: "Dev",
          color: "orange",
          icon: "tree",
          metadata: { lifetime: "permanent" },
        },
      ] as ContainerTemplate[],
    })
  }

  private async getVersion(): Promise<string | null> {
    const result = await browser.storage.local.get("version")
    return result.version || null
  }

  private async setVersion(version: string): Promise<void> {
    await browser.storage.local.set({ version })
  }

  // Local storage operations
  async get<T>(key: string): Promise<T | null> {
    const result = await browser.storage.local.get(key)
    return this.hasOwnKey(result, key) ? ((result[key] as T) ?? null) : null
  }

  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value })
  }

  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key)
  }

  async clear(): Promise<void> {
    await browser.storage.local.clear()
  }

  // Sync storage operations
  async syncGet<T>(key: string): Promise<T | null> {
    try {
      const result = await browser.storage.sync.get(key)
      return this.hasOwnKey(result, key) ? ((result[key] as T) ?? null) : null
    } catch {
      return null
    }
  }

  async syncSet<T>(key: string, value: T): Promise<void> {
    await browser.storage.sync.set({ [key]: value })
  }

  async syncRemove(key: string): Promise<void> {
    try {
      await browser.storage.sync.remove(key)
    } catch {
      // Ignore sync storage errors
    }
  }

  // Container operations
  async getContainers(): Promise<Container[]> {
    const containers = await this.get<Container[]>(STORAGE_KEYS.CONTAINERS)
    return containers || []
  }

  async setContainers(containers: Container[]): Promise<void> {
    const validationResult = this.validateContainers(containers)
    if (!validationResult.valid) {
      throw new Error(
        `Invalid containers: ${validationResult.errors.join(", ")}`,
      )
    }
    await this.set(STORAGE_KEYS.CONTAINERS, containers)
  }

  async addContainer(container: Container): Promise<void> {
    const containers = await this.getContainers()
    containers.push(container)
    await this.setContainers(containers)
  }

  async updateContainer(
    id: string,
    updates: Partial<Container>,
  ): Promise<void> {
    const containers = await this.getContainers()
    const index = containers.findIndex((c) => c.id === id)

    if (index === -1) {
      throw new Error(`Container not found: ${id}`)
    }

    containers[index] = {
      ...containers[index],
      ...updates,
      modified: Date.now(),
    }

    await this.setContainers(containers)
  }

  async removeContainer(id: string): Promise<void> {
    const containers = await this.getContainers()
    const filtered = containers.filter((c) => c.id !== id)
    await this.setContainers(filtered)
  }

  // Rule operations
  async getRules(): Promise<Rule[]> {
    const rules = await this.get<Rule[]>(STORAGE_KEYS.RULES)
    return rules || []
  }

  async setRules(rules: Rule[]): Promise<void> {
    const validationResult = this.validateRules(rules)
    if (!validationResult.valid) {
      throw new Error(`Invalid rules: ${validationResult.errors.join(", ")}`)
    }
    await this.set(STORAGE_KEYS.RULES, rules)
  }

  async addRule(rule: Rule): Promise<void> {
    const rules = await this.getRules()
    rules.push(rule)
    // Sort by priority (higher priority first)
    rules.sort((a, b) => b.priority - a.priority)
    await this.setRules(rules)
  }

  async updateRule(id: string, updates: Partial<Rule>): Promise<void> {
    const rules = await this.getRules()
    const index = rules.findIndex((r) => r.id === id)

    if (index === -1) {
      throw new Error(`Rule not found: ${id}`)
    }

    rules[index] = {
      ...rules[index],
      ...updates,
      modified: Date.now(),
    }

    // Re-sort if priority changed
    if (updates.priority !== undefined) {
      rules.sort((a, b) => b.priority - a.priority)
    }

    await this.setRules(rules)
  }

  async removeRule(id: string): Promise<void> {
    const rules = await this.getRules()
    const filtered = rules.filter((r) => r.id !== id)
    await this.setRules(filtered)
  }

  // Preferences operations
  async getPreferences(): Promise<Preferences> {
    const prefs = await this.get<Preferences>(STORAGE_KEYS.PREFERENCES)
    return { ...DEFAULT_PREFERENCES, ...prefs }
  }

  async updatePreferences(updates: Partial<Preferences>): Promise<void> {
    const current = await this.getPreferences()
    const updated = { ...current, ...updates }
    await this.set(STORAGE_KEYS.PREFERENCES, updated)
  }

  // Backup and restore
  async backup(): Promise<BackupData> {
    const [containers, rules, preferences, bookmarksRaw, categories, stats] =
      await Promise.all([
        this.getContainers(),
        this.getRules(),
        this.getPreferences(),
        this.get<BookmarkAssociation[]>(STORAGE_KEYS.BOOKMARKS),
        this.get<string[]>(STORAGE_KEYS.CATEGORIES),
        this.get<Record<string, ContainerStats>>(STORAGE_KEYS.STATS),
      ])

    return {
      version: this.CURRENT_VERSION,
      timestamp: Date.now(),
      containers,
      rules,
      preferences,
      bookmarks: bookmarksRaw || [],
      categories: categories || [],
      stats: stats || {},
    }
  }

  async restore(backup: BackupData): Promise<void> {
    // Validate backup data
    if (!backup.version || backup.version !== this.CURRENT_VERSION) {
      throw new Error(
        `Backup version ${backup.version || "unknown"} is not compatible with current version ${this.CURRENT_VERSION}`,
      )
    }

    await Promise.all([
      this.setContainers(backup.containers),
      this.setRules(backup.rules),
      this.set(STORAGE_KEYS.PREFERENCES, backup.preferences),
      this.set(STORAGE_KEYS.BOOKMARKS, backup.bookmarks),
      this.set(STORAGE_KEYS.CATEGORIES, backup.categories || []),
      this.set(STORAGE_KEYS.STATS, backup.stats || {}),
    ])
  }

  // Validation
  private validateContainers(containers: Container[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      z.array(ContainerSchema).parse(containers)
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(
          ...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        )
      }
    }

    // Check for duplicate IDs
    const ids = new Set<string>()
    containers.forEach((container, index) => {
      if (ids.has(container.id)) {
        errors.push(`Duplicate container ID at index ${index}: ${container.id}`)
      }
      ids.add(container.id)
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private validateRules(rules: Rule[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      z.array(RuleSchema).parse(rules)
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(
          ...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        )
      }
    }

    // Check for duplicate IDs
    const ids = new Set<string>()
    rules.forEach((rule, index) => {
      if (ids.has(rule.id)) {
        errors.push(`Duplicate rule ID at index ${index}: ${rule.id}`)
      }
      ids.add(rule.id)
    })

    // Validate fields by type and regex patterns
    rules.forEach((rule, index) => {
      // For INCLUDE/RESTRICT, require containerId
      if (
        (rule.ruleType === "include" || rule.ruleType === "restrict") &&
        !rule.containerId
      ) {
        errors.push(
          `Missing containerId at index ${index} for ${rule.ruleType.toUpperCase()} rule`,
        )
      }
      // For EXCLUDE, containerId is ignored; normalize undefined
      if (rule.ruleType === "exclude" && rule.containerId) {
        warnings.push(`containerId is ignored for EXCLUDE at index ${index}`)
      }
      if (rule.matchType === "regex") {
        try {
          new RegExp(rule.pattern)
        } catch {
          errors.push(
            `Invalid regex pattern at index ${index}: ${rule.pattern}`,
          )
        }
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  // Bookmark associations
  async getBookmarkAssociations(): Promise<BookmarkAssociation[]> {
    const list = await this.get<BookmarkAssociation[]>(STORAGE_KEYS.BOOKMARKS)
    return list || []
  }

  // Category operations
  async getCategories(): Promise<string[]> {
    const list = await this.get<string[]>(STORAGE_KEYS.CATEGORIES)
    return list || []
  }

  async setCategories(categories: string[]): Promise<void> {
    const unique = Array.from(
      new Set(categories.map((c) => c.trim()).filter(Boolean)),
    )
    await this.set(STORAGE_KEYS.CATEGORIES, unique)
  }

  async addCategory(name: string): Promise<void> {
    const list = await this.getCategories()
    if (!list.includes(name)) {
      list.push(name)
      await this.setCategories(list)
    }
  }

  async renameCategory(oldName: string, newName: string): Promise<void> {
    const list = await this.getCategories()
    const idx = list.indexOf(oldName)
    if (idx !== -1) {
      list[idx] = newName
      await this.setCategories(list)
      // Update containers metadata references
      const containers = await this.getContainers()
      const updated = containers.map((c) => {
        const cats = c.metadata?.categories || []
        const mapped = cats.map((cat) => (cat === oldName ? newName : cat))
        return { ...c, metadata: { ...c.metadata, categories: mapped } }
      })
      await this.setContainers(updated)
    }
  }

  async deleteCategory(name: string): Promise<void> {
    const list = await this.getCategories()
    const filtered = list.filter((c) => c !== name)
    await this.setCategories(filtered)
    // Remove from containers
    const containers = await this.getContainers()
    const updated = containers.map((c) => {
      const cats = (c.metadata?.categories || []).filter((cat) => cat !== name)
      return { ...c, metadata: { ...c.metadata, categories: cats } }
    })
    await this.setContainers(updated)
  }

  // Stats operations
  async getStats(): Promise<Record<string, ContainerStats>> {
    const stats = await this.get<Record<string, ContainerStats>>(
      STORAGE_KEYS.STATS,
    )
    return stats || {}
  }

  async setStats(stats: Record<string, ContainerStats>): Promise<void> {
    await this.set(STORAGE_KEYS.STATS, stats)
  }

  async recordStat(
    cookieStoreId: string,
    event: "open" | "match" | "close" | "touch",
  ): Promise<void> {
    // Check preference gate
    try {
      const prefs = await this.getPreferences()
      if (prefs?.stats?.enabled === false) {
        return
      }
    } catch {
      // ignore
    }
    const stats = await this.getStats()
    const current =
      stats[cookieStoreId] ||
      ({
        containerId: cookieStoreId,
        tabsOpened: 0,
        rulesMatched: 0,
        lastUsed: 0,
        activeTabCount: 0,
        history: [],
      } as ContainerStats)
    const now = Date.now()
    if (event === "open") {
      current.tabsOpened += 1
      current.activeTabCount = Math.max(0, (current.activeTabCount || 0) + 1)
      current.lastUsed = now
    } else if (event === "match") {
      current.rulesMatched += 1
      current.lastUsed = now
    } else if (event === "close") {
      current.activeTabCount = Math.max(0, (current.activeTabCount || 0) - 1)
    } else if (event === "touch") {
      current.lastUsed = now
    }
    current.history.push({ timestamp: now, event })
    // Trim history to last 1000 events per container to bound size
    if (current.history.length > 1000) {
      current.history = current.history.slice(current.history.length - 1000)
    }
    stats[cookieStoreId] = current
    await this.setStats(stats)
  }

  async resetStats(): Promise<void> {
    await this.set(STORAGE_KEYS.STATS, {})
  }

  // Templates
  async getTemplates(): Promise<ContainerTemplate[]> {
    const list = await this.get<ContainerTemplate[]>(STORAGE_KEYS.TEMPLATES)
    return list || []
  }

  async saveTemplate(template: ContainerTemplate): Promise<void> {
    const list = await this.getTemplates()
    const idx = list.findIndex(
      (t: ContainerTemplate) => t.name === template.name,
    )
    if (idx !== -1) {
      list[idx] = template
    } else {
      list.push(template)
    }
    await this.set(STORAGE_KEYS.TEMPLATES, list)
  }

  async deleteTemplate(name: string): Promise<void> {
    const list = await this.getTemplates()
    const filtered = list.filter((t: ContainerTemplate) => t.name !== name)
    await this.set(STORAGE_KEYS.TEMPLATES, filtered)
  }

  async setBookmarkAssociations(
    associations: BookmarkAssociation[],
  ): Promise<void> {
    await this.set(STORAGE_KEYS.BOOKMARKS, associations)
  }

  async addBookmarkAssociation(
    association: BookmarkAssociation,
  ): Promise<void> {
    const list = await this.getBookmarkAssociations()
    const existingIndex = list.findIndex(
      (a) => a.bookmarkId === association.bookmarkId,
    )
    if (existingIndex !== -1) {
      list[existingIndex] = association
    } else {
      list.push(association)
    }
    await this.setBookmarkAssociations(list)
  }

  async removeBookmarkAssociation(bookmarkId: string): Promise<void> {
    const list = await this.getBookmarkAssociations()
    const filtered = list.filter((a) => a.bookmarkId !== bookmarkId)
    await this.setBookmarkAssociations(filtered)
  }

  async getBookmarkAssociation(
    bookmarkId: string,
  ): Promise<BookmarkAssociation | null> {
    const list = await this.getBookmarkAssociations()
    return list.find((a) => a.bookmarkId === bookmarkId) || null
  }
}
export const storageService = new StorageService()
export default storageService
