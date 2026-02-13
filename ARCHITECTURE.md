# Silo Architecture

This document describes the internal architecture of the Silo Firefox extension. For development guidance and coding patterns, see [CLAUDE.md](CLAUDE.md).

## System Layers

```
+------------------------------------------------------+
|  UI Layer                                            |
|  React 18 + Zustand stores + Tailwind CSS            |
|  popup/  options/  shared/components/  shared/stores/ |
+------------------------------------------------------+
          |  browser.runtime.sendMessage()
          v
+------------------------------------------------------+
|  Messaging Layer                                     |
|  Message { type, payload, requestId }                |
|  MessageResponse { success, data, error }            |
|  MessagingService (src/shared/utils/messaging.ts)    |
+------------------------------------------------------+
          |  browser.runtime.onMessage
          v
+------------------------------------------------------+
|  Handler Layer                                       |
|  MessageRouter -> 11 handlers (canHandle/handle)     |
|  First-match routing by registration order           |
+------------------------------------------------------+
          |  direct method calls
          v
+------------------------------------------------------+
|  Service Layer                                       |
|  7 singleton services (module-level exports)         |
|  StorageService, ContainerManager, RulesEngine,      |
|  RequestInterceptor, BookmarkService, StatsService,  |
|  TagService                                          |
+------------------------------------------------------+
          |  browser.storage.local / Firefox APIs
          v
+------------------------------------------------------+
|  Storage Layer                                       |
|  browser.storage.local (16 keys)                     |
|  browser.contextualIdentities                        |
|  browser.bookmarks                                   |
|  browser.webRequest                                  |
|  browser.tabs                                        |
+------------------------------------------------------+
```

## Handler Layer

### MessageRouter (`src/background/MessageRouter.ts`)

The router holds an ordered array of handlers. On each incoming message, it calls `canHandle(type)` on each handler in registration order and delegates to the first match.

```
MessageHandler interface:
  canHandle(type: string): boolean
  handle(message: Message): Promise<MessageResponse>
```

### Registration Order (`src/background/index.ts`)

| Order | Handler              | Message Types                                                    |
|-------|----------------------|------------------------------------------------------------------|
| 1     | SystemHandler        | PING, LOG, TEST_INTERCEPTOR, TEST_PATTERN                        |
| 2     | PreferenceHandler    | GET_PREFERENCES, UPDATE_PREFERENCES                              |
| 3     | ContainerHandler     | GET/CREATE/UPDATE/DELETE_CONTAINER, SYNC_CONTAINERS, CLEAR_CONTAINER_COOKIES, OPEN_IN_CONTAINER |
| 4     | RuleHandler          | GET/CREATE/UPDATE/DELETE_RULE, EVALUATE_URL                      |
| 5     | StatsHandler         | GET_STATS, RESET_STATS, GET_GLOBAL_STATS, GET_DAILY_STATS, GET_ACTIVE_TABS, GET_RECENT_ACTIVITY, GET_CONTAINER_TRENDS, RECORD_STAT_EVENT |
| 6     | BookmarkHandler      | 25+ bookmark CRUD, tag, folder, and bulk operation message types |
| 7     | BackupHandler        | BACKUP_DATA, RESTORE_DATA                                        |
| 8     | ImportExportHandler  | EXPORT/IMPORT_RULES, EXPORT/IMPORT_CONTAINERS, EXPORT/IMPORT_TAGS, EXPORT/IMPORT_BOOKMARKS_SILO, EXPORT/IMPORT_BOOKMARKS_STANDARD, GENERATE_TEMPLATE |
| 9     | TemplateHandler      | GET/SAVE/DELETE/APPLY_TEMPLATE, EXPORT/IMPORT_CONTAINER          |
| 10    | CategoryHandler      | GET/ADD/RENAME/DELETE_CATEGORY                                   |
| 11    | SyncHandler          | SYNC_PUSH, SYNC_PULL, GET_SYNC_STATE                            |

Each handler defines a `handledTypes` array and checks membership in `canHandle()`.

## Service Layer

All services are module-level singletons exported as default from their files.

