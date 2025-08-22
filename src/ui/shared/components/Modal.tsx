import React from "react"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: "default" | "large" | "small"
  closeOnBackdropClick?: boolean
  showCloseButton?: boolean
  className?: string
}

/**
 * Reusable modal component with consistent styling and behavior.
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   title="Create Container"
 *   footer={
 *     <>
 *       <button className="btn ghost" onClick={onCancel}>Cancel</button>
 *       <button className="btn" onClick={onSave}>Save</button>
 *     </>
 *   }
 * >
 *   <div className="formRow">
 *     <label className="label">Name</label>
 *     <input className="input" />
 *   </div>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "default",
  closeOnBackdropClick = true,
  showCloseButton = true,
  className = "",
}: ModalProps): JSX.Element | null {
  // Handle escape key
  React.useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    small: "max-w-md",
    default: "max-w-lg",
    large: "max-w-3xl",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-gray-800 rounded-lg shadow-xl ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Export additional modal-specific utility components
export const ModalFormRow: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className = "" }) => (
  <div className={`mb-4 ${className}`}>{children}</div>
)

export const ModalLabel: React.FC<{
  htmlFor?: string
  children: React.ReactNode
  required?: boolean
  className?: string
}> = ({ htmlFor, children, required = false, className = "" }) => (
  <label
    htmlFor={htmlFor}
    className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ${className}`}
  >
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
)

export const ModalInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean
  }
> = ({ error = false, className = "", ...props }) => (
  <input
    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      error
        ? "border-red-500 dark:border-red-400"
        : "border-gray-300 dark:border-gray-600"
    } ${className}`}
    {...props}
  />
)

export const ModalSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    error?: boolean
  }
> = ({ error = false, className = "", children, ...props }) => (
  <select
    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      error
        ? "border-red-500 dark:border-red-400"
        : "border-gray-300 dark:border-gray-600"
    } ${className}`}
    {...props}
  >
    {children}
  </select>
)

export const ModalTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: boolean
  }
> = ({ error = false, className = "", ...props }) => (
  <textarea
    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
      error
        ? "border-red-500 dark:border-red-400"
        : "border-gray-300 dark:border-gray-600"
    } ${className}`}
    {...props}
  />
)

export const ModalError: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className = "" }) => (
  <p className={`mt-1 text-xs text-red-500 dark:text-red-400 ${className}`}>
    {children}
  </p>
)

export const ModalWarning: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className = "" }) => (
  <p
    className={`mt-1 text-xs text-yellow-600 dark:text-yellow-400 ${className}`}
  >
    {children}
  </p>
)

export const ModalInfo: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className = "" }) => (
  <p className={`mt-1 text-xs text-gray-600 dark:text-gray-400 ${className}`}>
    {children}
  </p>
)
