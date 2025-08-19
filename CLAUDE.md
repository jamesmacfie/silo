# Silo - Firefox Extension Codebase Documentation

## Project Overview

Silo is a modern Firefox WebExtension that automatically opens websites in specific Firefox containers based on configurable rules. The extension features a sophisticated TypeScript/React architecture with comprehensive rule management, container integration, and modern development tooling.

**Version:** 2.0.0 (manifest) / 0.0.1 (development)  
**License:** MIT  
**Minimum Firefox Version:** 91.0  
**Framework:** TypeScript + React + Tailwind CSS  
**Build System:** Extension CLI + Custom esbuild scripts

## Technology Stack

- **Runtime:** Firefox WebExtension APIs (browser.*) with webextension-polyfill
- **Language:** TypeScript with strict mode configuration
- **UI Framework:** React 18 with functional components and hooks
- **Styling:** Tailwind CSS with PostCSS processing and custom design system (utility-first approach)
- **State Management:** 
  - Zustand for comprehensive client state management
  - Modular store architecture with domain-specific stores
  - Optimistic updates and error handling
- **Build Tools:** 
  - Extension CLI for development and packaging
  - Custom esbuild-based build scripts for components
  - Tailwind CSS compilation with PostCSS
- **Testing:** 
  - Jest with jsdom environment for unit tests
  - React Testing Library for component testing
  - Playwright for end-to-end testing
- **Package Manager:** npm with lockfile

## Architecture Overview

### Core Principles
1. **Type Safety First** - Comprehensive TypeScript coverage with strict mode
2. **Reactive UI** - React-based components with modern hooks patterns  
3. **Service-Oriented Backend** - Modular background services with clear responsibilities
4. **Rule-Based Engine** - Sophisticated pattern matching with priority-based resolution
5. **Container Integration** - Deep Firefox contextual identities API integration
6. **Developer Experience** - Hot reloading, comprehensive testing, and modern tooling

### Extension Structure

The extension follows a dual-entry architecture with separate HTML entry points for different contexts:

#### Entry Points
- **Popup Interface** (`src/popup/index.html`) - Loads the compiled popup React application
- **Options Page** (`src/options/index.html`) - Loads the compiled options React application  
- **Background Script** (`src/background/index.ts`) - Main service worker entry point

#### Project Structure

```
src/
├── background/              # Background service worker
│   ├── index.ts            # Main background script entry point
│   ├── services/           # Core business logic services
│   │   ├── BookmarkIntegration.ts   # Bookmark-container associations
│   │   ├── ContainerManager.ts      # Firefox container CRUD operations
│   │   ├── RequestInterceptor.ts    # URL interception and redirection
│   │   ├── RulesEngine.ts          # Rule evaluation and management
│   │   └── StorageService.ts       # Data persistence
│   └── utils/
│       └── matcher.ts              # URL pattern matching algorithms
│
├── popup/                   # Popup HTML entry point
│   ├── index.html          # Popup HTML shell
│   └── index.ts            # Popup JavaScript entry point
│
├── options/                 # Options HTML entry point
│   └── index.html          # Options page HTML shell
│
├── ui/                     # React-based user interfaces
│   ├── popup/              # Extension popup (React components)
│   │   ├── index.tsx       # Popup React application entry
│   │   ├── index.css       # Popup-specific styles
│   │   └── components/     # Popup-specific components
│   │
│   ├── options/            # Settings/options page (React components)
│   │   ├── index.tsx       # Options page React application entry
│   │   ├── index.css       # Options-specific styles
│   │   ├── ContainerModal.tsx      # Container creation/editing modal
│   │   └── RuleModal.tsx          # Rule creation/editing modal
│   │
│   └── shared/             # Shared UI components and utilities
│       ├── components/     # Reusable React components
│       │   ├── BookmarkManager.tsx    # Bookmark-container management
│       │   ├── CSVImportExport.tsx   # Bulk rule import/export
│       │   ├── PatternTester.tsx     # Interactive rule testing
│       │   ├── ThemeSwitcher.tsx     # Dark/light theme toggle
│       │   └── [Additional components] # Card, ContainerCard, RuleCard, etc.
│       ├── stores/         # Zustand state management stores
│       │   ├── containerStore.ts     # Container state and actions
│       │   ├── ruleStore.ts         # Rule state and actions
│       │   ├── themeStore.ts        # Theme state management
│       │   ├── preferencesStore.ts  # User preferences state
│       │   ├── bookmarkStore.ts     # Bookmark associations state
│       │   ├── appStore.ts          # App initialization and orchestration
│       │   └── index.ts             # Store exports and convenience hooks
│       ├── hooks/          # Custom React hooks (legacy - being replaced by stores)
│       │   ├── useBookmarks.ts       # Bookmark operations
│       │   ├── useContainers.ts      # Container data fetching
│       │   └── useRules.ts          # Rule management
│       └── providers/      # Application providers
│           └── QueryProvider.tsx     # React Query configuration (legacy)
│
└── shared/                 # Shared types and utilities
    ├── types/              # TypeScript type definitions
    │   ├── container.ts    # Container-related types
    │   ├── rule.ts         # Rule system types
    │   ├── storage.ts      # Storage interface types
    │   ├── template.ts     # Container template types
    │   └── index.ts        # Type exports
    ├── constants/
    │   └── index.ts        # Message types and constants
    └── utils/              # Shared utility functions
        ├── csv.ts          # CSV parsing and generation
        ├── logger.ts       # Logging utilities
        ├── messaging.ts    # Message passing abstractions
        ├── patternValidator.ts # URL pattern validation
        ├── containerHelpers.ts # Container utility functions
        └── __mocks__/      # Test mocks
```

