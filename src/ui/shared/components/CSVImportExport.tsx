import React from 'react';
import browser from 'webextension-polyfill';
import { MESSAGE_TYPES } from '@/shared/constants';
import type { CSVImportResult, CSVExportOptions } from '@/shared/utils/csv';

interface Props {
  onImportComplete?: (result: CSVImportResult) => void;
  onError?: (error: string) => void;
}

export function CSVImportExport({ onImportComplete, onError }: Props): JSX.Element {
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<CSVImportResult | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [csvContent, setCsvContent] = React.useState('');
  const [createMissing, setCreateMissing] = React.useState(true);
  const [exportOptions, setExportOptions] = React.useState<CSVExportOptions>({
    includeComments: true,
    includeHeaders: true,
    includeDisabled: true,
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = React.useCallback(async () => {
    if (exporting) return;

    setExporting(true);
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.EXPORT_CSV,
        payload: { options: exportOptions },
      });

      if (response?.success) {
        const csv = response.data.csv;

        // Create and trigger download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `silo-rules-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        onError?.(response?.error || 'Export failed');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exporting, exportOptions, onError]);

  const handleDownloadTemplate = React.useCallback(async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GENERATE_CSV_TEMPLATE,
      });

      if (response?.success) {
        const template = response.data.template;

        // Create and trigger download
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'silo-template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        onError?.(response?.error || 'Template generation failed');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Template download failed');
    }
  }, [onError]);

  const previewImport = React.useCallback(async (content: string) => {
    setImporting(true);
    try {
      // We don't actually import yet, just parse to show preview
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.IMPORT_CSV,
        payload: { csvContent: content, createMissingContainers: false },
      });

      if (response?.success) {
        setImportResult(response.data);
        setShowPreview(true);
      } else {
        onError?.(response?.error || 'Preview failed');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setImporting(false);
    }
  }, [onError]);

  const handleFileSelect = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      previewImport(content);
    };
    reader.readAsText(file);
  }, [previewImport]);

  const handleConfirmImport = React.useCallback(async () => {
    if (!csvContent) return;

    setImporting(true);
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.IMPORT_CSV,
        payload: {
          csvContent,
          createMissingContainers: createMissing,
        },
      });

      if (response?.success) {
        setImportResult(response.data);
        onImportComplete?.(response.data);
        setShowPreview(false);
        setCsvContent('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        onError?.(response?.error || 'Import failed');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [csvContent, createMissing, onImportComplete, onError]);

  const handleCancelImport = React.useCallback(() => {
    setShowPreview(false);
    setImportResult(null);
    setCsvContent('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="csv-import-export">
      <div className="section">
        <h3>Export Rules</h3>
        <p className="description">
          Export all your rules to a CSV file for backup or sharing.
        </p>

        <div className="export-options">
          <label>
            <input
              type="checkbox"
              checked={exportOptions.includeComments}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeComments: e.target.checked }))}
            />
            Include comments and headers
          </label>
          <label>
            <input
              type="checkbox"
              checked={exportOptions.includeDisabled}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeDisabled: e.target.checked }))}
            />
            Include disabled rules
          </label>
        </div>

        <div className="buttons">
          <button
            className="btn"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            className="btn ghost"
            onClick={handleDownloadTemplate}
          >
            Download Template
          </button>
        </div>
      </div>

      <div className="section">
        <h3>Import Rules</h3>
        <p className="description">
          Import rules from a CSV file. Use the template for the correct format.
        </p>

        <div className="import-options">
          <label>
            <input
              type="checkbox"
              checked={createMissing}
              onChange={(e) => setCreateMissing(e.target.checked)}
            />
            Create missing containers automatically
          </label>
        </div>

        <div className="file-input">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            disabled={importing}
          />
        </div>
      </div>

      {showPreview && importResult && (
        <div className="import-preview">
          <h3>Import Preview</h3>

          <div className="preview-stats">
            <div className="stat">
              <strong>{importResult.rules.length}</strong> rules to import
            </div>
            {importResult.errors.length > 0 && (
              <div className="stat error">
                <strong>{importResult.errors.length}</strong> errors
              </div>
            )}
            {importResult.warnings.length > 0 && (
              <div className="stat warning">
                <strong>{importResult.warnings.length}</strong> warnings
              </div>
            )}
            {importResult.missingContainers.length > 0 && (
              <div className="stat">
                <strong>{importResult.missingContainers.length}</strong> missing containers
              </div>
            )}
          </div>

          {importResult.errors.length > 0 && (
            <div className="preview-section errors">
              <h4>Errors</h4>
              <div className="messages">
                {importResult.errors.map((error, i) => (
                  <div key={i} className="message error">
                    Line {error.line}: {error.message}
                    {error.data && <div className="data">{error.data}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult.warnings.length > 0 && (
            <div className="preview-section warnings">
              <h4>Warnings</h4>
              <div className="messages">
                {importResult.warnings.map((warning, i) => (
                  <div key={i} className="message warning">
                    Line {warning.line}: {warning.message}
                    {warning.data && <div className="data">{warning.data}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult.missingContainers.length > 0 && (
            <div className="preview-section missing">
              <h4>Missing Containers</h4>
              <div className="missing-containers">
                {importResult.missingContainers.map(name => (
                  <span key={name} className="container-name">{name}</span>
                ))}
              </div>
              {createMissing && (
                <p className="note">These containers will be created automatically.</p>
              )}
            </div>
          )}

          <div className="preview-actions">
            <button
              className="btn"
              onClick={handleConfirmImport}
              disabled={importing || importResult.errors.length > 0}
            >
              {importing ? 'Importing...' : 'Import Rules'}
            </button>
            <button
              className="btn ghost"
              onClick={handleCancelImport}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .csv-import-export {
          max-width: 600px;
        }

        .section {
          margin-bottom: 2rem;
          padding: 1rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 8px;
        }

        .section h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .description {
          margin: 0 0 1rem 0;
          color: var(--text-secondary, #6c757d);
          font-size: 0.9rem;
        }

        .export-options, .import-options {
          margin: 1rem 0;
        }

        .export-options label, .import-options label {
          display: block;
          margin: 0.5rem 0;
          cursor: pointer;
        }

        .export-options input, .import-options input {
          margin-right: 0.5rem;
        }

        .buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--primary, #4a90e2);
          background: var(--primary, #4a90e2);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn.ghost {
          background: transparent;
          color: var(--primary, #4a90e2);
        }

        .file-input input {
          width: 100%;
          padding: 0.5rem;
          border: 2px dashed var(--border, #dee2e6);
          border-radius: 4px;
          cursor: pointer;
        }

        .import-preview {
          margin-top: 1rem;
          padding: 1rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 8px;
          background: var(--surface, #f8f9fa);
        }

        .import-preview h3 {
          margin: 0 0 1rem 0;
        }

        .preview-stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .stat {
          padding: 0.5rem;
          background: white;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .stat.error {
          background: #fee;
          color: #c33;
        }

        .stat.warning {
          background: #ffc;
          color: #880;
        }

        .preview-section {
          margin: 1rem 0;
        }

        .preview-section h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
        }

        .messages {
          max-height: 200px;
          overflow-y: auto;
        }

        .message {
          padding: 0.5rem;
          margin: 0.25rem 0;
          border-radius: 4px;
          font-size: 0.85rem;
        }

        .message.error {
          background: #fee;
          border-left: 3px solid #c33;
        }

        .message.warning {
          background: #ffc;
          border-left: 3px solid #880;
        }

        .data {
          margin-top: 0.25rem;
          font-family: monospace;
          font-size: 0.8rem;
          color: var(--text-secondary, #6c757d);
        }

        .missing-containers {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin: 0.5rem 0;
        }

        .container-name {
          padding: 0.25rem 0.5rem;
          background: var(--primary, #4a90e2);
          color: white;
          border-radius: 4px;
          font-size: 0.8rem;
        }

        .note {
          font-size: 0.85rem;
          color: var(--text-secondary, #6c757d);
          margin: 0.5rem 0 0 0;
        }

        .preview-actions {
          margin-top: 1rem;
          display: flex;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}