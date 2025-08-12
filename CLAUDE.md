# Silo - Firefox Extension Codebase Documentation

## Project Overview

Silo is a modern Firefox WebExtension that automatically opens websites in specific Firefox containers based on configurable rules. The extension has been completely redesigned with a modern TypeScript/React architecture, comprehensive rule system, and enhanced container management capabilities.

**Version:** 2.0.0  
**License:** MIT  
**Minimum Firefox Version:** 91.0  
**Framework:** TypeScript + React + Tailwind CSS
**Build System:** Custom esbuild-based build scripts

## Technology Stack

- **Runtime:** Firefox WebExtension APIs (browser.*)
- **Language:** TypeScript with strict mode
- **UI Framework:** React 18 with functional components and hooks
- **Styling:** Tailwind CSS with custom design system
- **State Management:** React Query for server state
- **Build Tool:** Custom esbuild configuratio
- **Testing:** Jest with React Testing Library and jsdom environment
- **Package Manager:** npm

## Architecture Overview

### Core Principles
1. **Type Safety First** - Comprehensive TypeScript coverage with strict mode
2. **Reactive UI** - React-based components with modern hooks patterns
3. **Service-Oriented Backend** - Modular background services with clear responsibilities
4. **Rule-Based Engine** - Sophisticated pattern matching with priority system
5. **Container Integration** - Deep Firefox container management capabilities

### Project Structure

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
├── ui/                     # React-based user interfaces
│   ├── popup/              # Extension popup (400x600px)
│   │   ├── index.tsx       # Popup entry point
│   │   └── components/
│   │       ├── PopupApp.tsx        # Main popup application
│   │       └── ContainerSelector.tsx # Container selection dropdown
│   │
│   ├── options/            # Settings/options page
│   │   ├── index.tsx       # Options page entry point
│   │   ├── ContainerModal.tsx      # Container creation/editing modal
│   │   └── RuleModal.tsx          # Rule creation/editing modal
│   │
│   └── shared/             # Shared UI components and utilities
│       ├── components/
│       │   ├── BookmarkManager.tsx      # Bookmark-container management
│       │   ├── CSVImportExport.tsx     # Bulk rule import/export
│       │   ├── PatternTester.tsx       # Interactive rule testing
│       │   ├── RuleItem.tsx           # Individual rule display
│       │   └── ThemeSwitcher.tsx      # Dark/light theme toggle
│       ├── contexts/
│       │   └── ThemeContext.tsx       # Theme state management
│       ├── hooks/
│       │   ├── useBookmarks.ts        # Bookmark operations
│       │   ├── useContainers.ts       # Container data fetching
│       │   └── useRules.ts           # Rule management
│       └── providers/
│           └── QueryProvider.tsx      # React Query configuration
│
└── shared/                 # Shared types and utilities
    ├── types/              # TypeScript type definitions
    │   ├── container.ts    # Container-related types
    │   ├── rule.ts         # Rule system types
    │   ├── storage.ts      # Storage interface types
    │   └── template.ts     # Container template types
    ├── constants/
    │   └── index.ts        # Message types and constants
    └── utils/
        ├── csv.ts          # CSV parsing and generation
        ├── logger.ts       # Logging utilities
        ├── messaging.ts    # Message passing abstractions
        └── patternValidator.ts # URL pattern validation