### UI Component Philosophy

The shared UI components follow a design system approach:
- **Atomic Design** - Small, reusable components that compose into larger features
- **Consistent Styling** - Tailwind CSS with shared design tokens
- **Accessibility First** - ARIA compliance and keyboard navigation
- **Performance Optimized** - React.memo and efficient re-renders
- **Type Safe** - Full TypeScript coverage with prop validation

Examples of component categories:
- **Layout Components** - Cards, headers, navigation elements
- **Form Components** - Inputs, selectors, modals
- **Data Components** - Rule displays, container management
- **Utility Components** - Theme switchers, search inputs, status indicators

### Styling Guidelines

The project strictly follows Tailwind CSS utility-first methodology:

- **Tailwind CSS First** - All styling should use Tailwind utility classes (`className="flex items-center gap-2"`)
- **Avoid Custom CSS** - Custom CSS files should only be used for component-specific styles that cannot be achieved with Tailwind
- **No Inline Styles** - Never use `style={{}}` props; use Tailwind classes instead
- **Design Tokens** - Leverage Tailwind's built-in spacing, colors, and typography scales for consistency
- **Responsive Design** - Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) for adaptive layouts
- **Theme Integration** - Utilize CSS variables and Tailwind's dark mode support for theme switching

**Preferred Approach:**
```tsx
// ✅ Good - Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Rule Name</span>
  <button className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded">
    Edit
  </button>
</div>

// ❌ Avoid - Inline styles
<div style={{ display: 'flex', padding: '16px', backgroundColor: '#fff' }}>
  <span style={{ fontSize: '14px', fontWeight: '500' }}>Rule Name</span>
</div>

// ❌ Avoid - Custom CSS classes (unless absolutely necessary)
<div className="custom-rule-container">
  <span className="rule-name">Rule Name</span>
</div>
```

**Tailwind Configuration:**
- Content paths include all TypeScript/TSX files and HTML templates
- Custom theme extensions should be minimal and well-documented
- PostCSS processes Tailwind directives and optimizes for production builds

### Utility Functions

Shared utilities provide cross-cutting functionality:
- **Pattern Matching** (`patternValidator.ts`) - URL pattern validation and testing
- **Data Processing** (`csv.ts`) - Import/export functionality with error handling
- **Browser Communication** (`messaging.ts`) - Type-safe message passing between contexts
- **Container Operations** (`containerHelpers.ts`) - Firefox container API abstractions
- **Logging** (`logger.ts`) - Structured logging with environment-aware levels

