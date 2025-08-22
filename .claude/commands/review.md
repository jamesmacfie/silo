You are a reviewe of this codebase and have been givin this a request Keeping these things in mind: 

This document outlines the standards and patterns reviewers should enforce when reviewing code changes in the Silo Firefox extension. The codebase emphasizes simplicity, consistency, and clear architectural boundaries.

## Core Review Principles

### 1. Architectural Adherence
- **Respect the layered architecture** - UI components should not directly interact with browser APIs
- **Maintain separation of concerns** - Background services handle business logic, UI handles presentation
- **Follow the established message passing patterns** - All background communication must go through the messaging system

### 2. Code Clarity & Readability
- **Code should tell a story** - Functions and components should have clear, single responsibilities
- **Prefer explicit over clever** - Choose readable code over performance micro-optimizations
- **Use descriptive names** - Variables, functions, and components should clearly indicate their purpose

## Shared UI Component Standards

### Component Reusability Requirements

**✅ DO: Use existing shared components**
```tsx
// Use the established Modal system
import { Modal, ModalFormRow, ModalLabel, ModalInput } from "@/ui/shared/components/Modal"

// Use shared layout components
import { PageLayout, PageHeader } from "@/ui/shared/components/layout"

// Use shared data display components
import { Card } from "@/ui/shared/components/Card"
```

**❌ DON'T: Create duplicate functionality**
```tsx
// Don't create custom modals when Modal exists
const CustomModal = ({ children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50"> {/* Wrong */}
```

### Component Design Standards

**Required for new shared components:**
- **TypeScript props interface** - All props must be fully typed
- **Consistent styling approach** - Use Tailwind CSS exclusively, no custom CSS
- **Accessibility compliance** - ARIA labels, keyboard navigation, focus management
- **Responsive design** - Mobile-first responsive breakpoints
- **Dark mode support** - All components must work in both light and dark themes

**Component structure template:**
```tsx
interface ComponentProps {
  // All props explicitly typed
  required: string
  optional?: boolean
  onAction: (data: SpecificType) => void
}

export const Component: React.FC<ComponentProps> = ({ 
  required, 
  optional = false, 
  onAction 
}) => {
  // Component logic here
  
  return (
    <div className="flex items-center gap-2 p-4 bg-white dark:bg-gray-800">
      {/* Tailwind CSS only */}
    </div>
  )
}
```

### When to Create New Shared Components

**Create shared components when:**
- The pattern appears in 3+ places
- The component encapsulates complex logic that benefits from reuse
- The component implements a design system pattern (buttons, inputs, cards)

**Don't create shared components for:**
- Single-use page-specific layouts
- Simple wrapper divs with basic styling
- Components tightly coupled to specific business logic

## Message Passing Architecture

### Background ↔ UI Communication Standards

**✅ Correct message passing pattern:**
```tsx
// 1. Define message type in constants
// src/shared/constants/index.ts
export const MESSAGE_TYPES = {
  GET_NEW_FEATURE_DATA: "GET_NEW_FEATURE_DATA",
  CREATE_NEW_FEATURE: "CREATE_NEW_FEATURE"
} as const

// 2. Add background message handler
// src/background/index.ts
case MESSAGE_TYPES.GET_NEW_FEATURE_DATA: {
  const data = await newFeatureService.getData()
  return { success: true, data }
}

// 3. Add messaging service method
// src/shared/utils/messaging.ts
async getNewFeatureData(): Promise<FeatureData[]> {
  const response = await this.sendMessage<FeatureData[]>(
    MESSAGE_TYPES.GET_NEW_FEATURE_DATA
  )
  return response.data || []
}

// 4. Use in Zustand store
// src/ui/shared/stores/featureStore.ts
const response = await browser.runtime.sendMessage({
  type: MESSAGE_TYPES.GET_NEW_FEATURE_DATA
})
```

