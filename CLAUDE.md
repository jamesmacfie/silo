# Silo - Firefox Extension Codebase Documentation

## Project Overview

Silo is a modern Firefox WebExtension that automatically opens websites in specific Firefox containers based on configurable rules. The extension features a React-based UI with comprehensive bookmark management, statistical analysis, and advanced rule-based container routing.

**Version:** 2.0.0 (production) / 0.0.1 (development)  
**License:** MIT  
**Minimum Firefox Version:** 91.0  
**Framework:** TypeScript + React + Tailwind CSS + Zustand  
**Build System:** Extension CLI + Custom esbuild scripts

## Technology Stack

- **Runtime:** Firefox WebExtension APIs (browser.*) with webextension-polyfill
- **Language:** TypeScript (non-strict mode with ES2020 target)
- **UI Framework:** React 18 with hooks-first architecture
- **Styling:** Tailwind CSS utility-first approach
- **State Management:** Zustand with modular store architecture
- **Build Tools:** Extension CLI + custom esbuild scripts + Tailwind CSS compilation
- **Testing:** Jest + React Testing Library + jsdom environment + Playwright for e2e
- **Code Quality:** Biome for formatting and linting (replaces ESLint/Prettier)

## Architecture Overview

### Core Principles
1. **Type-Safe Messaging** - Comprehensive type system for browser extension message passing
2. **Zustand State Management** - Modular, reactive stores with optimistic updates
3. **Service-Oriented Background** - Separate services for different concerns (rules, containers, bookmarks, stats)
4. **Rule-Based Engine** - Priority-based pattern matching for URL interception
5. **Comprehensive Bookmark Integration** - Full bookmark management with container associations and tagging
6. **Statistics & Analytics** - Detailed usage tracking and trend analysis

### Project Structure

