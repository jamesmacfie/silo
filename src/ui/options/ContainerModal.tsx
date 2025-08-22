import React from "react"
import { useContainerActions } from "@/ui/shared/stores"
import {
  Modal,
  ModalFormRow,
  ModalLabel,
  ModalInput,
} from "@/ui/shared/components/Modal"
import {
  ColorSelector,
  CONTAINER_COLORS,
} from "@/ui/shared/components/ColorSelector"

interface Props {
  isOpen: boolean
  mode: "create" | "edit"
  container?: {
    id: string
    name: string
    cookieStoreId: string
    color?: string
    icon?: string
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
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && container) {
        setName(container.name || "")
        setColor(container.color || "toolbar")
        setIcon(container.icon || "fingerprint")
      } else {
        setName("")
        setColor("toolbar")
        setIcon("fingerprint")
      }
    }
  }, [isOpen, mode, container])

  const handleSave = React.useCallback(async () => {
    if (!name.trim()) return

    setSaving(true)
    try {
      if (mode === "create") {
        await createContainer({ name: name.trim(), color, icon })
      } else if (mode === "edit" && container) {
        await updateContainer(container.cookieStoreId, {
          name: name.trim(),
          color,
          icon,
        })
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
    name,
    color,
    icon,
    mode,
    container,
    onSuccess,
    onClose,
    createContainer,
    updateContainer,
  ])

  const footer = (
    <>
      <button className="btn ghost" onClick={onClose} disabled={saving}>
        Cancel
      </button>
      <button
        className="btn"
        onClick={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? "Saving..." : "Save"}
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
      <ModalFormRow>
        <ModalLabel htmlFor="name" required>
          Name
        </ModalLabel>
        <ModalInput
          id="name"
          type="text"
          placeholder="e.g. Work"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </ModalFormRow>

      <ModalFormRow>
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

      <ModalFormRow>
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
            >
              {iconToEmoji(iconOption)}
            </button>
          ))}
        </div>
      </ModalFormRow>
    </Modal>
  )
}
