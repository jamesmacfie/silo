import { ArrowLeft, Facebook, Loader2, Square, X, Youtube } from "lucide-react"
import React from "react"
import type { Container, Rule } from "@/shared/types"
import {
  buildRuleIdentitySet,
  CONTAINER_RULE_PRESETS,
  type ContainerRulePreset,
  findContainerForPreset,
  getPresetRuleIdentityKeys,
} from "@/shared/utils/containerRulePresets"
import { Modal, ModalError, ModalInfo } from "@/ui/shared/components/Modal"
import { useContainerActions, useRuleActions } from "@/ui/shared/stores"

interface ContainerPresetWizardProps {
  isOpen: boolean
  containers: Container[]
  rules: Rule[]
  onClose: () => void
  onComplete?: () => void
}

interface RuleReviewItem {
  id: string
  domain: string
  pattern: string
  description: string
  exists: boolean
}

function LogoFrame(props: {
  className: string
  children: React.ReactNode
  label: string
}): JSX.Element {
  return (
    <div
      className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${props.className}`}
      role="img"
      aria-label={props.label}
      title={props.label}
    >
      {props.children}
    </div>
  )
}

function PresetLogo({ preset }: { preset: ContainerRulePreset }): JSX.Element {
  switch (preset.id) {
    case "facebook":
      return (
        <LogoFrame
          className="bg-blue-600 border-blue-500 text-white"
          label="Facebook logo"
        >
          <Facebook className="w-5 h-5" />
        </LogoFrame>
      )

    case "google":
      return (
        <LogoFrame
          className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
          label="Google logo"
        >
          <span className="text-lg font-black bg-gradient-to-r from-blue-600 via-red-500 to-yellow-400 bg-clip-text text-transparent">
            G
          </span>
        </LogoFrame>
      )

    case "discord":
      return (
        <LogoFrame
          className="bg-indigo-600 border-indigo-500 text-white"
          label="Discord logo"
        >
          <span className="text-base font-bold">D</span>
        </LogoFrame>
      )

    case "amazon":
      return (
        <LogoFrame
          className="bg-amber-400 border-amber-500 text-gray-900"
          label="Amazon logo"
        >
          <span className="text-base font-black">a</span>
        </LogoFrame>
      )

    case "x-twitter":
      return (
        <LogoFrame
          className="bg-black border-gray-700 text-white"
          label="X logo"
        >
          <X className="w-5 h-5" />
        </LogoFrame>
      )

    case "tiktok":
      return (
        <LogoFrame
          className="bg-black border-gray-700 text-cyan-300"
          label="TikTok logo"
        >
          <span className="text-base font-bold">t</span>
        </LogoFrame>
      )

    case "youtube":
      return (
        <LogoFrame
          className="bg-red-600 border-red-500 text-white"
          label="YouTube logo"
        >
          <Youtube className="w-5 h-5" />
        </LogoFrame>
      )

    case "microsoft":
      return (
        <LogoFrame
          className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
          label="Microsoft logo"
        >
          <div className="grid grid-cols-2 gap-0.5">
            <span className="block w-2 h-2 bg-red-500" />
            <span className="block w-2 h-2 bg-green-500" />
            <span className="block w-2 h-2 bg-blue-500" />
            <span className="block w-2 h-2 bg-yellow-400" />
          </div>
        </LogoFrame>
      )

    default:
      return (
        <LogoFrame
          className="bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          label={`${preset.label} logo`}
        >
          <Square className="w-5 h-5" />
        </LogoFrame>
      )
  }
}

function ExistingPill({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      {children}
    </span>
  )
}

export function ContainerPresetWizard({
  isOpen,
  containers,
  rules,
  onClose,
  onComplete,
}: ContainerPresetWizardProps): JSX.Element {
  const { create: createContainer } = useContainerActions()
  const { create: createRule } = useRuleActions()

  const [activePresetId, setActivePresetId] = React.useState<string | null>(
    null,
  )
  const [selectedRuleIds, setSelectedRuleIds] = React.useState<Set<string>>(
    new Set(),
  )
  const [error, setError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const activePreset = React.useMemo(
    () => CONTAINER_RULE_PRESETS.find((preset) => preset.id === activePresetId),
    [activePresetId],
  )

  const ruleIdentitySet = React.useMemo(
    () => buildRuleIdentitySet(rules),
    [rules],
  )

  const activePresetContainer = React.useMemo(() => {
    if (!activePreset) {
      return undefined
    }

    return findContainerForPreset(containers, activePreset)
  }, [activePreset, containers])

  const activePresetRules = React.useMemo<RuleReviewItem[]>(() => {
    if (!activePreset) {
      return []
    }

    return activePreset.rules.map((rule) => {
      const exists = Boolean(
        activePresetContainer &&
          getPresetRuleIdentityKeys(
            {
              pattern: rule.pattern,
              matchType: rule.matchType,
              ruleType: rule.ruleType,
            },
            activePresetContainer.cookieStoreId,
          ).some((key) => ruleIdentitySet.has(key)),
      )

      return {
        id: rule.id,
        domain: rule.domain,
        pattern: rule.pattern,
        description: rule.description,
        exists,
      }
    })
  }, [activePreset, activePresetContainer, ruleIdentitySet])

  const selectedNewRuleCount = React.useMemo(
    () =>
      activePresetRules.filter(
        (rule) => selectedRuleIds.has(rule.id) && !rule.exists,
      ).length,
    [activePresetRules, selectedRuleIds],
  )

  React.useEffect(() => {
    if (isOpen) {
      return
    }

    setActivePresetId(null)
    setSelectedRuleIds(new Set())
    setError("")
    setIsSubmitting(false)
  }, [isOpen])

  const handleOpenPreset = React.useCallback(
    (preset: ContainerRulePreset) => {
      const existingContainer = findContainerForPreset(containers, preset)
      const initialSelection = new Set<string>()

      for (const rule of preset.rules) {
        const exists = Boolean(
          existingContainer &&
            getPresetRuleIdentityKeys(
              {
                pattern: rule.pattern,
                matchType: rule.matchType,
                ruleType: rule.ruleType,
              },
              existingContainer.cookieStoreId,
            ).some((key) => ruleIdentitySet.has(key)),
        )

        if (!exists) {
          initialSelection.add(rule.id)
        }
      }

      setActivePresetId(preset.id)
      setSelectedRuleIds(initialSelection)
      setError("")
    },
    [containers, ruleIdentitySet],
  )

  const handleBack = React.useCallback(() => {
    setActivePresetId(null)
    setSelectedRuleIds(new Set())
    setError("")
  }, [])

  const handleToggleRule = React.useCallback((ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(ruleId)) {
        next.delete(ruleId)
      } else {
        next.add(ruleId)
      }
      return next
    })
  }, [])

  const handleApplyPreset = React.useCallback(async () => {
    if (!activePreset) {
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      let targetContainer = activePresetContainer

      if (!targetContainer) {
        targetContainer = await createContainer({
          name: activePreset.container.name,
          color: activePreset.container.color,
          icon: activePreset.container.icon,
          temporary: false,
          syncEnabled: true,
          metadata: {
            description: activePreset.container.description,
            lifetime: "permanent",
            categories: ["Preset", `preset:${activePreset.id}`],
          },
        })
      }

      const nextRuleIdentitySet = new Set(ruleIdentitySet)
      let createdRuleCount = 0
      let skippedRuleCount = 0

      for (const rule of activePreset.rules) {
        if (!selectedRuleIds.has(rule.id)) {
          continue
        }

        const identityKeys = getPresetRuleIdentityKeys(
          {
            pattern: rule.pattern,
            matchType: rule.matchType,
            ruleType: rule.ruleType,
          },
          targetContainer.cookieStoreId,
        )

        if (identityKeys.some((key) => nextRuleIdentitySet.has(key))) {
          skippedRuleCount += 1
          continue
        }

        await createRule({
          pattern: rule.pattern,
          matchType: rule.matchType,
          ruleType: rule.ruleType,
          containerId: targetContainer.cookieStoreId,
          priority: rule.priority,
          enabled: true,
          metadata: {
            description: rule.description,
            source: "user",
          },
        })

        for (const key of identityKeys) {
          nextRuleIdentitySet.add(key)
        }
        createdRuleCount += 1
      }

      const summaryParts = [
        !activePresetContainer
          ? "container created"
          : "existing container reused",
      ]

      if (createdRuleCount > 0) {
        summaryParts.push(
          `${createdRuleCount} rule${createdRuleCount === 1 ? "" : "s"} added`,
        )
      }

      if (skippedRuleCount > 0) {
        summaryParts.push(
          `${skippedRuleCount} duplicate${skippedRuleCount === 1 ? "" : "s"} skipped`,
        )
      }

      if (createdRuleCount === 0 && skippedRuleCount === 0) {
        summaryParts.push("no new rules selected")
      }

      alert(`${activePreset.label} preset applied: ${summaryParts.join(", ")}.`)

      onComplete?.()
      onClose()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    activePreset,
    activePresetContainer,
    createContainer,
    createRule,
    onClose,
    onComplete,
    ruleIdentitySet,
    selectedRuleIds,
  ])

  const selectionFooter = (
    <>
      <button type="button" className="btn ghost" onClick={onClose}>
        Close
      </button>
    </>
  )

  const canApply =
    !isSubmitting &&
    (Boolean(!activePresetContainer) || selectedNewRuleCount > 0)

  const reviewFooter = (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={handleBack}
        disabled={isSubmitting}
      >
        Back
      </button>
      <button
        type="button"
        className="btn ghost"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => void handleApplyPreset()}
        disabled={!canApply}
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Applying...
          </span>
        ) : (
          "Apply Preset"
        )}
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        activePreset ? `${activePreset.label} Preset` : "Container Presets"
      }
      size="large"
      footer={activePreset ? reviewFooter : selectionFooter}
    >
      {activePreset ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="flex items-start gap-3">
              <PresetLogo preset={activePreset} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">
                    {activePreset.label}
                  </h3>
                  {activePresetContainer ? (
                    <ExistingPill>Container already exists</ExistingPill>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Container will be created
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {activePreset.shortDescription}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activePreset.domains.map((domain) => (
                    <span
                      key={`${activePreset.id}-domain-${domain}`}
                      className="px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300 hover:underline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Choose another preset
            </button>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {selectedNewRuleCount} rule{selectedNewRuleCount === 1 ? "" : "s"}{" "}
              selected to add
            </div>
          </div>

          <div className="space-y-2">
            {activePresetRules.map((rule) => {
              const checked = selectedRuleIds.has(rule.id)
              return (
                <label
                  key={rule.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    rule.exists
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                      : checked
                        ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-gray-300 dark:border-gray-600"
                    checked={checked}
                    disabled={rule.exists || isSubmitting}
                    onChange={() => handleToggleRule(rule.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                        {rule.domain}
                      </span>
                      {rule.exists && (
                        <ExistingPill>Already exists</ExistingPill>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-mono break-all text-gray-900 dark:text-gray-100">
                      {rule.pattern}
                    </div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {rule.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          {!activePresetContainer && selectedNewRuleCount === 0 && (
            <ModalInfo>
              This will only create the container because no rules are selected.
            </ModalInfo>
          )}

          {error && <ModalError>{error}</ModalError>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Pick a preset to create a dedicated container and add common include
            rules for that company&apos;s web properties.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CONTAINER_RULE_PRESETS.map((preset) => {
              const existingContainer = findContainerForPreset(
                containers,
                preset,
              )
              const existingRuleCount = existingContainer
                ? preset.rules.filter((rule) =>
                    getPresetRuleIdentityKeys(
                      {
                        pattern: rule.pattern,
                        matchType: rule.matchType,
                        ruleType: rule.ruleType,
                      },
                      existingContainer.cookieStoreId,
                    ).some((key) => ruleIdentitySet.has(key)),
                  ).length
                : 0

              return (
                <button
                  key={preset.id}
                  type="button"
                  className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-colors"
                  onClick={() => handleOpenPreset(preset)}
                >
                  <div className="flex items-start gap-3">
                    <PresetLogo preset={preset} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {preset.label}
                        </h3>
                        {existingContainer && (
                          <ExistingPill>Container exists</ExistingPill>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {preset.shortDescription}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {preset.domains.slice(0, 4).map((domain) => (
                          <span
                            key={`${preset.id}-chip-${domain}`}
                            className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px] font-mono"
                          >
                            {domain}
                          </span>
                        ))}
                        {preset.domains.length > 4 && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px]">
                            +{preset.domains.length - 4} more
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          {preset.rules.length} rule
                          {preset.rules.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {existingRuleCount} already in this container
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Review mode lets you toggle individual rules before anything is
            created.
          </div>
        </div>
      )}
    </Modal>
  )
}