| Service              | File                                         | Responsibilities                                                                      |
|----------------------|----------------------------------------------|---------------------------------------------------------------------------------------|
| StorageService       | `src/background/services/StorageService.ts`  | All browser.storage.local I/O, data migration, backup/restore, preference defaults     |
| ContainerManager     | `src/background/services/ContainerManager.ts`| Firefox contextualIdentities API, container lifecycle, sync with Firefox, cookie clear  |
| RulesEngine          | `src/background/services/RulesEngine.ts`     | Rule CRUD, URL evaluation with priority resolution, validation, import/export          |
| RequestInterceptor   | `src/background/services/RequestInterceptor.ts` | webRequest.onBeforeRequest listener, tab event listeners, URL interception and redirect |
| BookmarkService      | `src/background/services/BookmarkService.ts` | Firefox bookmark API CRUD, metadata layer, bulk operations                             |
| StatsService         | `src/background/services/StatsService.ts`    | Event recording, session tracking, trend analysis, activity logging                    |
| TagService           | `src/background/services/TagService.ts`      | Tag CRUD, color assignment, bulk tag operations                                        |

Additionally, `BookmarkIntegration` (`src/background/services/BookmarkIntegration.ts`) handles legacy bookmark-container associations and `?silo=` URL parameter processing.

## Data Flows

### 1. Application Initialization

```
browser.runtime.onInstalled / eager call
  -> AppInitializer.initialize()
     1. storageService.migrate()           -- schema migrations
     2. containerManager.syncWithFirefox()  -- sync contextualIdentities
     3. requestInterceptor.register()       -- webRequest + tab listeners
     4. bookmarkIntegration.syncBookmarks() -- bookmark association sync
```

The `TabEventListener` is registered separately before `AppInitializer` runs. Each step is fault-tolerant and logs failures without blocking subsequent steps.

### 2. URL Interception (Tab Opening)

```
User navigates to URL
  -> webRequest.onBeforeRequest (main_frame, blocking)
     OR tabs.onUpdated (fallback)
  -> RequestInterceptor
     1. shouldIntercept(url)?  (skip about:, moz-extension:, file:, etc.)
     2. bookmarkIntegration.processBookmarkUrl(url)  -- extract ?silo= param
     3. rulesEngine.evaluate(cleanUrl, currentContainer)
     4. Switch on evaluation.action:
        - "redirect" -> browser.tabs.create({ cookieStoreId: target })
                        close original tab (if !keepOldTabs)
                        cancel original request
        - "exclude"  -> browser.tabs.create({ cookieStoreId: "firefox-default" })
                        close original tab
        - "block"    -> cancel request, show notification
        - "open"     -> no action (allow request through)
                        if ?silo= param, redirect to that container
```

### 3. Rule Evaluation Algorithm

```
RulesEngine.evaluate(url, currentContainer)
  1. Load all enabled rules from storage
  2. Filter to matching rules (matcher.match(url, pattern, matchType))
  3. Group by rule type: { restrict: [], exclude: [], include: [] }
  4. Sort each group by priority (descending)
  5. Evaluate in type precedence order:
     RESTRICT (highest) -> EXCLUDE -> INCLUDE (lowest)
  6. For each matching rule:
     - RESTRICT: redirect if not already in required container
     - EXCLUDE:  open in firefox-default if currently in a container
     - INCLUDE:  redirect only from default context; ignore if in another container
  7. If no rules match: check for default container preference
  8. Return EvaluationResult { action, containerId?, rule?, reason }
```

### 4. Message Passing (UI to Background)

```
UI Component
  -> useContainerActions().create(data)  (Zustand store action)
  -> messagingService.sendMessage("CREATE_CONTAINER", data)
     -> browser.runtime.sendMessage({ type, payload, requestId })
  -> background: browser.runtime.onMessage listener
     -> MessageRouter.route(message)
        -> handler = handlers.find(h => h.canHandle(type))
        -> handler.handle(message)
           -> service method call (e.g., containerManager.create())
           -> return { success: true, data: result }
  -> UI receives MessageResponse
  -> Zustand store updates state (optimistic rollback on error)
```

### 5. Statistics Pipeline

