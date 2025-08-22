import React from "react"
import type { MatchType } from "@/shared/types"
import {
  getPatternExamples,
  suggestMatchType,
  validatePattern,
} from "@/shared/utils/patternValidator"
import { useRuleActions } from "../stores"

interface Props {
  pattern: string
  matchType: MatchType
  onPatternChange?: (pattern: string) => void
  onMatchTypeChange?: (matchType: MatchType) => void
  className?: string
}

export function PatternTester({
  pattern,
  matchType,
  onPatternChange,
  onMatchTypeChange,
  className = "",
}: Props): JSX.Element {
  const { testPattern } = useRuleActions()
  const [testUrl, setTestUrl] = React.useState("")
  const [testResult, setTestResult] = React.useState<{
    matches: boolean
    tested: boolean
  }>({ matches: false, tested: false })
  const [isTesting, setIsTesting] = React.useState(false)

  // Validate pattern
  const validation = React.useMemo(() => {
    if (!pattern) return { isValid: true }
    return validatePattern(pattern, matchType)
  }, [pattern, matchType])

  // Get examples for current match type
  const examples = React.useMemo(
    () => getPatternExamples(matchType),
    [matchType],
  )

  // Suggest match type based on pattern
  const suggestedMatchType = React.useMemo(() => {
    if (!pattern) return null
    const suggested = suggestMatchType(pattern)
    return suggested !== matchType ? suggested : null
  }, [pattern, matchType])

  const handleTest = React.useCallback(async () => {
    if (!testUrl || !pattern || !validation.isValid) return

    setIsTesting(true)
    try {
      const matches = await testPattern(testUrl, pattern, matchType)
      setTestResult({ matches, tested: true })
    } catch (_error) {
      setTestResult({ matches: false, tested: true })
    } finally {
      setIsTesting(false)
    }
  }, [testUrl, pattern, matchType, validation.isValid, testPattern])

  const handleUseExample = React.useCallback(
    (example: string) => {
      onPatternChange?.(example)
    },
    [onPatternChange],
  )

  const handleUseSuggestion = React.useCallback(() => {
    if (suggestedMatchType) {
      onMatchTypeChange?.(suggestedMatchType)
    }
  }, [suggestedMatchType, onMatchTypeChange])

  return (
    <div className={`pattern-tester ${className}`}>
      {/* Pattern Validation */}
      {validation.error && (
        <div className="validation-message error">
          <strong>Error:</strong> {validation.error}
          {validation.suggestion && (
            <button
              type="button"
              className="suggestion-btn"
              onClick={() => onPatternChange?.(validation.suggestion)}
            >
              Use: {validation.suggestion}
            </button>
          )}
        </div>
      )}

      {validation.warning && (
        <div className="validation-message warning">
          <strong>Warning:</strong> {validation.warning}
        </div>
      )}

      {/* Match Type Suggestion */}
      {suggestedMatchType && (
        <div className="validation-message suggestion">
          <strong>Suggestion:</strong> This pattern looks like it should use{" "}
          {suggestedMatchType} matching.
          <button
            type="button"
            className="suggestion-btn"
            onClick={handleUseSuggestion}
          >
            Switch to {suggestedMatchType}
          </button>
        </div>
      )}

      {/* Pattern Tester */}
      <div className="test-section">
        <h4>Test Pattern</h4>
        <div className="test-controls">
          <input
            type="text"
            className="test-url-input"
            placeholder="Enter URL to test..."
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
          />
          <button
            type="button"
            className="test-btn"
            onClick={handleTest}
            disabled={!testUrl || !pattern || !validation.isValid || isTesting}
          >
            {isTesting ? "Testing..." : "Test"}
          </button>
        </div>

        {testResult.tested && (
          <div
            className={`test-result ${testResult.matches ? "match" : "no-match"}`}
          >
            {testResult.matches ? "✓ Matches" : "✗ No match"}
          </div>
        )}
      </div>

      {/* Examples */}
      {examples.length > 0 && (
        <div className="examples-section">
          <h4>Examples for {matchType} patterns:</h4>
          <div className="examples-list">
            {examples.map((example) => (
              <button
                type="button"
                key={example}
                className="example-btn"
                onClick={() => handleUseExample(example)}
                title="Click to use this pattern"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .pattern-tester {
          padding: 1rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 8px;
          background: var(--surface, #f8f9fa);
          margin-top: 1rem;
        }

        .validation-message {
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .validation-message.error {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
        }

        .validation-message.warning {
          background: #fffbf0;
          border: 1px solid #ffd700;
          color: #856404;
        }

        .validation-message.suggestion {
          background: #e3f2fd;
          border: 1px solid #90caf9;
          color: #1565c0;
        }

        .suggestion-btn {
          padding: 0.25rem 0.5rem;
          background: currentColor;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.85rem;
          cursor: pointer;
          opacity: 0.8;
          white-space: nowrap;
        }

        .suggestion-btn:hover {
          opacity: 1;
        }

        .test-section {
          margin-bottom: 1rem;
        }

        .test-section h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .test-controls {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .test-url-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          background: var(--background, #ffffff);
          color: var(--text-primary, #212529);
          font-family: monospace;
          font-size: 0.85rem;
        }

        .test-btn {
          padding: 0.5rem 1rem;
          background: var(--primary, #4a90e2);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .test-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .test-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .test-result {
          padding: 0.5rem;
          border-radius: 4px;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .test-result.match {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .test-result.no-match {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .examples-section h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .examples-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .example-btn {
          padding: 0.5rem;
          background: var(--background, #ffffff);
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          text-align: left;
          cursor: pointer;
          font-family: monospace;
          font-size: 0.85rem;
          color: var(--text-primary, #212529);
          transition: all 0.2s ease;
        }

        .example-btn:hover {
          border-color: var(--primary, #4a90e2);
          background: var(--primary, #4a90e2)10;
        }

        /* Dark theme adjustments */
        :root.dark .pattern-tester {
          background: #343a40;
          border-color: #495057;
        }

        :root.dark .test-url-input {
          background: #2d2d2d;
          border-color: #495057;
          color: #e9ecef;
        }

        :root.dark .example-btn {
          background: #2d2d2d;
          border-color: #495057;
          color: #e9ecef;
        }

        :root.dark .validation-message.error {
          background: #5a1e1e;
          border-color: #8b2635;
          color: #f5c6cb;
        }

        :root.dark .validation-message.warning {
          background: #4a3c00;
          border-color: #856404;
          color: #fff3cd;
        }

        :root.dark .validation-message.suggestion {
          background: #1a2a4a;
          border-color: #3f6ab7;
          color: #cce7ff;
        }

        :root.dark .test-result.match {
          background: #1e4a2e;
          color: #a3d9a5;
          border-color: #2d5a3d;
        }

        :root.dark .test-result.no-match {
          background: #4a1e1e;
          color: #f5c6cb;
          border-color: #5a2d2d;
        }
      `}</style>
    </div>
  )
}
