# Silo

Firefox WebExtension for automatic container management. TypeScript + React 18 + Zustand + Tailwind CSS. v2.0.0, Firefox 91+.

## Related Documentation

- **[README.md](README.md)** -- Project overview, feature list, installation, usage guide, and technology stack. Start here for what Silo is and how to use it.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** -- System layer diagram, data flows (URL interception, message passing, rule evaluation, stats pipeline, bookmark CRUD), event bindings map, handler registration table, Zustand store architecture, storage schema, and URL matching engine internals.
- **[AGENTS.md](AGENTS.md)** -- Symlink to this file; keep edits here so both stay in sync.

## Coding Style

### Formatting (Biome)

- 2-space indent, double quotes, trailing commas, no semicolons (ASI)
- Arrow parens always: `(x) => x`
- JSX double quotes
- Import organization via Biome assist
- Run `npm run fmt` to format and lint; `npm run fmt:check` to verify

### TypeScript

- Non-strict mode (`strict: false`), ES2020 target
- Path alias: `@/*` maps to `src/*`
- Use `noExplicitAny: off` -- any is allowed but avoid when practical
- Types live in `src/shared/types/` -- import from `@/shared/types`

### React

- Hooks-first, functional components only
- Tailwind utility classes for all styling -- no custom CSS files, no inline styles
- lucide-react for icons
- `@dnd-kit` for drag-and-drop
- fuse.js for fuzzy search

### Zustand Stores

- One store per domain: containers, rules, bookmarks, stats, theme, preferences, uiState, app
- Selector hooks for fine-grained subscriptions: `useContainers()`, `useRules()`, etc.
- Action hooks separate from state: `useContainerActions()`, `useRuleActions()`
- Optimistic updates: mutate local state first, send message, rollback on error
- Cross-store effects coordinated through `appStore`

## Architecture Patterns

### Message Flow

UI stores call `messagingService.sendMessage(type, payload)` which sends via `browser.runtime.sendMessage`. The background `MessageRouter` finds the first handler where `canHandle(type)` returns true and calls `handle(message)`. Handlers delegate to service singletons, which interact with `browser.storage.local` and Firefox APIs.

### Handler Pattern

Each handler implements `{ canHandle(type): boolean, handle(message): Promise<MessageResponse> }`. Handlers define a `handledTypes` array and check membership. 11 handlers are registered in `src/background/index.ts` in this order: `SystemHandler`, `PreferenceHandler`, `ContainerHandler`, `RuleHandler`, `StatsHandler`, `BookmarkHandler`, `BackupHandler`, `ImportExportHandler`, `TemplateHandler`, `CategoryHandler`, `SyncHandler`.

Important status notes:
- `SyncHandler` message types exist but currently return `"Sync not implemented"`.
- `ImportExportHandler` supports rules/containers + templates, but bookmark export/import handlers currently return not-implemented responses.

### Service Singletons

Services are module-level singleton instances exported as default: `export default new RulesEngine()`. They hold no UI state -- only business logic and storage I/O.

### Dual-Layer Bookmark Model

Firefox bookmark API provides core bookmark data. Silo adds a metadata layer in `browser.storage.local` (key: `bookmarkMetadata`) for container associations and notes.

### Stats Pipeline

`TabEventListener` records tab events to `StatsService`. `RequestInterceptor` also records match/touch/open/close events. All stats data persists across five storage keys (stats, dailyStats, globalStats, activeSessions, recentActivity).

## Key Data Flows

### URL Interception

`webRequest.onBeforeRequest` (blocking) -> `RequestInterceptor` -> `bookmarkIntegration.processBookmarkUrl()` (strip `?silo=` param) -> `rulesEngine.evaluate()` -> redirect/exclude/block/allow.

### Rule Evaluation Priority

1. RESTRICT rules (highest -- security enforcement)
2. EXCLUDE rules (break out of container)
3. INCLUDE rules (sorted by priority number, descending)
4. Default container (if configured)
5. No action

INCLUDE rules only redirect from default context. If already inside a different non-default container, INCLUDE rules are ignored.

### Initialization Sequence

`AppInitializer.initialize()`: migrate storage -> sync containers with Firefox -> register request interceptor -> sync bookmark associations. Each step is fault-tolerant.

### Cross-Store Effects

Deleting a container triggers cleanup of related rules. `appStore` aggregates loading/error state from all domain stores. Theme changes propagate to document class.

## Current UI Status

- Popup currently has 3 primary actions: open current tab in container, open new tab in container, open in new temporary container.
- Options UI pages are: Dashboard, Containers, Rules, Bookmarks, Import/Export, Settings.
- Settings page currently exposes theme switching and Firefox shortcut management helper (open `about:addons` + refresh command state).
- Import/Export UI includes bookmark sections, but bookmark import/export handlers are placeholders right now.

