import React from 'react';
import browser from 'webextension-polyfill';
import { MESSAGE_TYPES } from '@/shared/constants';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  loading: boolean;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function useTheme(): ThemeContextType {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface Props {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: Props): JSX.Element {
  const [theme, setThemeState] = React.useState<Theme>('auto');
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = React.useState(true);

  // Load initial theme from preferences
  React.useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_PREFERENCES,
        });

        if (response?.success) {
          const preferences = response.data;
          setThemeState(preferences.theme || 'auto');
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Resolve auto theme based on system preference
  React.useEffect(() => {
    const resolveTheme = () => {
      if (theme === 'auto') {
        // Check system preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
        return mediaQuery;
      } else {
        setResolvedTheme(theme === 'dark' ? 'dark' : 'light');
        return null;
      }
    };

    const mediaQuery = resolveTheme();
    
    if (mediaQuery) {
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Apply theme to document
  React.useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Also set data attribute for CSS
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = React.useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);

    try {
      // Save to preferences
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_PREFERENCES,
      });

      if (response?.success) {
        const preferences = response.data;
        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.UPDATE_PREFERENCES,
          payload: {
            ...preferences,
            theme: newTheme,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    loading,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}