## Core Features Implemented

### 1. Advanced Rule System
- **Rule Types:**
  - `INCLUDE` - Open URLs in specified container (if not already in a container)
  - `EXCLUDE` - Break out of container for specific patterns
  - `RESTRICT` - Force URLs into specific container regardless of current context

- **Match Types:**
  - `EXACT` - Exact URL matching
  - `DOMAIN` - Domain-only matching  
  - `GLOB` - Glob pattern matching with wildcards
  - `REGEX` - Regular expression matching

- **Priority System:** Higher priority rules take precedence with sophisticated resolution
- **Interactive Testing** - Real-time pattern testing and validation
- **Rule Management** - Full CRUD operations with optimistic updates

### 2. Container Management
- **Firefox Integration** - Direct contextual identities API integration
- **CRUD Operations** - Create, read, update, delete containers with full lifecycle management
- **Temporary Containers** - Auto-cleanup when no tabs remain
- **Container Metadata** - Extended properties, categorization, and user-defined fields
- **Visual Customization** - Icons, colors, and naming with Firefox container API

### 3. Bookmark Integration
- **Query Parameter Support** - `?silo=container-id` URL parameters for container routing
- **Association Storage** - Persistent bookmark-container mappings
- **Bulk Management** - Folder-level container assignments
- **URL Processing** - Automatic parameter cleanup after container routing

### 4. CSV Import/Export
- **Flexible Export** - Multiple export formats with configurable field selection
- **Import Validation** - Comprehensive error reporting with line-by-line feedback
- **Missing Container Handling** - Option to create containers during import process
- **Template Generation** - CSV templates for bulk rule editing

### 5. Theme System
- **Multi-Theme Support** - Light, dark, and system preference detection
- **Persistent Settings** - Theme preferences with cross-session storage
- **Zustand Integration** - Centralized theme state with efficient updates
- **CSS Variable System** - Dynamic theme switching without page reload

### 6. Modern User Interface
- **Responsive Design** - Optimized layouts for popup constraints and full-page contexts
- **Interactive Components** - Modals, dropdowns, search, filtering with smooth animations
- **Real-time Updates** - Zustand stores for efficient data synchronization and optimistic updates
- **Accessibility** - ARIA compliance, keyboard navigation, and screen reader support

## Data Model

### Container Type
```typescript
interface Container {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  icon: string;                  // Icon identifier
  color: string;                 // Color identifier  
  cookieStoreId: string;         // Firefox container ID
  created: number;               // Creation timestamp
  modified: number;              // Last modification timestamp
  temporary: boolean;            // Auto-delete when empty
  syncEnabled: boolean;          // Include in sync (future feature)
  metadata?: {
    description?: string;
    category?: string;
    [key: string]: unknown;
  };
}
```

### Rule Type
```typescript
interface Rule {
  id: string;                    // Unique identifier
  containerId?: string;          // Target container (optional for EXCLUDE)
  pattern: string;               // URL pattern to match
  matchType: MatchType;          // How to interpret pattern
  ruleType: RuleType;           // Action to take when matched
  priority: number;              // Resolution order (higher = first)
  enabled: boolean;              // Active/inactive toggle
  created: number;               // Creation timestamp
  modified: number;              // Last modification timestamp
  metadata: {
    description?: string;
    source?: 'user' | 'bookmark' | 'import';
    tags?: string[];
    [key: string]: unknown;
  };
}
```

### Storage Schema
```typescript
// Rules storage
rules: Rule[]

// Containers storage (synced from Firefox)
containers: Container[]

// Bookmark associations
bookmarkAssociations: BookmarkAssociation[]

// User preferences
preferences: {
  theme: 'light' | 'dark' | 'auto';
  keepOldTabs: boolean;
  defaultContainer?: string;
  [key: string]: unknown;
}
```

## State Management Architecture