```
src/
├── background/                     # Background service worker
│   ├── index.ts                   # Main background script with message routing
│   ├── services/                  # Core business logic services
│   │   ├── BookmarkIntegration.ts  # Legacy bookmark-container associations
│   │   ├── BookmarkService.ts      # Full bookmark CRUD operations
│   │   ├── ContainerManager.ts     # Firefox container lifecycle management
│   │   ├── RequestInterceptor.ts   # URL interception and redirection
│   │   ├── RulesEngine.ts         # Rule evaluation and management
│   │   ├── StatsService.ts        # Usage statistics and analytics
│   │   ├── StorageService.ts      # Data persistence and migration
│   │   └── TagService.ts          # Bookmark tag management
│   └── utils/
│       └── matcher.ts             # URL pattern matching algorithms
│
├── popup/                         # Popup HTML entry point
│   ├── index.html                # Popup HTML shell
│   └── index.ts                  # Popup JavaScript entry point
│
├── options/
│   └── index.html                # Options page HTML shell
│
├── ui/                           # React-based user interfaces
│   ├── popup/                    # Extension popup (React app)
│   │   ├── index.tsx             # Popup React app entry point
│   │   ├── index.css             # Popup-specific Tailwind styles
│   │   └── components/           # Popup-specific React components
│   │       ├── ContainerSelector.tsx  # Container selection interface
│   │       └── PopupApp.tsx      # Main popup application
│   │
│   ├── options/                  # Settings/options page (React app)
│   │   ├── index.tsx             # Options page React app entry point
│   │   ├── index.css             # Options-specific Tailwind styles
│   │   ├── BookmarksPage.tsx     # Comprehensive bookmark management
│   │   ├── ContainerModal.tsx    # Container creation/editing modal
│   │   ├── ContainersPage.tsx    # Container management interface
│   │   ├── Dashboard.tsx         # Statistics dashboard
│   │   ├── RuleModal.tsx         # Rule creation/editing with pattern testing
│   │   ├── RulesPage.tsx         # Rule management interface
│   │   ├── TagModal.tsx          # Tag creation/editing modal
│   │   └── TagsPage.tsx          # Tag management interface
│   │
│   └── shared/                   # Shared UI components and utilities
│       ├── components/           # Reusable React components
│       │   ├── bookmarks/        # Bookmark-specific components
│       │   │   ├── BookmarkTreeView.tsx    # Hierarchical bookmark display
│       │   │   ├── BookmarkTableView.tsx   # Tabular bookmark display
│       │   │   ├── BookmarkFilters.tsx     # Bookmark filtering interface
│       │   │   ├── BulkActionsBar.tsx      # Bulk bookmark operations
│       │   │   └── TagManager.tsx          # Tag assignment interface
│       │   ├── layout/           # Layout and structure components
│       │   │   ├── PageLayout.tsx          # Standard page layout
│       │   │   ├── Modal.tsx               # Reusable modal system
│       │   │   ├── Button.tsx              # Button component system
│       │   │   └── DataView.tsx            # Data display components
│       │   ├── ColorSelector.tsx           # Color picker for containers/tags
│       │   ├── ContainerCard.tsx           # Container display cards
│       │   ├── RuleCard.tsx               # Rule display cards
│       │   ├── PatternTester.tsx          # Interactive rule testing
│       │   ├── InterceptorTest.tsx        # URL interception testing
│       │   ├── CSVImportExport.tsx        # Bulk import/export functionality
│       │   ├── DuplicateRuleManager.tsx   # Duplicate rule detection/resolution
│       │   └── StatsOverviewCard.tsx      # Statistics display
│       ├── stores/               # Zustand state management
│       │   ├── appStore.ts       # App initialization orchestration
│       │   ├── containerStore.ts # Container state management
│       │   ├── ruleStore.ts      # Rule state management
│       │   ├── bookmarkStore.ts  # Bookmark and tag state management
│       │   ├── statsStore.ts     # Statistics state management
│       │   ├── themeStore.ts     # Theme and appearance state
│       │   ├── preferencesStore.ts # User preferences state
│       │   ├── uiStateStore.ts   # UI-specific state (filters, search, etc.)
│       │   └── index.ts          # Store exports and convenience hooks
│       └── providers/            # React providers (legacy)
│           └── QueryProvider.tsx # React Query (being phased out)
│
└── shared/                       # Shared utilities and types
    ├── types/                    # TypeScript type definitions
    │   ├── container.ts          # Container types and interfaces
    │   ├── rule.ts              # Rule system types (RuleType, MatchType, etc.)
    │   ├── bookmark.ts          # Bookmark and tag types
    │   ├── storage.ts           # Storage and data persistence types
    │   ├── template.ts          # Container template types
    │   └── index.ts             # Consolidated type exports
    ├── constants/               # Application constants
    │   └── index.ts             # Message types, storage keys, defaults
    └── utils/                   # Shared utility functions
        ├── messaging.ts         # Type-safe message passing service
        ├── logger.ts            # Structured logging system
        ├── csv.ts               # CSV import/export functionality
        ├── patternValidator.ts  # URL pattern validation
        ├── containerHelpers.ts  # Container utility functions
        ├── containerColors.ts   # Container color definitions
        └── duplicateRules.ts    # Duplicate rule detection utilities
```

## Data Model

### Core Entity Types

#### Container
```typescript
interface Container {
  id: string                    // Unique identifier
  name: string                  // Display name
  icon: string                  // Icon identifier (fingerprint, briefcase, etc.)
  color: string                 // Color identifier (blue, red, etc.)
  cookieStoreId: string         // Firefox container ID
  created: number               // Creation timestamp
  modified: number              // Last modification timestamp
  temporary: boolean            // Auto-delete when empty
  syncEnabled: boolean          // Include in sync (future feature)
  metadata?: {
    description?: string
    customIcon?: string
    lifetime?: "permanent" | "untilLastTab"
    categories?: string[]
    notes?: string
  }
}
```

#### Rule System
```typescript
enum RuleType {
  INCLUDE = "include",    // Open URLs in specified container
  EXCLUDE = "exclude",    // Break out of container for specific patterns
  RESTRICT = "restrict",  // Force URLs into specific container
}

enum MatchType {
  EXACT = "exact",        // Exact URL matching
  DOMAIN = "domain",      // Domain-only matching
  GLOB = "glob",         // Glob pattern matching
  REGEX = "regex",       // Regular expression matching
}

interface Rule {
  id: string
  containerId?: string    // Optional for EXCLUDE rules
  pattern: string         // URL pattern to match
  matchType: MatchType    // Pattern interpretation method
  ruleType: RuleType      // Action to take when matched
  priority: number        // Resolution order (higher = first)
  enabled: boolean        // Active/inactive toggle
  created: number
  modified: number
  metadata: {
    description?: string
    source?: "user" | "bookmark" | "import"
    tags?: string[]
  }
}
```

