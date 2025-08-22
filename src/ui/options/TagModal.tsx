import React from "react"
import { useBookmarkActions } from "@/ui/shared/stores/bookmarkStore"
import type { BookmarkTag } from "@/shared/types"
import {
  Modal,
  ModalFormRow,
  ModalLabel,
  ModalInput,
} from "@/ui/shared/components/Modal"
import { ColorSelector, TAG_COLORS } from "@/ui/shared/components/ColorSelector"

interface Props {
  isOpen: boolean
  mode: "create" | "edit"
  tag?: BookmarkTag
  onClose: () => void
  onSuccess?: () => void
}

export function TagModal({
  isOpen,
  mode,
  tag,
  onClose,
  onSuccess,
}: Props): JSX.Element {
  const { createTag, updateTag } = useBookmarkActions()
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState(TAG_COLORS[0].value)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && tag) {
        setName(tag.name)
        setColor(tag.color)
      } else {
        setName("")
        setColor(TAG_COLORS[0].value)
      }
    }
  }, [isOpen, mode, tag])

  const handleSave = React.useCallback(async () => {
    if (!name.trim()) return

    setSaving(true)
    try {
      if (mode === "create") {
        await createTag({
          name: name.trim(),
          color,
        })
      } else if (mode === "edit" && tag) {
        await updateTag(tag.id, {
          name: name.trim(),
          color,
        })
      }

      onSuccess?.()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [name, color, mode, tag, onSuccess, onClose, createTag, updateTag])

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
        {saving
          ? "Saving..."
          : mode === "create"
            ? "Create Tag"
            : "Save Changes"}
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "New Tag" : "Edit Tag"}
      footer={footer}
    >
      <ModalFormRow>
        <ModalLabel htmlFor="name" required>
          Name
        </ModalLabel>
        <ModalInput
          id="name"
          type="text"
          placeholder="e.g. Work, Personal, Shopping"
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
          colors={TAG_COLORS}
          layout="list"
          columns={3}
          size="small"
        />
      </ModalFormRow>
    </Modal>
  )
}