### Zustand Store Design

The application uses a modular Zustand store architecture with domain-specific stores that manage their own state and actions:

#### Store Structure
- **containerStore.ts** - Container CRUD operations, loading states, and error handling
- **ruleStore.ts** - Rule management with priority sorting and pattern testing
- **themeStore.ts** - Theme state with system preference detection and CSS application
- **preferencesStore.ts** - User preferences management and persistence
- **bookmarkStore.ts** - Bookmark associations and Firefox bookmarks tree integration
- **appStore.ts** - Application initialization orchestration and cross-store effects

#### Key Features
- **Optimistic Updates** - Immediate UI updates with error rollback for better UX
- **Selective Subscriptions** - Components only re-render when their specific data changes
- **Type Safety** - Full TypeScript integration with proper type inference
- **Error Boundaries** - Per-store error handling with global error aggregation
- **Cross-Store Communication** - Clean dependency management between related stores

#### Usage Patterns
```typescript
// Individual store usage
const containers = useContainers();
const { create, update, delete } = useContainerActions();
const loading = useContainerLoading();
const error = useContainerError();

// App initialization
const { isInitialized, initializationError, retry } = useAppInitialization();

// Global state monitoring
const { errors, hasErrors, clearErrors } = useGlobalErrors();
const loading = useGlobalLoading();
```

#### Migration from React Query
The Zustand stores replace the previous React Query + Context pattern:
- **useContainers()** replaces the old useContainers hook
- **useRules()** replaces the old useRules hook  
- **useTheme()** replaces ThemeContext
- **Messaging Layer** remains unchanged - stores communicate with background services

## Service Layer Architecture

### Background Services

#### StorageService
- **Responsibility:** All data persistence operations with browser.storage API
- **Features:** Data persistence, backup/restore, preference management, migration support
- **Storage Strategy:** Local storage for performance, sync preparation for future cross-device support

#### RulesEngine  
- **Responsibility:** Rule evaluation and URL matching with caching
- **Features:** Pattern matching, priority resolution, memoized evaluation
- **Performance:** Sub-millisecond evaluation for large rule sets with efficient algorithms

#### ContainerManager
- **Responsibility:** Firefox container lifecycle management
- **Features:** CRUD operations, API integration, temporary container cleanup, metadata management

#### RequestInterceptor
- **Responsibility:** URL interception and redirection handling
- **Features:** webRequest API integration, tab management, container routing, bookmark parameter processing

#### BookmarkIntegration
- **Responsibility:** Bookmark-container associations and URL parameter handling
- **Features:** Query parameter processing, association storage, bulk bookmark management

## Build System Architecture

### Development Workflow

The build system uses a hybrid approach combining the Extension CLI with custom build scripts:

1. **Extension CLI** - Handles development server, hot reloading, and browser packaging
2. **Custom Build Scripts** - Handle React component compilation and CSS processing
3. **Temporary Build Directory** - Intermediate build artifacts in `temp/` directory
4. **Multi-Browser Support** - Generates browser-specific builds

### Build Process

#### Development Commands
```bash
npm run dev                    # Start development with hot reloading
npm run dev:firefox           # Start development with Firefox specifically
npm run build                 # Production build for all browsers
npm run build:firefox         # Production build for Firefox only
```

#### Build Pipeline
1. **TypeScript Compilation** - React components compiled to JavaScript with esbuild
2. **CSS Processing** - Tailwind CSS compilation with PostCSS and optimization
3. **Asset Bundling** - JavaScript and CSS bundles created in `temp/` directory
4. **HTML Shell Generation** - Simple HTML files that load the compiled bundles
5. **Extension Packaging** - Extension CLI packages everything for browser installation

#### Build Outputs
```
temp/                          # Intermediate build artifacts
├── popup.iife.js              # Popup JavaScript bundle
├── popup.iife.css             # Popup CSS bundle
├── options.iife.js            # Options JavaScript bundle
└── options.iife.css           # Options CSS bundle

dist/                          # Final extension packages (browser-specific)
├── firefox/                   # Firefox-specific build
└── chrome/                    # Chrome-specific build (if applicable)
```