#### Bookmark System
- **Native Firefox Bookmarks** - Uses Firefox's bookmark API for core bookmark data
- **Metadata Layer** - Additional container associations, tags, and custom properties
- **Tag System** - Custom tagging with color-coded organization
- **Bulk Operations** - Mass container assignment, tag management, opening operations

## State Management Architecture

### Zustand Store Design

The application uses a modular Zustand architecture with domain-specific stores:

#### Store Responsibilities
- **appStore.ts** - Application initialization, cross-store orchestration, global error/loading aggregation
- **containerStore.ts** - Container CRUD operations with optimistic updates
- **ruleStore.ts** - Rule management with priority-based sorting and pattern testing
- **bookmarkStore.ts** - Firefox bookmark integration with metadata layer and tag management
- **statsStore.ts** - Usage statistics, trend analysis, activity tracking
- **themeStore.ts** - Theme management with system preference detection
- **preferencesStore.ts** - User preferences and settings persistence
- **uiStateStore.ts** - UI-specific state (search, filters, pagination, view modes)

#### Key Features
- **Optimistic Updates** - Immediate UI feedback with error rollback
- **Selective Subscriptions** - Fine-grained reactivity to minimize re-renders
- **Cross-Store Effects** - Automated cleanup (e.g., deleting container removes related rules)
- **Global State Monitoring** - Centralized error and loading state aggregation
- **Type Safety** - Full TypeScript integration with proper inference

#### Store Usage Patterns
```typescript
// Individual store access
const containers = useContainers()                    // containers array
const { create, update, delete: deleteContainer } = useContainerActions()  // actions
const loading = useContainerLoading()                 // loading state
const error = useContainerError()                     // error state

// App-level state
const { isInitialized, initializationError, retry } = useAppInitialization()
const { errors, hasErrors, clearErrors } = useGlobalErrors()
const { isLoading, containers: containerLoading } = useGlobalLoading()
```

## Background Services Architecture

### Service Layer Responsibilities

#### StorageService (src/background/services/StorageService.ts)
- **Primary Storage Interface** - All data persistence through browser.storage.local
- **Data Migration** - Version-based schema migrations for compatibility
- **Backup/Restore** - Complete data export/import functionality
- **Preference Management** - User settings with type-safe defaults

#### RulesEngine (src/background/services/RulesEngine.ts)
- **Pattern Matching** - URL evaluation against rules with caching
- **Priority Resolution** - RESTRICT > EXCLUDE > INCLUDE priority hierarchy
- **Rule Management** - CRUD operations with validation and conflict detection
- **Performance Optimization** - Memoized evaluation for repeated URLs

#### ContainerManager (src/background/services/ContainerManager.ts)
- **Firefox Integration** - Direct contextual identities API usage
- **Lifecycle Management** - Container creation, updates, deletion, cleanup
- **Synchronization** - Regular sync with Firefox container state
- **Cookie Management** - Container-specific cookie clearing operations

#### RequestInterceptor (src/background/services/RequestInterceptor.ts)
- **URL Interception** - webRequest API integration for navigation events
- **Container Routing** - Automatic tab creation/redirection based on rules
- **Tab Management** - Efficient tab handling and cleanup
- **Bookmark Parameter Processing** - ?silo=container-id URL parameter handling

#### BookmarkService (src/background/services/BookmarkService.ts)
- **Full Bookmark CRUD** - Complete bookmark management through Firefox API
- **Metadata Layer** - Additional properties (tags, container associations)
- **Bulk Operations** - Mass operations (tag assignment, container routing, deletion)
- **Migration Support** - Legacy bookmark association migration

#### StatsService (src/background/services/StatsService.ts)
- **Usage Tracking** - Tab creation, navigation, activation events
- **Session Management** - Tab session duration tracking
- **Trend Analysis** - Daily/weekly usage patterns and container trends
- **Activity Logging** - Recent activity feed with privacy considerations

#### TagService (src/background/services/TagService.ts)
- **Tag Management** - CRUD operations for bookmark tags
- **Color System** - Tag color assignment and organization
- **Bulk Tag Operations** - Mass tag assignment/removal across bookmarks

## Message Passing System

### Type-Safe Communication

The messaging system uses a comprehensive type-safe approach for browser extension communication:

#### Core Message Infrastructure
```typescript
interface Message<T = unknown> {
  type: string
  payload?: T
  requestId?: string
}

interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
```

#### Message Categories (src/shared/constants/index.ts)
- **Container Operations** - GET_CONTAINERS, CREATE_CONTAINER, UPDATE_CONTAINER, DELETE_CONTAINER
- **Rule Operations** - GET_RULES, CREATE_RULE, UPDATE_RULE, DELETE_RULE, EVALUATE_URL
- **Bookmark Operations** - Full CRUD + bulk operations (25+ message types)
- **Statistics** - GET_STATS, GET_DAILY_STATS, GET_ACTIVE_TABS, RECORD_STAT_EVENT
- **Storage** - GET_PREFERENCES, BACKUP_DATA, RESTORE_DATA
- **Testing** - TEST_PATTERN, TEST_INTERCEPTOR

#### Messaging Service (src/shared/utils/messaging.ts)
- **Request/Response Handling** - Automatic request ID generation and correlation
- **Error Propagation** - Structured error handling with type safety
- **Service Methods** - High-level methods for common operations (getContainers(), createRule(), etc.)

## Build System Architecture

### Development Workflow

The build system uses a hybrid approach with Extension CLI and custom build scripts:

#### Build Process
1. **React Component Compilation** - esbuild compiles TypeScript React components to IIFE bundles
2. **CSS Processing** - Tailwind CSS compilation with PostCSS optimization
3. **Asset Bundling** - JavaScript and CSS bundles created in `temp/` directory
4. **Extension Packaging** - Extension CLI packages everything for Firefox installation

#### Key Scripts (package.json)
```bash
npm run dev              # Development server with hot reloading
npm run build            # Production build (calls build-all.js)
npm run test             # Jest test suite
npm run test:coverage    # Coverage report generation
npm run type-check       # TypeScript validation
npm run fmt              # Biome formatting and linting
```

#### Build Outputs
```
temp/                    # Intermediate build artifacts
├── popup.iife.js       # Popup JavaScript bundle
├── popup.iife.css      # Popup CSS bundle
├── options.iife.js     # Options JavaScript bundle
└── options.iife.css    # Options CSS bundle

dist/                   # Final extension package
└── firefox/            # Firefox-specific build
```

#### Entry Points
- **popup.html** - Loads popup.iife.js/css, provides React mount point
- **options.html** - Loads options.iife.js/css, opens in full browser tab
- **Background Script** - Direct TypeScript compilation via Extension CLI

## URL Matching Engine

### Pattern Types
1. **EXACT** - `https://example.com/specific/path` (complete URL match)
2. **DOMAIN** - `example.com` (matches all paths, protocols, subdomains)  
3. **GLOB** - `*.example.com/admin/*` (wildcard pattern matching)
4. **REGEX** - `^https://.*\.example\.com/admin/.*$` (regular expression)

### Rule Priority Resolution
```
1. RESTRICT rules (highest priority - security enforcement)
2. EXCLUDE rules (container breakout - medium priority)  
3. INCLUDE rules (sorted by priority value, higher first)
4. Default container (if configured in preferences)
5. No action (current container or firefox-default)
```

### Performance Optimizations
- **Memoized Evaluation** - Cached results for repeated URL patterns
- **Early Termination** - Stop on first RESTRICT/EXCLUDE match
- **Pre-compiled Patterns** - Regex compilation with error handling
- **Efficient Rule Sorting** - Priority-based pre-sorting for optimal evaluation order

## Testing Strategy

### Multi-Layer Testing Approach

