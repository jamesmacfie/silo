// Store exports
export * from './containerStore';
export * from './ruleStore';
export * from './themeStore';
export * from './preferencesStore';
export * from './bookmarkStore';
export * from './appStore';
export * from './statsStore';

// Re-export common hooks for convenience
export {
  useContainers,
  useContainerActions,
  useContainerLoading,
  useContainerError,
} from './containerStore';

export {
  useRules,
  useRuleActions,
  useRuleLoading,
  useRuleError,
} from './ruleStore';

export {
  useTheme,
  useThemeLoading,
  useThemeError,
  useThemeEffects,
  useThemeInitialization,
} from './themeStore';

export {
  usePreferences,
  usePreferencesActions,
  usePreferencesLoading,
  usePreferencesError,
} from './preferencesStore';

export {
  useBookmarkAssociations,
  useBookmarksTree,
  useBookmarkActions,
  useBookmarkLoading,
  useBookmarkError,
} from './bookmarkStore';

export {
  useAppInitialization,
  useStoreEffects,
  useGlobalErrors,
  useGlobalLoading,
} from './appStore';

export {
  useStats,
  useGlobalStats,
  useActiveTabs,
  useRecentActivity,
  useDailyStats,
  useTrends,
  useStatsLoading,
  useStatsError,
  useStatsActions,
} from './statsStore';