**❌ Anti-patterns to reject:**
```tsx
// Don't bypass the messaging system
const data = await browser.storage.local.get() // Wrong - UI shouldn't touch storage directly

// Don't use untyped messages
browser.runtime.sendMessage({ type: "some-random-string" }) // Wrong - not in MESSAGE_TYPES

// Don't ignore error handling
const data = await browser.runtime.sendMessage(msg) // Wrong - no error handling
```

### Message Flow Requirements

**All new background communication must:**
1. **Add message type constant** to `src/shared/constants/index.ts`
2. **Implement background handler** in `src/background/index.ts`
3. **Add typing to messaging service** in `src/shared/utils/messaging.ts`
4. **Use in Zustand stores** - UI components should access via stores, not direct messaging

**Error handling requirements:**
```tsx
// Always handle errors in message passing
try {
  const response = await browser.runtime.sendMessage({ type, payload })
  if (!response?.success) {
    throw new Error(response?.error || "Operation failed")
  }
  return response.data
} catch (error) {
  // Set error state, log appropriately
  set({ error: error instanceof Error ? error.message : "Unknown error" })
  throw error
}
```

## Code Quality Standards

### Function and Component Clarity

**✅ Clear, purposeful functions:**
```tsx
// Good - single responsibility, clear purpose
const validateBookmarkUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Good - descriptive component name and props
interface BookmarkFilterProps {
  tags: Tag[]
  selectedTags: string[]
  onTagSelect: (tagId: string) => void
}

const BookmarkFilters: React.FC<BookmarkFilterProps> = ({ 
  tags, 
  selectedTags, 
  onTagSelect 
}) => {
  // Clear, focused component logic
}
```

**❌ Unclear patterns to reject:**
```tsx
// Bad - unclear purpose, multiple responsibilities
const doStuff = (data: any) => {
  // processes bookmarks
  // updates containers  
  // sends notifications
  // ... too many responsibilities
}

// Bad - vague naming
const BookmarkThing = ({ stuff, onStuff }) => { /* unclear what this does */ }
```

### Variable and Function Naming

**Required naming conventions:**
- **Boolean variables**: Use `is`, `has`, `should`, `can` prefixes (`isVisible`, `hasContainer`)
- **Event handlers**: Use `handle` prefix (`handleBookmarkSelect`, `handleContainerCreate`)
- **Async functions**: Use descriptive verbs (`fetchBookmarks`, `createContainer`, `updateRule`)
- **Constants**: Use SCREAMING_SNAKE_CASE (`MESSAGE_TYPES`, `DEFAULT_PREFERENCES`)

### Code Organization Standards

**File structure requirements:**
- **Imports grouped**: React/external libraries → internal utilities → components → types
- **Component exports**: Use named exports for components, default export for single-purpose modules
- **Type definitions**: Co-locate interfaces with their usage, extract to shared types when used across files

```tsx
// ✅ Good import organization
import React from "react"
import { create } from "zustand"
import browser from "webextension-polyfill"

import { MESSAGE_TYPES } from "@/shared/constants"
import { Container } from "@/shared/types"
import { logger } from "@/shared/utils/logger"

import { Modal } from "@/ui/shared/components/Modal"
import { useContainers } from "@/ui/shared/stores"
```

## Library Usage Philosophy

### Zustand State Management

**Why Zustand:** Simple, lightweight, TypeScript-first state management without boilerplate

**Required patterns:**
```tsx
// ✅ Correct Zustand store structure
interface StoreState {
  data: DataType[]
  loading: boolean
  error?: string
  
  actions: {
    load: () => Promise<void>
    create: (item: CreateRequest) => Promise<DataType>
    clearError: () => void
  }
}

export const useStore = create<StoreState>()(
  subscribeWithSelector((set, get) => ({
    data: [],
    loading: false,
    error: undefined,
    
    actions: {
      load: async () => {
        set({ loading: true, error: undefined })
        try {
          // ... implementation
          set({ data: newData, loading: false })
        } catch (error) {
          set({ error: error.message, loading: false })
        }
      },
      // ... other actions
    }
  }))
)

// Provide selector hooks for components
export const useData = () => useStore(state => state.data)
export const useActions = () => useStore(state => state.actions)
```

