# Silo

This whole thing has been built with Claude Code. I've hardly checked the code at all so use at your own risk. Don't trust it just because the agent wrote "tests"

> A modern Firefox WebExtension for automatic container management based on intelligent URL rules

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)

Silo automatically opens websites in specific Firefox containers based on configurable rules, providing enhanced privacy, security, and organization for your browsing experience.

<p align="center">
  <img src="./images/extension_128.png" alt="Silo Extension Icon" width="96" height="96" />
</p>


## 🚀 Features

### 🎯 Advanced Rule System
- **Multiple Rule Types**: Include, Exclude, and Restrict rules with priority support
- **Flexible Pattern Matching**: Domain, exact URL, glob patterns, and regular expressions
- **Smart Priority Resolution**: Higher priority rules override lower ones
- **Real-time Rule Testing**: Interactive pattern tester for rule validation

### 📦 Container Management
- **Full Container Control**: Create, edit, delete Firefox containers directly from the extension
- **Temporary Containers**: Auto-delete containers when no tabs remain
- **Visual Customization**: Custom icons, colors, and naming
- **Deep Firefox Integration**: Seamless Firefox container API integration

### 🔖 Bookmark Integration
- **Container Bookmarks**: Save bookmarks with container associations using `?silo=container-id`
- **Bulk Management**: Assign containers to bookmark folders
- **URL Processing**: Clean URLs after container redirection

### 📊 Import/Export
- **CSV Support**: Bulk import/export rules in CSV format
- **Template Generation**: Generate CSV templates for easy bulk editing
- **Missing Container Handling**: Automatically create containers during import
- **Comprehensive Validation**: Error checking and reporting

### 🎨 Modern UI
- **React-based Interface**: Fast, responsive, modern design
- **Theme Support**: Light, dark, and automatic system theme detection
- **Real-time Updates**: Live data synchronization with React Query
- **Responsive Design**: Optimized for both popup and full-page contexts

## 🛠️ Technology Stack

- **Language**: TypeScript with strict mode
- **UI Framework**: React 18 with hooks
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Query for server state
- **Build System**: Custom esbuild configuration
- **Testing**: Jest with React Testing Library
- **Browser APIs**: Firefox WebExtension APIs

## 📦 Installation

### From Firefox Add-ons (Recommended)
*Coming soon - extension will be published to Firefox Add-ons store*

### Development Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/silo/silo.git
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

## 🚀 Development

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Firefox 91+

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Lint code
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

### Project Structure

```
src/
├── background/              # Background service worker
│   ├── services/           # Core business logic
│   └── utils/              # Background utilities
├── ui/                     # React-based interfaces
│   ├── popup/              # Extension popup
│   ├── options/            # Settings page
│   └── shared/             # Shared UI components
└── shared/                 # Shared types and utilities
    ├── types/              # TypeScript definitions
    ├── constants/          # App constants
    └── utils/              # Shared utilities
```

## 📖 Usage

### Basic Usage
1. **Install the extension** and pin it to your toolbar
2. **Click the extension icon** to open the popup
3. **Select a container** from the dropdown
4. **Click "Open in container"** to open the current tab in the selected container
5. **Use "+ Add domain"** to create a rule for the current domain

### Creating Rules
1. Open the **Options page** (click "Manage Containers" in popup)
2. Navigate to the **Rules** section
3. Click **"+ New Rule"**
4. Configure:
   - **Pattern**: URL pattern to match (e.g., `github.com`, `*.example.com`, `/admin/*`)
   - **Match Type**: How to interpret the pattern (Domain, Exact, Glob, Regex)
   - **Rule Type**: What action to take (Include, Exclude, Restrict)
   - **Container**: Target container (not needed for Exclude rules)
   - **Priority**: Rule precedence (higher numbers = higher priority)

### Rule Types Explained

- **Include Rules**: Open matching URLs in the specified container (if not already in a container)
- **Exclude Rules**: Break out of containers for matching URLs (open in default)
- **Restrict Rules**: Force URLs to only open in the specified container (security)

### Bulk Import
1. Go to **Options > Import/Export**
2. Download a **CSV template** or prepare your own
3. Format: `pattern,container_name,match_type,rule_type,priority`
4. **Import CSV** file with option to create missing containers

## 🔧 Configuration

### Container Templates
Pre-configured container setups available:
- **Work**: Blue briefcase icon, permanent
- **Personal**: Purple gift icon, permanent  
- **Banking**: Green dollar icon, temporary
- **Social**: Pink fruit icon, permanent
- **Dev**: Orange tree icon, permanent

### Advanced Settings
- **Theme**: Light, dark, or auto (system)
- **Keep Old Tabs**: Whether to close original tabs when redirecting
- **Default Container**: Fallback container for unmatched URLs
- **Performance Mode**: Optimizations for large rule sets

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test StorageService.test.ts

# Debug tests
npm test -- --verbose
```

### Test Structure
- **Unit Tests**: Service logic and utilities
- **Component Tests**: React components and hooks
- **Integration Tests**: Service interactions

## 🐛 Troubleshooting

### Common Issues

**Extension not loading**
- Check `manifest.json` syntax
- Verify required permissions
- Check browser console for errors

**Rules not working**
- Use the **Pattern Tester** in settings
- Check rule priority order
- Verify container exists and is active

**UI not updating**
- Check React Query cache
- Refresh the popup/options page
- Check browser developer tools

### Debug Tools
- **Settings Page**: Interceptor test tool
- **Browser DevTools**: React and background script debugging
- **about:debugging**: Extension inspection

## 🤝 Contributing

We welcome contributions! 

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

### Code Style
- **TypeScript**: Strict mode with comprehensive types
- **React**: Functional components with hooks
- **Testing**: Required for new features
- **Documentation**: JSDoc for public APIs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Firefox Team**: For the excellent Contextual Identities API
- **Extension.js**: For modern extension development tooling
- **React Team**: For the amazing UI framework
- **TypeScript Team**: For type safety and developer experience

## 📞 Support

- **Documentation**: Full documentation in [CLAUDE.md](CLAUDE.md)
- **Issues**: [GitHub Issues](https://github.com/jamesmacfie/silo/issues)

---

**Made with ❤️ for Firefox users who value privacy and organization**