```
Tab events (created, removed, activated, updated)
  -> TabEventListener (src/background/listeners/TabEventListener.ts)
     - Filters to container tabs only (cookieStoreId !== "firefox-default")
     - Sanitizes URLs (strips query params for privacy)
     -> statsService.recordEvent(cookieStoreId, eventType, metadata)
     -> statsService.trackTabSession(cookieStoreId, tabId, "start"/"end")

RequestInterceptor also records:
  - "match" events when rules trigger
  - "touch" events on container tab navigation
  - "open"/"close" events on tab create/remove

StatsService persists to storage keys:
  - STATS (per-container counters)
  - DAILY_STATS (date-keyed daily aggregates)
  - GLOBAL_STATS (lifetime aggregates)
  - ACTIVE_SESSIONS (current tab sessions)
  - RECENT_ACTIVITY (activity feed, capped)
```

### 6. Bookmark CRUD

```
UI: useBookmarkActions().create(data)
  -> messaging: CREATE_BOOKMARK
  -> BookmarkHandler
     -> BookmarkService
        1. browser.bookmarks.create(nativeData)  -- Firefox bookmark API
        2. Store metadata in BOOKMARK_METADATA    -- container, tags, custom props
        3. Return merged bookmark (native + metadata)

Metadata layer (BOOKMARK_METADATA storage key):
  - containerId: string     -- associated container
  - tags: string[]          -- tag IDs
  - notes: string           -- user notes
  - customIcon: string      -- override icon
```

## Event Bindings

| Browser Event                        | Listener                    | Purpose                                          |
|--------------------------------------|-----------------------------|--------------------------------------------------|
| `browser.runtime.onMessage`          | Background index.ts         | Route all messages through MessageRouter          |
| `browser.runtime.onInstalled`        | Background index.ts         | Trigger full initialization                       |
| `browser.runtime.onStartup`          | Background index.ts         | Trigger full initialization                       |
| `browser.webRequest.onBeforeRequest` | RequestInterceptor          | Intercept navigations for container routing       |
| `browser.tabs.onCreated`             | RequestInterceptor          | Track tab-to-container mapping, record stats      |
| `browser.tabs.onUpdated`             | RequestInterceptor          | Handle URL changes in existing tabs               |
| `browser.tabs.onRemoved`             | RequestInterceptor          | Cleanup tracking, trigger temp container cleanup  |
| `browser.tabs.onCreated`             | TabEventListener            | Record tab creation stats                         |
| `browser.tabs.onRemoved`             | TabEventListener            | Record tab close stats, end session tracking      |
| `browser.tabs.onActivated`           | TabEventListener            | Record tab activation stats                       |
| `browser.tabs.onUpdated`             | TabEventListener            | Record navigation events for container tabs       |

Note: Both `RequestInterceptor` and `TabEventListener` listen to tab events independently. RequestInterceptor handles routing logic; TabEventListener handles statistics.

## Zustand Store Architecture

Eight stores manage UI state, each following the same pattern: state + actions + selector hooks.

| Store              | File                          | State                                              | Key Hooks                                            |
|--------------------|-------------------------------|----------------------------------------------------|------------------------------------------------------|
| appStore           | `stores/appStore.ts`          | Initialization state, cross-store orchestration     | `useAppInitialization`, `useGlobalErrors`, `useGlobalLoading` |
| containerStore     | `stores/containerStore.ts`    | Container list, loading, error                      | `useContainers`, `useContainerActions`, `useContainerLoading` |
| ruleStore          | `stores/ruleStore.ts`         | Rule list, loading, error                           | `useRules`, `useRuleActions`, `useRuleLoading`       |
| bookmarkStore      | `stores/bookmarkStore.ts`     | Bookmarks, tags, search, selection, view mode       | `useFilteredBookmarks`, `useBookmarkActions`, `useBookmarkTags`, `useSelectedBookmarks` |
| statsStore         | `stores/statsStore.ts`        | Per-container stats, global stats, trends, activity | `useStats`, `useGlobalStats`, `useDailyStats`, `useTrends`, `useRecentActivity` |
| themeStore         | `stores/themeStore.ts`        | Theme mode, system preference detection             | `useTheme`, `useThemeEffects`                        |
| preferencesStore   | `stores/preferencesStore.ts`  | User preferences                                   | `usePreferences`, `usePreferencesActions`            |
| uiStateStore       | `stores/uiStateStore.ts`      | Search queries, filters, pagination, view modes     | `useRulesPageState`, `useContainersPageState`, `useBookmarksPageState`, `useTagsPageState` |

### Store Patterns

