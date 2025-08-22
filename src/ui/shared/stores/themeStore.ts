import React from "react"
import browser from "webextension-polyfill"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { MESSAGE_TYPES } from "@/shared/constants"

type Theme = "light" | "dark" | "auto"

interface ThemeState {
  theme: Theme
  resolvedTheme: "light" | "dark"
  loading: boolean
  error?: string

  actions: {
    load: () => Promise<void>
    setTheme: (theme: Theme) => Promise<void>
    resolveTheme: (theme: Theme) => void
    clearError: () => void
  }
}

let mediaQuery: MediaQueryList | null = null

export const useThemeStore = create<ThemeState>()(
  subscribeWithSelector((set, get) => ({
    theme: "auto",
    resolvedTheme: "dark",
    loading: false,
    error: undefined,

    actions: {
      load: async () => {
        set({ loading: true, error: undefined })

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_PREFERENCES,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to fetch preferences")
          }

          const theme = response.data?.theme || "auto"
          set({ theme, loading: false })
          get().actions.resolveTheme(theme)
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: false,
          })
        }
      },

      setTheme: async (newTheme) => {
        try {
          // Get current preferences
          const prefResponse = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_PREFERENCES,
          })

          if (!prefResponse?.success) {
            throw new Error("Failed to get current preferences")
          }

          // Update with new theme
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_PREFERENCES,
            payload: {
              ...prefResponse.data,
              theme: newTheme,
            },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to update theme")
          }

          set({ theme: newTheme })
          get().actions.resolveTheme(newTheme)
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      resolveTheme: (theme) => {
        if (theme === "auto") {
          // Clean up existing listener
          if (mediaQuery) {
            mediaQuery.removeEventListener("change", handleSystemThemeChange)
          }

          mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
          set({ resolvedTheme: mediaQuery.matches ? "dark" : "light" })

          mediaQuery.addEventListener("change", handleSystemThemeChange)
        } else {
          // Clean up listener when not using auto
          if (mediaQuery) {
            mediaQuery.removeEventListener("change", handleSystemThemeChange)
            mediaQuery = null
          }
          set({ resolvedTheme: theme })
        }
      },

      clearError: () => set({ error: undefined }),
    },
  })),
)

const handleSystemThemeChange = (e: MediaQueryListEvent) => {
  const currentTheme = useThemeStore.getState().theme
  if (currentTheme === "auto") {
    useThemeStore.setState({ resolvedTheme: e.matches ? "dark" : "light" })
  }
}

// Custom hook that mimics the original ThemeContext interface
export const useTheme = () => {
  const theme = useThemeStore((state) => state.theme)
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme)
  const loading = useThemeStore((state) => state.loading)
  const setTheme = useThemeStore((state) => state.actions.setTheme)

  return {
    theme,
    resolvedTheme,
    setTheme,
    loading,
  }
}

export const useThemeLoading = () => useThemeStore((state) => state.loading)
export const useThemeError = () => useThemeStore((state) => state.error)

// Effect hook to apply theme to document (replaces the useEffect in ThemeProvider)
export const useThemeEffects = () => {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme)

  React.useEffect(() => {
    const root = document.documentElement

    if (resolvedTheme === "dark") {
      root.classList.add("dark")
      root.classList.remove("light")
    } else {
      root.classList.add("light")
      root.classList.remove("dark")
    }

    // Also set data attribute for CSS
    root.setAttribute("data-theme", resolvedTheme)
  }, [resolvedTheme])
}

// Initialization hook to be called in app startup
export const useThemeInitialization = () => {
  const load = useThemeStore((state) => state.actions.load)

  React.useEffect(() => {
    load()
  }, [load])
}
