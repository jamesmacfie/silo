# Silo

This whole thing has been built with Claude Code. I've hardly checked the code at all so use at your own risk. Don't trust it just because the agent wrote "tests"

> Automatic container routing for Firefox -- assign websites to containers with rules, manage bookmarks with container context, and see how you use your containers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2020-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Firefox](https://img.shields.io/badge/Firefox-91%2B-orange.svg)](https://www.mozilla.org/firefox/)

<p align="center">
  <img src="./images/extension_128.png" alt="Silo Extension Icon" width="96" height="96" />
</p>

## Why Silo Exists

Firefox Multi-Account Containers let you isolate websites into separate browsing contexts -- different cookies, sessions, and storage for each container. This is powerful for privacy, separating work from personal browsing, and managing multiple accounts on the same service. But Firefox gives you no way to automate it. Every time you open a site, you have to remember which container it belongs in and manually open it there.

Silo fixes that. You write rules -- "open github.com in my Dev container", "restrict banking.com to my Finance container" -- and Silo intercepts every navigation to enforce them automatically. It also extends Firefox bookmarks with container associations and tags, gives you a statistics dashboard showing how you use your containers, and provides a full import/export system for moving your setup between browsers.

It's built for privacy-conscious users who use containers seriously: developers juggling staging and production environments, people with multiple accounts on the same service, or anyone who wants their browsing compartmentalized without the manual overhead.

## Features

### Automatic Container Routing

- Rule engine with 4 match types: exact URL, domain (with subdomain and path support), glob, and regex
- 3 rule types: Include (open in container), Exclude (break out of container), Restrict (force into container)
- Priority-based resolution: Restrict > Exclude > Include
- Inline prefix overrides: `@` for regex, `!` for glob
- Interactive pattern tester for validating rules before saving
- Duplicate rule detection and resolution

### Container Management

- Full CRUD for Firefox containers with custom names, icons, and colors
- Temporary containers that auto-delete when their last tab closes
- Container templates for quick setup
- Cookie clearing per container
- Sync with Firefox's native container list

### Bookmark Management

- Firefox bookmark integration with a metadata layer for container associations
- Tag system with color-coded organization
- Drag-and-drop reordering via hierarchical tree view
- Table view for bulk operations
- Fuzzy search across all bookmarks
- Bulk actions: assign containers, assign tags, open in containers, delete

### Import/Export

- Rules (JSON) -- export and import rule sets with validation and preview
- Containers (JSON) -- full container configuration
- Tags (JSON) -- tag definitions with color mappings
- Silo bookmarks (JSON) -- Firefox bookmarks with Silo metadata, container associations, and tags
- Cross-browser bookmarks (Netscape HTML) -- standard format compatible with Chrome, Edge, Safari
- Complete data backup (JSON) -- everything in one file for full system restore

### Statistics Dashboard

- Per-container usage: tabs opened, navigations, rule matches, time spent
- Global aggregates and daily breakdowns
- Container usage trends
- Active tab tracking
- Recent activity feed

### Popup Interface

- Workflow-first action panel focused on likely tasks
- Quick actions: move current tab, open new tab in container, create site rule, temp container + open now, bookmark with container context
- Searchable target-container picker with keyboard navigation
- Keyboard shortcuts for speed (`/`, `1-5`, `Enter`, `m`, `r`, `?`)

### Options Page

Full-tab management interface with sections for: Dashboard, Containers, Rules, Bookmarks, Tags, Import/Export, and Settings.

- SaaS-style app shell with persistent sidebar navigation
- Keyboard section switching (`1-7`)
- Container management master-detail workflow with search, filtering, and quick actions
- Container-page keyboard workflow (`/`, `j/k`, `n`, `e`, `c`, `Delete`, `r`)

### Other

- Theme support: light, dark, and auto (follows system)
- Configurable notifications for rule matches, restrictions, and exclusions

## Technology Stack

| Category          | Technology                                                |
|-------------------|-----------------------------------------------------------|
| Language          | TypeScript (non-strict, ES2020)                           |
| UI                | React 18                                                  |
| State management  | Zustand                                                   |
| Styling           | Tailwind CSS                                              |
| Code quality      | Biome (format + lint)                                     |
| Build             | esbuild + Extension CLI + Tailwind CLI                    |
| Testing           | Jest + React Testing Library + Playwright                 |
| Drag-and-drop     | @dnd-kit                                                  |
| Search            | fuse.js                                                   |
| Icons             | lucide-react                                              |
| Validation        | zod                                                       |
| Browser APIs      | webextension-polyfill                                     |

## Installation

### Development Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jamesmacfie/silo.git
   cd silo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Firefox:
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `manifest.json` from the project directory

## Development

### Prerequisites

- Node.js 16+
- Firefox 91+

### Commands

```bash
npm run dev            # Dev server with hot reload
npm run build          # Production build
npm run test           # Jest test suite
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run test:e2e       # Playwright e2e tests
npm run type-check     # TypeScript validation
npm run fmt            # Biome format + lint (auto-fix)
npm run fmt:check      # Biome check (no auto-fix)
```

### Loading for Development

1. Run `npm run dev`
2. Open `about:debugging` in Firefox
3. Click "Load Temporary Add-on"
4. Select `manifest.json`
5. The popup is accessible from the toolbar icon; the options page opens in a full tab

## Usage

### Quick Start

1. Install the extension and pin it to your toolbar
2. Click the Silo icon to open the popup
3. Pick a target container, choose the action tab you want (move/open/rule/temp/bookmark), then press `Enter`
4. Open full management from the popup when you need deeper configuration
5. Navigate away and back -- Silo will automatically open the site in the correct container

### Creating Rules

1. Open the options page (click "Manage" in the popup, or right-click the icon)
2. Go to the Rules section
3. Click "New Rule" and configure:
   - **Pattern**: the URL pattern to match (e.g., `github.com`, `*.example.com/admin/*`)
   - **Match type**: Domain, Exact, Glob, or Regex
   - **Rule type**: Include, Exclude, or Restrict
   - **Container**: target container (not required for Exclude rules)
   - **Priority**: higher numbers take precedence within the same rule type

### Rule Types

- **Include**: Open matching URLs in the specified container when navigating from the default context. If already in a different container, the rule is ignored.
- **Exclude**: Break out of any container for matching URLs -- they open in the default (no container) context.
- **Restrict**: Force matching URLs into the specified container regardless of current context. This is the strongest rule type.

### Keyboard Workflows

Popup:
- `/` focus container search
- `1-5` switch likely-action tabs
- `Enter` execute selected action
- `m` open management
- `r` refresh popup context
- `?` show/hide shortcut reference

Container Management:
- `/` focus search
- `j` / `k` move selection through containers
- `n` new container
- `e` edit selected container
- `c` clear selected container cookies
- `Delete` / `Backspace` delete selected container
- `r` jump to Rules filtered by selected container

### Managing Bookmarks

The Bookmarks section in the options page provides:
- Tree view with drag-and-drop reordering
- Table view for bulk operations
- Tag assignment and filtering
- Container association for each bookmark
- Fuzzy search across all bookmarks

### Import/Export

Go to the Import/Export section in the options page. Each data type (rules, containers, tags, bookmarks) can be exported and imported independently as JSON. For cross-browser bookmark portability, use the Netscape HTML format. For full system backup/restore, use the complete backup option.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical architecture including layer diagrams, data flows, event bindings, storage schema, and the URL matching engine.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