### Entry Point Architecture

#### HTML Entry Points
The extension uses minimal HTML shells that load the compiled React applications:

**Popup** (`src/popup/index.html`):
- Loads `popup.iife.js` and `popup.iife.css`
- Provides `<div id="root">` for React mounting
- Optimized for popup size constraints (400x600px)

**Options** (`src/options/index.html`):  
- Loads `options.iife.js` and `options.iife.css`
- Provides `<div id="root">` for React mounting
- Opens in full browser tab for complex management interfaces

## Message Passing System

Type-safe communication between UI and background contexts:

### Core Message Types
```typescript
// Container operations
GET_CONTAINERS, CREATE_CONTAINER, UPDATE_CONTAINER, DELETE_CONTAINER

// Rule operations  
GET_RULES, CREATE_RULE, UPDATE_RULE, DELETE_RULE, EVALUATE_URL

// Bookmark operations
GET_BOOKMARK_ASSOCIATIONS, ADD_BOOKMARK_ASSOCIATION, REMOVE_BOOKMARK_ASSOCIATION

// Data operations
BACKUP_DATA, RESTORE_DATA, EXPORT_CSV, IMPORT_CSV

// UI operations
OPEN_IN_CONTAINER, TEST_PATTERN, TEST_INTERCEPTOR
```

## URL Matching Engine

### Pattern Types
1. **Exact Match** - `https://example.com/path`
2. **Domain Match** - `example.com` (matches all paths and subdomains)
3. **Glob Pattern** - `*.example.com` or `example.com/*`
4. **Regex Pattern** - `^https://.*\.example\.com/admin/.*$`

### Priority Resolution Algorithm
```
1. RESTRICT rules (highest priority - security enforcement)
2. EXCLUDE rules (container breakout)
3. INCLUDE rules (sorted by priority value, higher first)
4. Default container (if configured)
5. No action (lowest priority)
```

### Performance Optimizations
- **Rule Caching** - Memoized evaluation results for repeated URLs
- **Pattern Compilation** - Pre-compiled regex patterns with validation
- **Efficient Sorting** - Rules pre-sorted by specificity and priority
- **Early Termination** - Stop evaluation on first matching RESTRICT/EXCLUDE rule

## Testing Strategy

### Multi-Layer Testing Approach

#### Unit Testing
- **Framework:** Jest with jsdom environment for DOM simulation
- **Coverage:** Background services, utilities, and core business logic
- **Mocking:** Browser APIs and extension context simulation
- **Target Coverage:** >90% for critical paths

#### Component Testing  
- **Framework:** React Testing Library for user-centric testing
- **Coverage:** UI components, hooks, and user interaction flows
- **Integration:** Component integration with mocked services and contexts
- **Accessibility:** ARIA and keyboard navigation testing

#### End-to-End Testing
- **Framework:** Playwright for full browser automation
- **Coverage:** Extension installation, rule creation, and container management workflows
- **Browser Testing:** Firefox-specific functionality and API integration

#### Test Structure
```
tests/
├── unit/
│   ├── background/services/          # Service layer tests
│   ├── shared/utils/                 # Utility function tests
│   └── ui/                          # Component and hook tests
├── e2e/                             # Playwright end-to-end tests
└── setup.ts                        # Jest configuration and global mocks
```

## Development Workflow

### Getting Started
```bash
# Install dependencies
npm install

# Start development server with hot reloading
npm run dev

# Load extension in Firefox
# Navigate to about:debugging -> This Firefox -> Load Temporary Add-on
# Select manifest.json from the project root
```

### Code Quality Pipeline
- **TypeScript:** Strict mode with comprehensive type coverage
- **ESLint:** React and TypeScript-specific rules with automatic fixing
- **Testing:** Required test coverage for new features and bug fixes
- **Pre-commit Hooks:** Automated quality checks before commits

