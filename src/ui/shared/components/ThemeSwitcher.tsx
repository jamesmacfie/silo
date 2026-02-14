import { useTheme } from "../stores"

interface Props {
  compact?: boolean
}

const THEME_OPTIONS = [
  {
    value: "auto",
    label: "Auto",
    icon: "🌓",
    description: "Match system preference",
  },
  {
    value: "light",
    label: "Light",
    icon: "☀️",
    description: "Light theme",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "🌙",
    description: "Dark theme",
  },
] as const

export function ThemeSwitcher({ compact = false }: Props): JSX.Element {
  const { theme, setTheme, loading } = useTheme()

  if (loading) {
    return <div className="theme-switcher loading">Loading...</div>
  }

  if (compact) {
    return (
      <div className="theme-switcher compact">
        <div
          role="radiogroup"
          aria-label="Theme"
          className="inline-flex items-center rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-0.5 shadow-sm"
        >
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.value
            return (
              <label
                key={option.value}
                title={option.label}
                className={`h-7 min-w-7 px-1.5 rounded text-xs leading-none transition-colors cursor-pointer inline-flex items-center justify-center ${
                  selected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                <input
                  type="radio"
                  name="theme-compact"
                  value={option.value}
                  checked={selected}
                  onChange={() =>
                    void setTheme(option.value as "auto" | "light" | "dark")
                  }
                  className="sr-only"
                  aria-label={`Theme: ${option.label}`}
                />
                <span aria-hidden="true">{option.icon}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  // Full version for settings page
  return (
    <div className="theme-switcher">
      <h3>Theme</h3>
      <p className="description">
        Choose how Silo appears. Auto will match your system preference.
      </p>

      <div className="theme-options">
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`theme-option ${theme === option.value ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={(e) =>
                setTheme(e.target.value as "light" | "dark" | "auto")
              }
            />
            <div className="theme-preview">
              <div className="icon">{option.icon}</div>
              <div className="details">
                <div className="name">{option.label}</div>
                <div className="desc">{option.description}</div>
              </div>
            </div>
          </label>
        ))}
      </div>

      <style>{`
        .theme-switcher {
          margin-bottom: 2rem;
        }

        .theme-switcher.compact {
          margin: 0;
        }

        .theme-switcher.loading {
          opacity: 0.6;
          font-size: 0.9rem;
          color: var(--text-secondary, #6c757d);
        }

        .theme-switcher h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .description {
          margin: 0 0 1rem 0;
          color: var(--text-secondary, #6c757d);
          font-size: 0.9rem;
        }

        .theme-options {
          display: grid;
          gap: 0.5rem;
        }

        .theme-option {
          cursor: pointer;
          display: block;
        }

        .theme-option input {
          display: none;
        }

        .theme-preview {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border: 2px solid var(--border, #dee2e6);
          border-radius: 8px;
          background: var(--surface, #f8f9fa);
          transition: all 0.2s ease;
        }

        .theme-option:hover .theme-preview {
          border-color: var(--primary, #4a90e2);
        }

        .theme-option.selected .theme-preview {
          border-color: var(--primary, #4a90e2);
          background: var(--primary-light, rgba(74, 144, 226, 0.1));
        }

        .icon {
          font-size: 1.5rem;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .details {
          flex: 1;
        }

        .name {
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .desc {
          font-size: 0.85rem;
          color: var(--text-secondary, #6c757d);
        }

        /* Dark theme styles */
        :root.dark .theme-preview {
          background: #343a40;
          border-color: #495057;
        }

        :root.dark .theme-option.selected .theme-preview {
          background: rgba(74, 144, 226, 0.2);
          border-color: #5ba0f2;
        }
      `}</style>
    </div>
  )
}
