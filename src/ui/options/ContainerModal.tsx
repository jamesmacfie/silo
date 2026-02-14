import React from "react"
import type { Container } from "@/shared/types"
import {
  CONTAINER_COLORS,
  ColorSelector,
} from "@/ui/shared/components/ColorSelector"
import {
  Modal,
  ModalFormRow,
  ModalInfo,
  ModalInput,
  ModalLabel,
  ModalTextarea,
} from "@/ui/shared/components/Modal"
import { useContainerActions } from "@/ui/shared/stores"

interface Props {
  isOpen: boolean
  mode: "create" | "edit"
  container?: {
    id: string
    name: string
    cookieStoreId: string
    color?: string
    icon?: string
    temporary?: boolean
    syncEnabled?: boolean
    metadata?: {
      description?: string
      lifetime?: "permanent" | "untilLastTab"
      notes?: string
    }
  }
  onClose: () => void
  onSuccess: () => void
}

const ICON_OPTIONS = [
  "fingerprint",
  "briefcase",
  "dollar",
  "cart",
  "fence",
  "fruit",
  "gift",
  "vacation",
  "tree",
  "chill",
]

function iconToEmoji(icon: string): string {
  switch ((icon || "").toLowerCase()) {
    case "briefcase":
      return "💼"
    case "dollar":
      return "💵"
    case "cart":
      return "🛒"
    case "fence":
      return "🚧"
    case "fruit":
      return "🍎"
    case "gift":
      return "🎁"
    case "vacation":
      return "🏖️"
    case "tree":
      return "🌳"
    case "chill":
      return "❄️"
    case "fingerprint":
      return "🆔"
    default:
      return "🗂️"
  }
}

export function ContainerModal({
  isOpen,
  mode,
  container,
  onClose,
  onSuccess,
}: Props): JSX.Element {
  const { create: createContainer, update: updateContainer } =
    useContainerActions()

  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState("toolbar")
  const [icon, setIcon] = React.useState("fingerprint")
  const [temporary, setTemporary] = React.useState(false)
  const [syncEnabled, setSyncEnabled] = React.useState(true)
  const [description, setDescription] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    if (mode === "edit" && container) {
      setName(container.name || "")
      setColor(container.color || "toolbar")
      setIcon(container.icon || "fingerprint")
      setTemporary(
        Boolean(
          container.temporary ||
            container.metadata?.lifetime === "untilLastTab",
        ),
      )
      setSyncEnabled(container.syncEnabled !== false)
      setDescription(container.metadata?.description || "")
      setNotes(container.metadata?.notes || "")
      return
    }

    setName("")
    setColor("toolbar")
    setIcon("fingerprint")
    setTemporary(false)
    setSyncEnabled(true)
    setDescription("")
    setNotes("")
  }, [container, isOpen, mode])

  const handleSave = React.useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    setSaving(true)

    const payload: Partial<Container> = {
      name: trimmedName,
      color,
      icon,
      temporary,
      syncEnabled,
      metadata: {
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        lifetime: temporary ? "untilLastTab" : "permanent",
      },
    }

    try {
      if (mode === "create") {
        await createContainer(payload)
      } else if (container) {
        await updateContainer(container.cookieStoreId, payload)
      }

      onSuccess()
      onClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      alert(`Save failed: ${message}`)
    } finally {
      setSaving(false)
    }
  }, [
    color,
    container,
    createContainer,
    description,
    icon,
    mode,
    name,
    notes,
    onClose,
    onSuccess,
    syncEnabled,
    temporary,
    updateContainer,
  ])

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleSave()
  }

  const footer = (
    <>
      <button className="btn ghost" onClick={onClose} disabled={saving}>
        Cancel
      </button>
      <button
        className="btn"
        onClick={() => void handleSave()}
        disabled={saving || !name.trim()}
      >
        {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "New Container" : "Edit Container"}
      footer={footer}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ModalFormRow className="mb-0">
          <ModalLabel htmlFor="container-name" required>
            Name
          </ModalLabel>
          <ModalInput
            id="container-name"
            type="text"
            placeholder="e.g. Work"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </ModalFormRow>

        <ModalFormRow className="mb-0">
          <ModalLabel htmlFor="container-description">Description</ModalLabel>
          <ModalInput
            id="container-description"
            type="text"
            placeholder="Optional context for this container"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </ModalFormRow>

        <ModalFormRow className="mb-0">
          <ModalLabel>Color</ModalLabel>
          <ColorSelector
            selectedColor={color}
            onColorChange={setColor}
            colors={CONTAINER_COLORS}
            layout="list"
            columns={3}
            size="small"
          />
        </ModalFormRow>

        <ModalFormRow className="mb-0">
          <ModalLabel>Icon</ModalLabel>
          <div className="grid grid-cols-5 gap-2">
            {ICON_OPTIONS.map((iconOption) => (
              <button
                key={iconOption}
                className={`p-3 text-2xl rounded-lg border transition-colors ${
                  icon === iconOption
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setIcon(iconOption)}
                title={iconOption}
                type="button"
                aria-label={`Use ${iconOption} icon`}
              >
                {iconToEmoji(iconOption)}
              </button>
            ))}
          </div>
        </ModalFormRow>

        <ModalFormRow className="mb-0">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Behavior
            </legend>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                checked={temporary}
                onChange={(event) => setTemporary(event.target.checked)}
              />
              <span>Auto-remove this container when its last tab closes.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                checked={syncEnabled}
                onChange={(event) => setSyncEnabled(event.target.checked)}
              />
              <span>
                Keep this container synced with Firefox container updates.
              </span>
            </label>
            <ModalInfo>
              Temporary containers are cleaned up by the background service when
              they no longer have open tabs.
            </ModalInfo>
          </fieldset>
        </ModalFormRow>

        <ModalFormRow className="mb-0">
          <ModalLabel htmlFor="container-notes">Notes</ModalLabel>
          <ModalTextarea
            id="container-notes"
            rows={3}
            placeholder="Internal notes about account, purpose, or workflow"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </ModalFormRow>
      </form>
    </Modal>
  )
}