### Quality Assurance Commands
```bash
# Development commands
npm run dev                    # Development server with hot reloading
npm run test                   # Unit and component test suite
npm run test:watch            # Interactive test development
npm run test:e2e              # End-to-end test suite

# Quality assurance
npm run type-check            # TypeScript type validation
npm run lint                  # ESLint validation
npm run lint:fix              # Automatic ESLint fixes
npm run check                 # Combined type-check and lint
npm run test:coverage         # Coverage report generation
```

## Performance Characteristics

### Rule Evaluation Performance
- **Target:** <1ms evaluation time for 1000+ rules
- **Caching Strategy:** Memoized results for repeated URL patterns
- **Optimization:** Efficient pattern matching with early termination

### Memory Management
- **Target:** <50MB total memory footprint
- **Optimization:** Lazy loading, efficient data structures, automatic cleanup
- **Monitoring:** Performance tracking for large rule sets

### UI Responsiveness
- **Target:** <100ms interaction response time
- **Zustand Stores:** Efficient state management with optimistic updates and selective re-renders
- **Code Splitting:** Lazy loading of heavy components and features

## Security Considerations

### Input Validation
- **Runtime Validation:** Zod schemas for all user inputs and API responses
- **Pattern Sanitization:** Safe regex compilation with error handling
- **URL Validation:** Comprehensive URL parsing and security checks

### Permission Model
- **Minimal Permissions:** Only essential permissions requested
- **Contextual Identities:** Deep Firefox container integration
- **Storage Security:** Local storage only, no external network communication
- **Content Security Policy:** Strict CSP for extension pages

### Extension Permissions
```json
{
  "permissions": [
    "storage",           // Local data persistence
    "tabs",             // Tab management and creation
    "cookies",          // Container-aware cookie handling
    "webRequest",       // URL interception
    "webRequestBlocking", // Synchronous request modification
    "contextualIdentities", // Firefox container management
    "notifications",    // User notifications
    "bookmarks",        // Bookmark integration
    "<all_urls>"        // Universal URL access for rule matching
  ]
}
```

## Debugging and Development Tools

### Browser DevTools Integration
- **React DevTools:** Component inspection and state debugging
- **Source Maps:** TypeScript debugging in browser with full source mapping
- **Extension DevTools:** Background script and popup inspection

### Extension-Specific Debugging
```bash
# Background script debugging
about:debugging -> Inspect background script

# Popup debugging  
Right-click extension icon -> Inspect Popup

# Options page debugging
Open options page -> F12 Developer Tools

# Console logging
Structured logging with environment-aware levels
```

### Development Tools
- **Hot Reloading:** Automatic extension reload during development
- **Test Coverage:** Visual coverage reports with lcov integration
- **Performance Profiling:** Browser profiler integration for performance analysis

## Future Architecture Considerations

### Planned Enhancements
1. **Firefox Sync Integration** - Cross-device rule and container synchronization
2. **Advanced Analytics** - Usage statistics and performance insights  
3. **Plugin Architecture** - Extensible rule system with custom handlers
4. **Performance Dashboard** - Real-time monitoring and optimization recommendations

### Scalability Preparations
- **Database Migration Path** - Structured storage evolution
- **API Versioning** - Message passing system versioning
- **Configuration Management** - Advanced preference system
- **Internationalization** - Multi-language support infrastructure

## Troubleshooting

### Common Development Issues
1. **Extension Loading Failures** - Manifest syntax and permission validation
2. **Rule Evaluation Problems** - Pattern syntax validation in interactive tester
3. **Build Process Errors** - TypeScript compilation and dependency resolution
4. **Hot Reload Issues** - Extension CLI configuration and browser connection

### Debug Workflows
1. **Rule Debugging** - Interactive pattern tester and interceptor test tools
2. **UI State Issues** - React DevTools and Zustand DevTools integration  
3. **Background Service Issues** - Browser console and structured logging
4. **Store State Debugging** - Direct store state inspection and action tracing
5. **Performance Analysis** - Browser profiler and React Profiler integration

This documentation reflects the current state of the Silo codebase and should be updated as the architecture evolves.