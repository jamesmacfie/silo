/** @jest-environment jsdom */

import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Container, Rule } from "@/shared/types"
import { CONTAINER_RULE_PRESETS } from "@/shared/utils/containerRulePresets"
import { ContainerPresetWizard } from "@/ui/options/ContainerPresetWizard"
import { useContainerActions, useRuleActions } from "@/ui/shared/stores"

jest.mock("@/ui/shared/stores", () => ({
  useContainerActions: jest.fn(),
  useRuleActions: jest.fn(),
}))

describe("ContainerPresetWizard", () => {
  const mockUseContainerActions = useContainerActions as jest.MockedFunction<
    typeof useContainerActions
  >
  const mockUseRuleActions = useRuleActions as jest.MockedFunction<
    typeof useRuleActions
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseContainerActions.mockReturnValue({
      create: jest.fn().mockResolvedValue(undefined),
    } as any)
    mockUseRuleActions.mockReturnValue({
      create: jest.fn().mockResolvedValue(undefined),
    } as any)
  })

  it("keeps existing preset rules selectable during review", async () => {
    const user = userEvent.setup()
    const preset = CONTAINER_RULE_PRESETS.find((item) => item.id === "facebook")
    expect(preset).toBeDefined()
    if (!preset) {
      return
    }

    const existingContainer: Container = {
      id: "container_facebook",
      name: "Facebook",
      icon: "fingerprint",
      color: "blue",
      cookieStoreId: "firefox-container-facebook",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    }

    const existingRules: Rule[] = preset.rules.map((rule, index) => ({
      id: `existing-${rule.id}-${index}`,
      containerId: existingContainer.cookieStoreId,
      pattern: rule.pattern,
      matchType: rule.matchType,
      ruleType: rule.ruleType,
      priority: rule.priority,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: {
        description: rule.description,
        source: "user",
      },
    }))

    render(
      <ContainerPresetWizard
        isOpen={true}
        containers={[existingContainer]}
        rules={existingRules}
        onClose={() => {}}
      />,
    )

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /facebook/i }))
    })

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThan(0)
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeEnabled()
    }

    const applyButton = screen.getByRole("button", { name: "Apply Preset" })
    expect(applyButton).toBeDisabled()

    await act(async () => {
      await user.click(checkboxes[0])
    })
    expect(checkboxes[0]).toBeChecked()
    expect(applyButton).toBeEnabled()
  })
})
