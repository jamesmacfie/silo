import React from "react"
import { createRoot } from "react-dom/client"
import { useAppInitialization, useStoreEffects } from "@/ui/shared/stores"
import { PopupApp } from "@/ui/popup/components/PopupApp"
import "@/ui/popup/index.css"

function App() {
  const { isInitialized, initializationError, retry } = useAppInitialization()

  // Set up cross-store effects
  useStoreEffects()

  if (initializationError) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <div className="text-red-600 dark:text-red-400 mb-2">
          Failed to initialize app
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {initializationError}
        </div>
        <button
          onClick={retry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  return <PopupApp />
}

const mount = document.getElementById("root")
if (mount) {
  const root = createRoot(mount)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
