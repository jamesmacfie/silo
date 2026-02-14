import type { Rule } from "@/shared/types"
import { getContainerColors } from "@/shared/utils/containerHelpers"
import type { ContainerLite } from "./ContainerCard"

interface RuleCardProps {
  rule: Rule
  containers: ContainerLite[]
  onToggleEnabled: (rule: Rule) => void
  onEdit: (rule: Rule) => void
  onDelete: (rule: Rule) => void
}

export function RuleCard({
  rule,
  containers,
  onToggleEnabled,
  onEdit,
  onDelete,
}: RuleCardProps): JSX.Element {
  const safeRule = {
    ...rule,
    metadata: rule.metadata || {},
    priority: typeof rule.priority === "number" ? rule.priority : 0,
    pattern: rule.pattern || "",
    ruleType: rule.ruleType || "include",
    matchType: rule.matchType || "exact",
    enabled: rule.enabled !== undefined ? rule.enabled : true,
  } as Rule

  const container = containers.find((c) => c.cookieStoreId === rule.containerId)
  const containerColors = container ? getContainerColors(container.color) : null

  const getMatchTypeIcon = () => {
    switch (rule.matchType) {
      case "exact":
        return "🎯"
      case "domain":
        return "🌐"
      case "glob":
        return "✨"
      default:
        return "🔍"
    }
  }

  const getRuleTypeIcon = () => {
    switch (rule.ruleType) {
      case "include":
        return "➕"
      case "exclude":
        return "➖"
      default:
        return "🔒"
    }
  }

  const getRuleTypeColor = () => {
    switch (rule.ruleType) {
      case "include":
        return "#28a745"
      case "exclude":
        return "#ffc107"
      default:
        return "#dc3545"
    }
  }

  return (
    <div className="card flex flex-col h-full">
      <div className="cardHead flex justify-between items-center gap-3">
        <div className="rule-left flex items-center gap-2 flex-1 min-w-0">
          <span className="match-type-icon" title={`${rule.matchType} match`}>
            {getMatchTypeIcon()}
          </span>
          <span
            className="rule-type-icon"
            style={{ color: getRuleTypeColor() }}
            title={`${rule.ruleType} rule`}
          >
            {getRuleTypeIcon()}
          </span>
          <span
            className="pattern font-mono font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0"
            title={rule.pattern}
          >
            {rule.pattern}
          </span>
        </div>
        <div className="rule-right flex items-center gap-2 flex-shrink-0">
          {container && containerColors && (
            <span
              className="container-badge px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap"
              style={{
                backgroundColor: containerColors.bg,
                borderColor: containerColors.border,
                color: containerColors.text,
              }}
              title={container.name}
            >
              {container.name}
            </span>
          )}
          {rule.ruleType === "exclude" && !container && (
            <span className="no-container-badge bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full text-xs font-medium border italic">
              No Container
            </span>
          )}
          <div className="rule-priority bg-slate-50 border-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-semibold border font-mono">
            #{rule.priority}
          </div>
        </div>
      </div>

      <div className="card-content flex-1">
        {rule.metadata?.description && (
          <div className="rule-description text-sm text-gray-500 dark:text-gray-400">
            {rule.metadata.description}
          </div>
        )}
        {!rule.enabled && (
          <div className="status-indicator">
            <span className="status-badge disabled">Disabled</span>
          </div>
        )}
      </div>

      <div className="row mt-auto">
        <div />
        <div className="actions">
          <button
            className={`btn ghost sm ${rule.enabled ? "enabled" : "disabled"}`}
            onClick={() => onToggleEnabled(safeRule)}
            title={rule.enabled ? "Disable rule" : "Enable rule"}
          >
            {rule.enabled ? "Enabled" : "Disabled"}
          </button>
          <button
            className="btn ghost sm"
            onClick={() => onEdit(safeRule)}
            title="Edit rule"
          >
            Edit
          </button>
          <button
            className="btn danger sm"
            onClick={() => onDelete(safeRule)}
            title="Delete rule"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