#### Test Configuration (jest.config.js)
- **Environment** - jsdom for DOM simulation
- **Coverage Thresholds** - 80% global, 90% for critical background services
- **Module Resolution** - @/* path mapping for clean imports
- **TypeScript Integration** - ts-jest with ESM support

#### Testing Frameworks
- **Unit Testing** - Jest for background services and utilities  
- **Component Testing** - React Testing Library for UI components
- **E2E Testing** - Playwright for complete extension workflows
- **Coverage Reporting** - HTML, LCOV, and JSON formats

#### Critical Test Areas
- **Background Services** (90% coverage requirement)
- **URL Pattern Matching** - Comprehensive matcher test suite
- **Rule Evaluation** - Priority resolution and edge cases
- **Bookmark Operations** - CRUD and bulk operations
- **CSV Import/Export** - Data format validation and error handling

## Development Guidelines

### Code Quality Tools

#### Biome Configuration (biome.json)
- **Unified Tooling** - Single tool for formatting and linting (replaces ESLint + Prettier)
- **TypeScript Support** - Full TypeScript integration with React-specific rules
- **Accessibility Rules** - Basic a11y linting for UI components
- **Import Organization** - Automatic import sorting and cleanup

#### TypeScript Configuration (tsconfig.json)
- **Target** - ES2020 for modern browser compatibility
- **Strict Mode** - Disabled for gradual migration flexibility
- **Path Mapping** - @/* aliases for clean imports
- **Extension Types** - Chrome, Firefox WebExt, and testing type definitions

### Styling Guidelines

#### Tailwind CSS Approach
- **Utility-First** - All styling via Tailwind utility classes
- **No Custom CSS** - Avoid custom CSS files; use Tailwind's design system
- **Responsive Design** - Mobile-first responsive utilities (sm:, md:, lg:)
- **Dark Mode Support** - Built-in dark mode class toggling

```tsx
// ✅ Preferred approach
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800">
  <span className="text-sm font-medium">Container Name</span>
  <button className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded">
    Edit
  </button>
</div>

// ❌ Avoid inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

## LLM Agent Development Hints

### Common Development Tasks

#### Adding New Background Services
1. Create service in `src/background/services/`
2. Add message types to `src/shared/constants/index.ts`
3. Register message handlers in `src/background/index.ts`
4. Add messaging methods to `src/shared/utils/messaging.ts`
5. Create Zustand store in `src/ui/shared/stores/`

#### Creating New UI Components  
1. Add component to appropriate directory (`src/ui/shared/components/`)
2. Use Tailwind CSS for all styling
3. Import shared types from `@/shared/types`
4. Connect to Zustand stores via selector hooks
5. Add comprehensive TypeScript props interface

#### Implementing New Rule Types
1. Add enum value to `RuleType` in `src/shared/types/rule.ts`
2. Update pattern matching logic in `src/background/utils/matcher.ts`
3. Modify rule evaluation in `src/background/services/RulesEngine.ts`
4. Update UI rule creation/editing components
5. Add test cases for new rule behavior

#### Adding New Statistics
1. Extend event types in `StatsService.ts`
2. Add data collection points in background event listeners
3. Create aggregation methods for new statistics
4. Add UI components for displaying statistics
5. Update storage schema if needed

### Key File Locations for Common Tasks

- **URL Pattern Matching** - `src/background/utils/matcher.ts`
- **Message Type Definitions** - `src/shared/constants/index.ts` 
- **Type Definitions** - `src/shared/types/*.ts`
- **Core Background Logic** - `src/background/index.ts`
- **Zustand Store Patterns** - `src/ui/shared/stores/*.ts`
- **Reusable UI Components** - `src/ui/shared/components/`
- **Modal System** - `src/ui/shared/components/Modal.tsx`
- **Test Setup** - `tests/setup.ts`

### Quality Assurance Commands

```bash
# Development workflow
npm run dev                    # Hot-reloading development server
npm run type-check            # TypeScript validation
npm run fmt                   # Biome formatting and linting
npm run test                  # Full test suite
npm run test:coverage         # Generate coverage report
npm run build                 # Production build

# Extension debugging
# 1. Load extension: about:debugging -> Load Temporary Add-on -> manifest.json
# 2. Background script: about:debugging -> Inspect (background script)
# 3. Popup debugging: Right-click extension icon -> Inspect
# 4. Options page: Open options -> F12 Developer Tools
```

### Performance Considerations

- **Rule Evaluation** - Target <1ms for 1000+ rules with memoization
- **Memory Usage** - Monitor background script memory consumption
- **Bundle Size** - Minimize popup bundle for fast loading
- **Storage Operations** - Batch operations to reduce I/O overhead
- **UI Responsiveness** - Optimistic updates with error rollback patterns

### Security Considerations

- **Input Validation** - Validate all user input and external data
- **URL Pattern Safety** - Sanitize regex patterns to prevent DoS
- **Storage Privacy** - Don't log sensitive URLs or user data
- **Permission Principle** - Use minimal required permissions
- **Content Security Policy** - Strict CSP prevents XSS attacks

This documentation reflects the current state of the Silo codebase and provides comprehensive guidance for development and maintenance.