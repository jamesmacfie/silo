import React from "react"
import browser from "webextension-polyfill"
import { MESSAGE_TYPES } from "@/shared/constants"
import type { CSVImportResult } from "@/shared/utils/csv"
import { Button } from "@/ui/shared/components/layout/Button"
import { PageHeader } from "@/ui/shared/components/PageHeader"
import { StatusBar } from "@/ui/shared/components/StatusBar"

interface ImportExportSection {
  title: string
  description: string
  exportType: string
  importType: string
  fileExtension: string
  supportsTemplateDownload?: boolean
  supportsFormatOptions?: boolean
}

const SECTIONS: ImportExportSection[] = [
  {
    title: "Rules",
    description:
      "Import/export container routing rules with patterns and priorities",
    exportType: "EXPORT_CSV",
    importType: "IMPORT_CSV",
    fileExtension: "csv",
    supportsTemplateDownload: true,
    supportsFormatOptions: true,
  },
  {
    title: "Containers",
    description:
      "Export container definitions including names, colors, icons, and metadata",
    exportType: "EXPORT_CONTAINERS",
    importType: "IMPORT_CONTAINERS",
    fileExtension: "json",
  },
  {
    title: "Tags",
    description: "Export bookmark tags with colors and metadata",
    exportType: "EXPORT_TAGS",
    importType: "IMPORT_TAGS",
    fileExtension: "json",
  },
  {
    title: "Bookmarks (Silo Format)",
    description:
      "Export bookmarks with container associations, tags, and metadata",
    exportType: "EXPORT_BOOKMARKS_SILO",
    importType: "IMPORT_BOOKMARKS_SILO",
    fileExtension: "json",
  },
  {
    title: "Bookmarks (Cross-Browser)",
    description:
      "Export bookmarks in standard browser format (HTML) for import into other browsers",
    exportType: "EXPORT_BOOKMARKS_STANDARD",
    importType: "IMPORT_BOOKMARKS_STANDARD",
    fileExtension: "html",
  },
  {
    title: "Complete Data",
    description:
      "Full backup including all containers, rules, bookmarks, tags, and settings",
    exportType: "BACKUP_DATA",
    importType: "RESTORE_DATA",
    fileExtension: "json",
  },
]

interface SectionProps {
  section: ImportExportSection
  onImportComplete?: (result: any) => void
  onError?: (error: string) => void
}

