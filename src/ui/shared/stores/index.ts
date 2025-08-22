// Store exports

export * from "./appStore"
export {
  useAppInitialization,
  useGlobalErrors,
  useGlobalLoading,
  useStoreEffects,
} from "./appStore"
export * from "./bookmarkStore"
// Bookmark exports
export {
  useBookmarkActions,
  useBookmarkError,
  useBookmarkLoading,
  useBookmarkSearchState,
  useBookmarkStore,
  useBookmarkTags,
  useBookmarkView,
  useFilteredBookmarks,
  useSelectedBookmarks,
} from "./bookmarkStore"
export * from "./containerStore"
// Re-export common hooks for convenience
export {
  useContainerActions,
  useContainerError,
  useContainerLoading,
  useContainers,
} from "./containerStore"
export * from "./preferencesStore"
export {
  usePreferences,
  usePreferencesActions,
  usePreferencesError,
  usePreferencesLoading,
} from "./preferencesStore"
export * from "./ruleStore"

export {
  useRuleActions,
  useRuleError,
  useRuleLoading,
  useRules,
} from "./ruleStore"
export * from "./statsStore"
export {
  useActiveTabs,
  useDailyStats,
  useGlobalStats,
  useRecentActivity,
  useStats,
  useStatsActions,
  useStatsError,
  useStatsLoading,
  useTrends,
} from "./statsStore"
export * from "./themeStore"
export {
  useTheme,
  useThemeEffects,
  useThemeError,
  useThemeInitialization,
  useThemeLoading,
} from "./themeStore"
export * from "./uiStateStore"

export {
  useBookmarksPageState,
  useContainersPageState,
  useRulesPageState,
  useTagsPageState,
  useUIStateStore,
} from "./uiStateStore"