- **Optimistic updates**: Actions update local state immediately, then send the message. On failure, state is rolled back.
- **Selector hooks**: Each store exports fine-grained selector hooks (e.g., `useContainers()` returns only the containers array) to minimize re-renders.
- **Cross-store effects**: `appStore` aggregates loading/error state from all domain stores. Deleting a container triggers cleanup of related rules in `ruleStore`.

## Storage Schema

All data is persisted in `browser.storage.local` under these keys (defined in `src/shared/constants/index.ts`):

| Key                | Type                      | Description                                    |
|--------------------|---------------------------|------------------------------------------------|
| `containers`       | `Container[]`             | User-defined container configurations          |
| `rules`            | `Rule[]`                  | URL matching rules                             |
| `preferences`      | `Preferences`             | User settings (theme, notifications, etc.)     |
| `bookmarks`        | `BookmarkAssociation[]`   | Legacy bookmark-container associations         |
| `bookmarkMetadata` | `Record<id, Metadata>`    | Metadata layer on Firefox bookmarks            |
| `bookmarkTags`     | `Tag[]`                   | Tag definitions with colors                    |
| `folderMetadata`   | `Record<id, FolderMeta>`  | Folder-level settings                          |
| `syncState`        | `SyncState`               | Sync coordination state                        |
| `cache`            | `CacheData`               | Temporary cached data                          |
| `categories`       | `string[]`                | Container category names                       |
| `stats`            | `Record<id, Stats>`       | Per-container usage counters                   |
| `templates`        | `ContainerTemplate[]`     | Saved container templates                      |
| `dailyStats`       | `Record<date, DayStats>`  | Daily aggregated statistics                    |
| `globalStats`      | `GlobalStats`             | Lifetime aggregated statistics                 |
| `activeSessions`   | `Record<tabId, Session>`  | Currently active tab sessions                  |
| `recentActivity`   | `ActivityEntry[]`         | Recent activity feed (capped)                  |

## URL Matching Engine

Located in `src/background/utils/matcher.ts`. The `match(url, pattern, type)` function supports four match types:

| Match Type | Algorithm | Example Pattern |
|------------|-----------|-----------------|
| `exact`    | Normalize both URL and pattern (strip default ports, trailing slash), then compare strings | `https://example.com/path` |
| `domain`   | Extract hostname from both, compare with subdomain support. Optional path prefix matching. `example.com` matches `www.example.com`. `*.example.com` matches base domain + all subdomains. | `example.com`, `*.example.com/admin` |
| `glob`     | Convert glob to regex (`*` -> `.*`, `?` -> `.`), case-insensitive full-string match | `*.example.com/admin/*` |
| `regex`    | Direct `RegExp` test, case-insensitive | `^https://.*\.example\.com/admin/.*$` |

### Inline Prefix Overrides

For non-domain match types, patterns can use prefix shortcuts:
- `@pattern` forces regex matching regardless of the rule's configured match type
- `!pattern` forces glob matching regardless of the rule's configured match type

These prefixes are stripped before matching. For domain match types, prefixes are ignored.

## Project Structure

```
src/
├── background/
│   ├── index.ts                    # Orchestrator: registers handlers, sets up listeners
│   ├── MessageRouter.ts            # First-match message routing
│   ├── handlers/                   # 11 message handlers
│   ├── initialization/
│   │   └── AppInitializer.ts       # 4-step startup sequence
│   ├── listeners/
│   │   └── TabEventListener.ts     # Stats-focused tab event tracking
│   ├── services/                   # 7 singleton services + BookmarkIntegration
│   └── utils/
│       └── matcher.ts              # URL pattern matching
├── popup/                          # Popup HTML entry point
├── options/                        # Options HTML entry point
├── ui/
│   ├── popup/                      # Popup React app
│   ├── options/                    # Options React app (full-tab pages)
│   └── shared/
│       ├── components/
│       │   ├── layout/             # PageLayout, Modal, Button, SearchBar, etc.
│       │   └── bookmarks/          # BookmarkTreeView, DraggableTreeItem, etc.
│       ├── stores/                 # 8 Zustand stores
│       └── providers/              # Legacy React Query provider
└── shared/
    ├── types/                      # TypeScript type definitions
    ├── constants/                  # MESSAGE_TYPES, STORAGE_KEYS, defaults
    └── utils/                      # MessagingService, logger, pattern validators
```
