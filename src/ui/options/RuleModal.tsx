import React from "react"
import { MatchType, RuleType, type Rule } from "@/shared/types"
import { validatePattern } from "@/shared/utils/patternValidator"
import { PatternTester } from "@/ui/shared/components/PatternTester"
import { useRuleActions } from "@/ui/shared/stores"
import {
  Modal,
  ModalFormRow,
  ModalLabel,
  ModalInput,
  ModalSelect,
  ModalError,
  ModalWarning,
  ModalInfo,
} from "@/ui/shared/components/Modal"

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

const MATCH_TYPE_OPTIONS = [
  { value: MatchType.EXACT, label: "Exact URL" },
  { value: MatchType.DOMAIN, label: "Domain" },
  { value: MatchType.GLOB, label: "Glob Pattern" },
  { value: MatchType.REGEX, label: "Regex Pattern" },
]

const RULE_TYPE_OPTIONS = [
  {
    value: RuleType.INCLUDE,
    label: "Include",
    description: "Open URLs in this container",
  },
  {
    value: RuleType.EXCLUDE,
    label: "Exclude",
    description: "Break out of containers for this URL",
  },
  {
    value: RuleType.RESTRICT,
    label: "Restrict",
    description: "Only allow this URL in this container",
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
        <ModalSelect
          id="matchType"
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as MatchType)}
        >
          {MATCH_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ModalSelect>
      </ModalFormRow>

      <ModalFormRow>
        <ModalLabel>Rule Type</ModalLabel>
        <div className="space-y-2">
          {RULE_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <input
                type="radio"
                name="ruleType"
                value={option.value}
                checked={ruleType === option.value}
                onChange={(e) => setRuleType(e.target.value as RuleType)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {option.label}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {option.description}
                </div>
              </div>
            </label>
          ))}
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