```

## Core Features Implemented

### 1. Advanced Rule System
- **Rule Types:**
  - `INCLUDE` - Open URLs in specified container (if they are not in a container already)
  - `EXCLUDE` - Break out of container for specific patterns
  - `RESTRICT` - Only allow URLs in specific container, no matter if they opened it explicitly in another container

- **Match Types:**
  - `EXACT` - Exact URL matching
  - `DOMAIN` - Domain-only matching
  - `GLOB` - Glob pattern matching (wildcards)
  - `REGEX` - Regular expression matching

- **Priority System:** Higher priority rules take precedence
- **Pattern Testing:** Interactive pattern tester component
- **Rule Management:** Full CRUD operations with real-time updates

### 2. Container Management
- **Firefox Integration:** Direct Firefox container API integration
- **CRUD Operations:** Create, read, update, delete containers
- **Temporary Containers:** Auto-delete when no tabs remain
- **Container Metadata:** Extended properties and categorization
- **Visual Customization:** Icons, colors, and naming

### 3. Bookmark Integration
- **Query Parameter Support:** `?silo=container-id` in bookmarks
- **Association Storage:** Persistent bookmark-container mappings
- **Bulk Management:** Assign container associations to bookmark folders
- **URL Processing:** Clean URLs after container redirection

### 4. CSV Import/Export
- **Flexible Export:** Multiple export formats with filtering options
- **Import Validation:** Comprehensive error checking and reporting
- **Missing Container Handling:** Option to create containers during import
- **Template Generation:** Generate CSV templates for bulk editing

### 5. Theme System
- **Multi-Theme Support:** Light, dark, and system automatic detection
- **Persistent Settings:** Theme preferences saved across sessions
- **React Context:** Centralized theme state management
- **CSS Variables:** Dynamic theme switching without page reload

### 6. User Interface
- **Modern Design:** Tailwind CSS with custom design system
- **Responsive Layout:** Optimized for popup and full-page contexts
- **Interactive Components:** Modals, dropdowns, search, and filtering
- **Real-time Updates:** React Query for efficient data synchronization

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

## Service Layer Architecture

### BackgroundServices

#### StorageService
- **Responsibility:** All data persistence operations
- **Features:** Data persistence, backup/restore, preference management
- **Storage Types:** Local storage for all data (sync not yet implemented)

#### RulesEngine
- **Responsibility:** Rule evaluation and URL matching
- **Features:** Pattern matching, priority resolution, caching
- **Performance:** Sub-millisecond evaluation for large rule sets

#### ContainerManager
- **Responsibility:** Firefox container lifecycle management
- **Features:** CRUD operations, Firefox API integration, temporary container cleanup

#### RequestInterceptor
- **Responsibility:** URL interception and redirection
- **Features:** webRequest API integration, tab management, container routing

#### BookmarkIntegration
- **Responsibility:** Bookmark-container associations
- **Features:** Query parameter processing, association storage, bookmark sync

## Message Passing System

The extension uses a comprehensive message passing system for communication between UI and background scripts:

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
2. **Domain Match** - `example.com` (matches all paths)
3. **Glob Pattern** - `*.example.com` or `example.com/*`
4. **Regex Pattern** - `^https://.*\.example\.com/admin/.*$`

### Priority Resolution
```
1. RESTRICT rules (highest priority - security)
2. EXCLUDE rules (break out of containers)
3. INCLUDE rules (by priority value, higher first)
4. Default container (if configured)
5. No action (lowest priority)
```

### Performance Optimizations
- **Rule Caching:** Memoized evaluation results
- **Pattern Compilation:** Pre-compiled regex patterns
- **Efficient Sorting:** Rules sorted by specificity and priority

## Build System

### Development Commands
```bash
npm run dev                    # Start development server
npm run build                 # Production build
npm run test                  # Run test suite
npm run type-check            # TypeScript validation
npm run lint                  # ESLint validation
```

### Build Process
1. **TypeScript Compilation** - Strict mode with full type checking
2. **React Compilation** - JSX transformation with optimization
3. **CSS Processing** - Tailwind CSS compilation and purging
4. **Asset Bundling** - esbuild-based bundling for performance
5. **Manifest Generation** - Extension manifest with proper permissions

### Output Structure
```
dist/
├── background/
│   └── index.js              # Background script bundle
├── popup/
│   ├── index.html            # Popup HTML
│   └── assets/               # Popup assets
├── options/
│   ├── index.html            # Options page HTML
│   └── assets/               # Options assets
├── images/                   # Extension icons
└── manifest.json             # Extension manifest
```

## Testing Strategy

### Unit Testing
- **Framework:** Jest with jsdom environment
- **Coverage:** Background services, utilities, and core logic
- **Mocking:** Browser APIs mocked for isolated testing

### Component Testing
- **Framework:** React Testing Library
- **Coverage:** UI components, hooks, and user interactions
- **Integration:** Component integration with mocked services

### Test Structure
```
tests/
├── unit/
│   ├── background/services/          # Service layer tests
│   ├── shared/utils/                 # Utility function tests
│   └── ui/                          # Component tests
└── setup.ts                        # Jest configuration
```

## Development Workflow

### Getting Started
```bash
# Install dependencies
npm install

# Start development
npm run dev

# Load extension in Firefox
# Navigate to about:debugging -> This Firefox -> Load Temporary Add-on
# Select manifest.json from the project root
```

### Code Quality
- **TypeScript:** Strict mode with comprehensive type coverage
- **ESLint:** React and TypeScript-specific rules
- **Testing:** Required for new features and bug fixes
- **Documentation:** JSDoc comments for public APIs

## Performance Characteristics

### Rule Evaluation
- **Target:** <1ms evaluation time for 1000+ rules
- **Caching:** Memoized results for repeated URLs
- **Optimization:** Efficient pattern matching algorithms

### Memory Usage
- **Target:** <50MB total memory footprint
- **Optimization:** Lazy loading, efficient data structures
- **Cleanup:** Automatic cleanup of temporary data

### UI Responsiveness
- **Target:** <100ms interaction response time
- **React Query:** Efficient data fetching and caching
- **Code Splitting:** Lazy loading of heavy components

## Security Considerations

### Input Validation
- **Zod Schemas:** Runtime type validation for all inputs
- **Pattern Sanitization:** Safe regex pattern compilation
- **URL Validation:** Comprehensive URL parsing and validation

### Permissions
- **Minimal Permissions:** Only required permissions requested
- **Contextual Identities:** Deep Firefox container integration
- **Storage Security:** Local storage only, no external communication

## Future Roadmap

### Planned Features (Not Yet Implemented)
1. **Firefox Sync Integration** - Cross-device rule and container sync
2. **Advanced Statistics** - Usage analytics and insights
3. **Container Templates** - Predefined container configurations
4. **Visual Indicators** - In-page container identification
5. **Performance Dashboard** - Real-time performance monitoring

### Extension Points
- **Plugin System:** Extensible architecture for future enhancements
- **API Exposure:** External extension integration capabilities
- **Custom Themes:** User-defined theme system

## Debugging and Development Tools

### Browser DevTools Integration
- **React DevTools:** Component inspection and state debugging
- **Source Maps:** TypeScript debugging in browser
- **Console Logging:** Structured logging with levels

### Extension Debugging
```bash
# Debug background script
about:debugging -> Inspect background script

# Debug popup
Right-click extension icon -> Inspect Popup

# Debug options page
Open options page -> F12 Developer Tools
```

### Testing and Validation
```bash
# Run all tests
npm test

# Type checking
npm run type-check

# Lint checking
npm run lint

# Coverage report
npm run test:coverage
```

## Command Reference

### Essential Commands for Development
```bash
# Development
npm run dev                    # Start development build with watching
npm run build                 # Production build
npm run test                  # Run test suite
npm run test:watch            # Test in watch mode

# Code Quality
npm run type-check            # TypeScript type checking
npm run lint                  # ESLint validation
npm run lint:fix              # Auto-fix ESLint issues

# Specialized Builds
npm run build:popup           # Build popup only
npm run build:options         # Build options page only
npm run build:icons           # Generate icon assets
```

## Troubleshooting

### Common Issues
1. **Extension Not Loading:** Check manifest.json syntax and permissions
2. **Rules Not Working:** Verify pattern syntax in pattern tester
3. **UI Not Updating:** Check React Query cache invalidation
4. **Build Failures:** Verify TypeScript compilation and dependency versions

### Debug Workflows
1. **Rule Issues:** Use Settings page interceptor test tool
2. **UI Issues:** Use React DevTools for component inspection
3. **Background Issues:** Check browser console in about:debugging
4. **Performance Issues:** Use browser profiler and performance tab