## Adding New Features

### Add a Background Service

1. Create `src/background/services/MyService.ts` with a class and default export
2. Create `src/background/handlers/MyHandler.ts` implementing `MessageHandler`
3. Add message type constants to `src/shared/constants/index.ts`
4. Register handler in `src/background/index.ts` via `router.register(new MyHandler())`
5. Add methods to `src/shared/utils/messaging.ts` MessagingService class
6. Create Zustand store in `src/ui/shared/stores/myStore.ts`

### Add a UI Page

1. Create page component in `src/ui/options/MyPage.tsx`
2. Use layout components from `src/ui/shared/components/layout/`
3. Connect to stores via selector hooks
4. Add `PageKey`, nav item, and render branch in `src/ui/options/index.tsx`

### Add a Message Type

1. Add constant to `MESSAGE_TYPES` in `src/shared/constants/index.ts`
2. Add to handler's `handledTypes` array
3. Add case to handler's `handle()` switch
4. Add method to `MessagingService` in `src/shared/utils/messaging.ts`

### Add a Zustand Store

1. Create `src/ui/shared/stores/myStore.ts`
2. Define state interface, actions, and selector hooks following existing patterns
3. Export hooks from `src/ui/shared/stores/index.ts`
4. Use `messagingService` for background communication in actions

## Key File Locations

| What                     | Where                                          |
|--------------------------|------------------------------------------------|
| Message types            | `src/shared/constants/index.ts`                |
| Storage keys             | `src/shared/constants/index.ts`                |
| Type definitions         | `src/shared/types/`                            |
| Message routing          | `src/background/MessageRouter.ts`              |
| Handler registration     | `src/background/index.ts`                      |
| URL pattern matching     | `src/background/utils/matcher.ts`              |
| Rule evaluation          | `src/background/services/RulesEngine.ts`       |
| Request interception     | `src/background/services/RequestInterceptor.ts` |
| App initialization       | `src/background/initialization/AppInitializer.ts` |
| Tab event stats          | `src/background/listeners/TabEventListener.ts` |
| Messaging service        | `src/shared/utils/messaging.ts`                |
| Zustand stores           | `src/ui/shared/stores/`                        |
| Layout components        | `src/ui/shared/components/layout/`             |
| Bookmark components      | `src/ui/shared/components/bookmarks/`          |
| Import/export UI         | `src/ui/options/ImportExportPage.tsx`          |
| Options shell/nav        | `src/ui/options/index.tsx`                     |
| Popup workflows          | `src/ui/popup/components/PopupApp.tsx`         |
| Container preset wizard  | `src/ui/options/ContainerPresetWizard.tsx`     |
| Preset rule catalog      | `src/shared/utils/containerRulePresets.ts`     |
| Bookmark format utils    | `src/shared/utils/bookmarkFormats.ts`          |

## Commands

```bash
npm run dev            # Dev server with hot reload
npm run build          # Production build (esbuild + Tailwind + Extension CLI)
npm run test           # Jest test suite
npm run test:watch     # Jest watch mode
npm run test:coverage  # Coverage report
npm run test:e2e       # Playwright e2e tests
npm run type-check     # TypeScript validation (tsc --noEmit)
npm run fmt            # Biome format + lint (auto-fix)
npm run fmt:check      # Biome check (no auto-fix)
```

## Build System

- **esbuild** compiles TypeScript + React to IIFE bundles (`temp/popup.iife.js`, `temp/options.iife.js`)
- **Tailwind CSS** compiles to IIFE CSS bundles (`temp/popup.iife.css`, `temp/options.iife.css`)
- **Extension CLI** packages the final extension for Firefox
- Build scripts in `build-scripts/`
- Entry points: `src/popup/index.html`, `src/options/index.html`, background script via manifest

## Testing

- **Jest + jsdom** for unit and component tests
- **React Testing Library** for UI component tests
- **Playwright** for e2e extension tests
- Coverage thresholds: 80% global, 90% for background services
- Test setup: `tests/setup.ts`
- Path alias `@/*` configured in `jest.config.js`

## Design Philosophy

- **Thin handlers, thick services**: Handlers are routing glue; business logic lives in services
- **Optimistic UI**: Local state updates before background confirmation, with rollback
- **Privacy-first**: URLs sanitized in stats (query params stripped), no sensitive data in logs
- **Graceful degradation**: Each initialization step is fault-tolerant; extension works partially if services fail
- **Module singletons**: Services instantiated once at module level, shared across handlers
- **Minimal permissions**: Extension requests only what it needs (storage, tabs, webRequest, contextualIdentities, bookmarks, cookies, notifications)