function ImportExportSectionComponent({
  section,
  onImportComplete,
  onError,
}: SectionProps): JSX.Element {
  const [importing, setImporting] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [importResult, setImportResult] = React.useState<any>(null)
  const [showPreview, setShowPreview] = React.useState(false)
  const [fileContent, setFileContent] = React.useState("")
  const [createMissing, setCreateMissing] = React.useState(true)
  const [exportOptions, setExportOptions] = React.useState({
    includeComments: false,
    includeHeaders: true,
    includeDisabled: true,
    includeMetadata: true,
  })

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleExport = React.useCallback(async () => {
    if (exporting) return

    setExporting(true)
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES[section.exportType as keyof typeof MESSAGE_TYPES],
        payload: section.supportsFormatOptions
          ? { options: exportOptions }
          : undefined,
      })

      if (response?.success) {
        const data = response.data
        const content =
          section.exportType === "EXPORT_CSV"
            ? data.csv
            : section.fileExtension === "html"
              ? data.html
              : JSON.stringify(data, null, 2)

        // Create and trigger download
        const mimeType =
          section.fileExtension === "html"
            ? "text/html"
            : section.fileExtension === "csv"
              ? "text/csv"
              : "application/json"

        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const timestamp = new Date().toISOString().split("T")[0]
        a.download = `silo-${section.title.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.${section.fileExtension}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        onError?.(response?.error || "Export failed")
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }, [exporting, exportOptions, onError, section])

  const handleDownloadTemplate = React.useCallback(async () => {
    if (!section.supportsTemplateDownload) return

    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GENERATE_CSV_TEMPLATE,
      })

      if (response?.success) {
        const template = response.data.template

        const blob = new Blob([template], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `silo-${section.title.toLowerCase()}-template.${section.fileExtension}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        onError?.(response?.error || "Template generation failed")
      }
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Template download failed",
      )
    }
  }, [onError, section])

  const previewImport = React.useCallback(
    async (content: string) => {
      setImporting(true)
      try {
        const response = await browser.runtime.sendMessage({
          type: MESSAGE_TYPES[section.importType as keyof typeof MESSAGE_TYPES],
          payload:
            section.fileExtension === "csv"
              ? {
                  csvContent: content,
                  preview: true,
                  createMissingContainers: false,
                }
              : {
                  data: JSON.parse(content),
                  preview: true,
                  createMissingContainers: false,
                },
        })

        if (response?.success) {
          setImportResult(response.data)
          setShowPreview(true)
        } else {
          onError?.(response?.error || "Preview failed")
        }
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Preview failed")
      } finally {
        setImporting(false)
      }
    },
    [onError, section],
  )

  const handleFileSelect = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setFileContent(content)
        previewImport(content)
      }
      reader.readAsText(file)
    },
    [previewImport],
  )

  const handleConfirmImport = React.useCallback(async () => {
    if (!fileContent) return

    setImporting(true)
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES[section.importType as keyof typeof MESSAGE_TYPES],
        payload:
          section.fileExtension === "csv"
            ? {
                csvContent: fileContent,
                createMissingContainers: createMissing,
              }
            : {
                data: JSON.parse(fileContent),
                createMissingContainers: createMissing,
              },
      })

      if (response?.success) {
        setImportResult(response.data)
        onImportComplete?.(response.data)
        setShowPreview(false)
        setFileContent("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        onError?.(response?.error || "Import failed")
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }, [fileContent, createMissing, onImportComplete, onError, section])

  const handleCancelImport = React.useCallback(() => {
    setShowPreview(false)
    setImportResult(null)
    setFileContent("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {section.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {section.description}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Export</h4>

          {section.supportsFormatOptions && (
            <div className="space-y-2">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={exportOptions.includeComments}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeComments: e.target.checked,
                    }))
                  }
                />
                Include comments and headers
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={exportOptions.includeDisabled}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeDisabled: e.target.checked,
                    }))
                  }
                />
                Include disabled items
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeMetadata: e.target.checked,
                    }))
                  }
                />
                Include metadata
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleExport}
              disabled={exporting}
              variant="primary"
            >
              {exporting ? "Exporting..." : `Export ${section.title}`}
            </Button>
            {section.supportsTemplateDownload && (
              <Button onClick={handleDownloadTemplate} variant="secondary">
                Download Template
              </Button>
            )}
          </div>
        </div>

        {/* Import Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Import</h4>

          <div className="space-y-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                className="mr-2 rounded"
                checked={createMissing}
                onChange={(e) => setCreateMissing(e.target.checked)}
              />
              Create missing containers/tags automatically
            </label>
          </div>

          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={`.${section.fileExtension}`}
              onChange={handleFileSelect}
              disabled={importing}
              className="w-full text-sm"
            />
          </div>
        </div>
      </div>

      {/* Import Preview */}
      {showPreview && importResult && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Import Preview
          </h4>

          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            {importResult.rules && (
              <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full">
                <strong>{importResult.rules.length}</strong> rules
              </div>
            )}
            {importResult.containers && (
              <div className="px-3 py-1 bg-green-100 dark:bg-green-900 rounded-full">
                <strong>{importResult.containers.length}</strong> containers
              </div>
            )}
            {importResult.tags && (
              <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900 rounded-full">
                <strong>{importResult.tags.length}</strong> tags
              </div>
            )}
            {importResult.bookmarks && (
              <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900 rounded-full">
                <strong>{importResult.bookmarks.length}</strong> bookmarks
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded-full text-red-800 dark:text-red-200">
                <strong>{importResult.errors.length}</strong> errors
              </div>
            )}
            {importResult.warnings?.length > 0 && (
              <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 rounded-full text-yellow-800 dark:text-yellow-200">
                <strong>{importResult.warnings.length}</strong> warnings
              </div>
            )}
          </div>

          {importResult.errors?.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium text-red-800 dark:text-red-200 mb-2">
                Errors
              </h5>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importResult.errors.map((error: any, i: number) => (
                  <div
                    key={i}
                    className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded"
                  >
                    Line {error.line}: {error.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult.warnings?.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Warnings
              </h5>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importResult.warnings.map((warning: any, i: number) => (
                  <div
                    key={i}
                    className="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded"
                  >
                    Line {warning.line}: {warning.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleConfirmImport}
              disabled={importing || importResult.errors?.length > 0}
              variant="primary"
            >
              {importing ? "Importing..." : `Import ${section.title}`}
            </Button>
            <Button onClick={handleCancelImport} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ImportExportPageProps {
  onImportComplete?: (result: CSVImportResult) => void
  onError?: (error: string) => void
}

export function ImportExportPage({
  onImportComplete,
  onError,
}: ImportExportPageProps): JSX.Element {
  const [status, setStatus] = React.useState("")
  const [statusType, setStatusType] = React.useState<
    "success" | "error" | "warning" | "info"
  >("info")

  const handleImportComplete = React.useCallback(
    (result: any) => {
      let message = "Import completed"
      if (result.rules) message += ` - ${result.rules.length} rules`
      if (result.containers)
        message += ` - ${result.containers.length} containers`
      if (result.tags) message += ` - ${result.tags.length} tags`
      if (result.bookmarks) message += ` - ${result.bookmarks.length} bookmarks`
      if (result.warnings?.length > 0)
        message += ` with ${result.warnings.length} warnings`
      if (result.errors?.length > 0)
        message += ` and ${result.errors.length} errors`

      setStatus(message)
      // Set type based on whether there are errors/warnings
      if (result.errors?.length > 0) {
        setStatusType("error")
      } else if (result.warnings?.length > 0) {
        setStatusType("warning")
      } else {
        setStatusType("success")
      }

      setTimeout(() => setStatus(""), 5000)
      onImportComplete?.(result)
    },
    [onImportComplete],
  )

  const handleError = React.useCallback(
    (error: string) => {
      setStatus(error)
      setStatusType("error")
      setTimeout(() => setStatus(""), 5000)
      onError?.(error)
    },
    [onError],
  )

  return (
    <div className="max-w-6xl mx-auto p-6">
      <PageHeader title="Import/Export" />

      {status && <StatusBar message={status} type={statusType} />}

      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          Import and export your Silo data including containers, rules,
          bookmarks, and tags. Use the cross-browser format to move bookmarks
          between different browsers, or the Silo format to preserve all
          metadata and associations.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <ImportExportSectionComponent
          key={section.title}
          section={section}
          onImportComplete={handleImportComplete}
          onError={handleError}
        />
      ))}
    </div>
  )
}