### Tailwind CSS Styling

**Why Tailwind:** Utility-first approach prevents CSS bloat and ensures design consistency

**Required styling patterns:**
```tsx
// ✅ Use Tailwind utilities exclusively
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
    Content
  </span>
  <button className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">
    Action
  </button>
</div>

// ❌ Don't use custom CSS or inline styles
<div style={{ display: 'flex', padding: '16px' }}> {/* Wrong */}
<div className="custom-container"> {/* Wrong - avoid custom CSS */}
```

### React Patterns

**Why these patterns:** Hooks-first functional components with clear data flow

**Required React patterns:**
- **Functional components only** - No class components
- **Hooks for state management** - useState for local state, Zustand stores for shared state
- **TypeScript props** - All component props must be explicitly typed
- **Error boundaries** - Wrap complex components in error boundaries where appropriate

### Testing Approach

**Why Jest + RTL:** Industry standard with excellent TypeScript support and component testing capabilities

**Required testing patterns:**
```tsx
// ✅ Component testing pattern
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  it('should handle user interaction correctly', () => {
    const mockHandler = jest.fn()
    render(<ComponentName onAction={mockHandler} />)
    
    fireEvent.click(screen.getByRole('button', { name: /action/i }))
    
    expect(mockHandler).toHaveBeenCalledWith(expectedData)
  })
})

// ✅ Service testing pattern  
import { serviceName } from './serviceName'

describe('serviceName', () => {
  it('should process data correctly', async () => {
    const result = await serviceName.processData(inputData)
    
    expect(result).toEqual(expectedOutput)
  })
})
```

## Review Checklist

### For Every Pull Request

**Architecture & Design:**
- [ ] Changes follow the established message passing patterns
- [ ] New UI components use shared components where possible
- [ ] Background services maintain clear separation of concerns
- [ ] Zustand stores follow the established patterns

**Code Quality:**
- [ ] Functions have clear, single responsibilities
- [ ] Variable and function names are descriptive and follow conventions
- [ ] TypeScript types are comprehensive and accurate
- [ ] Error handling is implemented consistently

**UI & Styling:**
- [ ] Uses Tailwind CSS exclusively (no custom CSS or inline styles)
- [ ] Components work in both light and dark themes
- [ ] Responsive design is implemented appropriately
- [ ] Accessibility standards are met (ARIA, keyboard navigation)

**Testing & Documentation:**
- [ ] New functionality includes appropriate tests
- [ ] Complex business logic has unit tests
- [ ] UI components have interaction tests where appropriate
- [ ] Code changes are self-documenting through clear structure

**Performance & Security:**
- [ ] No unnecessary re-renders or expensive operations in render paths
- [ ] User input is properly validated and sanitized
- [ ] Sensitive data handling follows security best practices
- [ ] Bundle size impact is reasonable for the functionality added

### Common Rejection Criteria

**Immediate rejection for:**
- Direct browser API usage in UI components (must go through background services)
- Custom CSS when Tailwind utilities would suffice
- Untyped or poorly typed TypeScript
- Missing error handling in async operations
- Duplicate functionality when shared components exist
- Breaking established naming conventions
- Missing accessibility considerations

### Questions to Ask During Review

1. **"Does this change respect the architectural boundaries?"**
2. **"Could this functionality be achieved using existing shared components?"**
3. **"Is the error handling comprehensive and user-friendly?"**
4. **"Would a new developer understand this code in 6 months?"**
5. **"Does this maintain consistency with the existing codebase patterns?"**

## Conclusion

The goal is to maintain a codebase that is simple, consistent, and maintainable. Every change should make the codebase easier to understand and extend, not more complex. When in doubt, favor simplicity and established patterns over clever solutions.

--- 

Implement the request: $ARGUMENTS
