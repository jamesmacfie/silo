import { Filter, Search, Shield, Tag, X } from "lucide-react"
import React from "react"
import { MatchType, type Rule, RuleType } from "@/shared/types"
import { validatePattern } from "@/shared/utils/patternValidator"
import {
  Modal,
  ModalError,
  ModalFormRow,
  ModalInfo,
  ModalInput,
  ModalLabel,
  ModalSelect,
  ModalWarning,
} from "@/ui/shared/components/Modal"
import { PatternTester } from "@/ui/shared/components/PatternTester"
import { useRuleActions } from "@/ui/shared/stores"

interface Container {
  id: string
  name: string
  cookieStoreId: string
  color?: string
  icon?: string
}

interface Props {
  isOpen: boolean
  mode: "create" | "edit"
  rule?: Rule
  containers: Container[]
  onClose: () => void
  onSuccess: () => void
}

const MATCH_TYPE_OPTIONS: Array<{
  value: MatchType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    value: MatchType.EXACT,
    label: "Exact URL",
    description: "Full URL must match",
    icon: Search,
  },
  {
    value: MatchType.DOMAIN,
    label: "Domain",
    description: "Match host/domain",
    icon: Tag,
  },
  {
    value: MatchType.GLOB,
    label: "Glob",
    description: "Use * wildcards",
    icon: Filter,
  },
  {
    value: MatchType.REGEX,
    label: "Regex",
    description: "Advanced pattern",
    icon: Shield,
  },
]

const RULE_TYPE_OPTIONS: Array<{
  value: RuleType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    value: RuleType.INCLUDE,
    label: "Include",
    description: "Open URLs in this container",
    icon: Search,
  },
  {
    value: RuleType.EXCLUDE,
    label: "Exclude",
    description: "Break out of containers for this URL",
    icon: X,
  },
  {
    value: RuleType.RESTRICT,
    label: "Restrict",
    description: "Only allow this URL in this container",
    icon: Shield,
  },
]

export function RuleModal({
  isOpen,
  mode,
  rule,
  containers,
  onClose,
  onSuccess,
}: Props): JSX.Element {
  const { create: createRule, update: updateRule } = useRuleActions()
  const [pattern, setPattern] = React.useState("")
  const [matchType, setMatchType] = React.useState<MatchType>(MatchType.DOMAIN)
  const [ruleType, setRuleType] = React.useState<RuleType>(RuleType.INCLUDE)
  const [containerId, setContainerId] = React.useState("")
  const [priority, setPriority] = React.useState(50)
  const [enabled, setEnabled] = React.useState(true)
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && rule) {
        setPattern(rule.pattern)
        setMatchType(rule.matchType)
        setRuleType(rule.ruleType)
        setContainerId(rule.containerId || "")
        setPriority(rule.priority)
        setEnabled(rule.enabled)
        setDescription(rule.metadata.description || "")
      } else {
        setPattern("")
        setMatchType(MatchType.DOMAIN)
        setRuleType(RuleType.INCLUDE)
        setContainerId(containers[0]?.cookieStoreId || "")
        setPriority(50)
        setEnabled(true)
        setDescription("")
      }
    }
  }, [isOpen, mode, rule, containers])

  const validation = React.useMemo(() => {
    if (!pattern) return { isValid: false, error: "Pattern is required" }
    return validatePattern(pattern, matchType)
  }, [pattern, matchType])

  const handleSave = React.useCallback(async () => {
    // For EXCLUDE rules, containerId is not required
    const isContainerRequired = ruleType !== RuleType.EXCLUDE
    if (
      !validation.isValid ||
      !pattern.trim() ||
      (isContainerRequired && !containerId)
    )
      return

    setSaving(true)
    try {
      const ruleData = {
        pattern: pattern.trim(),
        matchType,
        ruleType,
        containerId: ruleType === RuleType.EXCLUDE ? undefined : containerId,
        priority,
        enabled,
        metadata: {
          description: description.trim() || undefined,
          source: "user" as const,
        },
      }

      if (mode === "create") {
        await createRule(ruleData)
      } else if (mode === "edit" && rule) {
        await updateRule(rule.id, ruleData)
      }

      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [
    pattern,
    matchType,
    ruleType,
    containerId,
    priority,
    enabled,
    description,
    validation.isValid,
    mode,
    rule,
    onSuccess,
    onClose,
    createRule,
    updateRule,
  ])

  const isContainerRequired = ruleType !== RuleType.EXCLUDE
  const isValid =
    validation.isValid &&
    pattern.trim() &&
    (!isContainerRequired || containerId)

  const footer = (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn"
        onClick={handleSave}
        disabled={saving || !isValid}
      >
        {saving ? "Saving..." : "Save Rule"}
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "New Rule" : "Edit Rule"}
      footer={footer}
      size="large"
    >
      <ModalFormRow>
        <ModalLabel htmlFor="pattern" required>
          Pattern
        </ModalLabel>
        <ModalInput
          id="pattern"
          type="text"
          placeholder="e.g. example.com or *.google.com"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          error={!validation.isValid && pattern.length > 0}
        />
        {validation.error && <ModalError>{validation.error}</ModalError>}
        {validation.warning && (
          <ModalWarning>{validation.warning}</ModalWarning>
        )}
      </ModalFormRow>

      <ModalFormRow>
        <ModalLabel htmlFor="matchType">Match Type</ModalLabel>
        <div id="matchType" className="grid grid-cols-2 gap-2">
          {MATCH_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isSelected = matchType === option.value

            return (
              <label
                key={option.value}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="matchType"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setMatchType(option.value)}
                  className="sr-only"
                />
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="block text-xs opacity-80">
                    {option.description}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </ModalFormRow>

      <ModalFormRow>
        <ModalLabel>Rule Type</ModalLabel>
        <div className="grid grid-cols-3 gap-2">
          {RULE_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            const isSelected = ruleType === option.value

            return (
              <label
                key={option.value}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="ruleType"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setRuleType(option.value)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
                <span className="text-xs opacity-80 leading-relaxed">
                  {option.description}
                </span>
              </label>
            )
          })}
        </div>
      </ModalFormRow>

      {isContainerRequired && (
        <ModalFormRow>
          <ModalLabel htmlFor="container" required>
            Container
          </ModalLabel>
          <ModalSelect
            id="container"
            value={containerId}
            onChange={(e) => setContainerId(e.target.value)}
            error={!containerId}
          >
            <option value="">Select a container...</option>
            {containers.map((container) => (
              <option
                key={container.cookieStoreId}
                value={container.cookieStoreId}
              >
                {container.name}
              </option>
            ))}
          </ModalSelect>
        </ModalFormRow>
      )}

      <ModalFormRow>
        <ModalLabel htmlFor="priority">Priority ({priority})</ModalLabel>
        <input
          id="priority"
          type="range"
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          min="1"
          max="100"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
        />
        <ModalInfo>Higher priority rules are evaluated first</ModalInfo>
      </ModalFormRow>

      <ModalFormRow>
        <ModalLabel htmlFor="description">Description (optional)</ModalLabel>
        <ModalInput
          id="description"
          type="text"
          placeholder="What does this rule do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </ModalFormRow>

      <ModalFormRow>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Enabled
          </span>
        </label>
      </ModalFormRow>

      <PatternTester
        pattern={pattern}
        matchType={matchType}
        onPatternChange={setPattern}
        onMatchTypeChange={setMatchType}
      />
    </Modal>
  )
}
