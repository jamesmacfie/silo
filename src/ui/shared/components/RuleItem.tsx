import React from "react"
import type { Rule, Container } from "@/shared/types"
import { RuleType, MatchType } from "@/shared/types"
import { Card, CardHeader, CardContent, CardActions } from "./Card"
import {
  Target,
  Globe,
  Sparkles,
  Search,
  Plus,
  Minus,
  Lock,
  HelpCircle,
} from "lucide-react"

interface Props {
  rule: Rule
  containers: Container[]
  onEdit?: (rule: Rule) => void
  onDelete?: (rule: Rule) => void
  onToggleEnabled?: (rule: Rule) => void
}

function ExpandableDescription({
  description,
}: {
  description: string
}): JSX.Element {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const maxLength = 100 // Max characters to show before truncating
  const needsTruncation = description.length > maxLength

  const displayText =
    needsTruncation && !isExpanded
      ? description.substring(0, maxLength) + "..."
      : description

  return (
    <div className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">
      <span>{displayText}</span>
      {needsTruncation && (
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium underline ml-2 bg-none border-none cursor-pointer p-0"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? "Show Less" : "Show More"}
        </button>
      )}
    </div>
  )
}

export function RuleItem({
  rule,
  containers,
  onEdit,
  onDelete,
  onToggleEnabled,
}: Props): JSX.Element {
  // Check for missing metadata
  if (!rule.metadata) {
    // Provide default metadata to prevent crash
    rule.metadata = {}
  }

  const container = containers.find((c) => c.cookieStoreId === rule.containerId)

  const getContainerColor = (color: string | undefined): string => {
    switch ((color || "").toLowerCase()) {
      case "blue":
        return "#4A90E2"
      case "turquoise":
        return "#30D5C8"
      case "green":
        return "#5CB85C"
      case "yellow":
        return "#F0AD4E"
      case "orange":
        return "#FF8C42"
      case "red":
        return "#D9534F"
      case "pink":
        return "#FF69B4"
      case "purple":
        return "#7B68EE"
      case "toolbar":
        return "#999"
      default:
        return "#6c757d"
    }
  }

  const getRuleTypeInfo = (ruleType: RuleType) => {
    switch (ruleType) {
      case RuleType.INCLUDE:
        return {
          label: "Include",
          color: "#28a745",
          icon: Plus,
          description: "Open in container",
        }
      case RuleType.EXCLUDE:
        return {
          label: "Exclude",
          color: "#ffc107",
          icon: Minus,
          description: "Break out of container",
        }
      case RuleType.RESTRICT:
        return {
          label: "Restrict",
          color: "#dc3545",
          icon: Lock,
          description: "Only allow in this container",
        }
      default:
        return {
          label: "Unknown",
          color: "#6c757d",
          icon: HelpCircle,
          description: "Unknown rule type",
        }
    }
  }

  const getMatchTypeInfo = (matchType: MatchType) => {
    switch (matchType) {
      case MatchType.EXACT:
        return { label: "Exact", icon: Target, description: "Exact URL match" }
      case MatchType.DOMAIN:
        return { label: "Domain", icon: Globe, description: "Domain match" }
      case MatchType.GLOB:
        return {
          label: "Glob",
          icon: Sparkles,
          description: "Glob pattern match (wildcards)",
        }
      case MatchType.REGEX:
        return {
          label: "Regex",
          icon: Search,
          description: "Regular expression match",
        }
      default:
        return {
          label: "Unknown",
          icon: HelpCircle,
          description: "Unknown match type",
        }
    }
  }

  const ruleTypeInfo = getRuleTypeInfo(rule.ruleType)
  const matchTypeInfo = getMatchTypeInfo(rule.matchType)

  // Render icons based on type
  const renderMatchIcon = () => {
    switch (rule.matchType) {
      case MatchType.EXACT:
        return (
          <span title={matchTypeInfo.description}>
            <Target className="text-lg flex-shrink-0" size={16} />
          </span>
        )
      case MatchType.DOMAIN:
        return (
          <span title={matchTypeInfo.description}>
            <Globe className="text-lg flex-shrink-0" size={16} />
          </span>
        )
      case MatchType.GLOB:
        return (
          <span title={matchTypeInfo.description}>
            <Sparkles className="text-lg flex-shrink-0" size={16} />
          </span>
        )
      case MatchType.REGEX:
        return (
          <span title={matchTypeInfo.description}>
            <Search className="text-lg flex-shrink-0" size={16} />
          </span>
        )
      default:
        return (
          <span title={matchTypeInfo.description}>
            <HelpCircle className="text-lg flex-shrink-0" size={16} />
          </span>
        )
    }
  }

  const renderRuleIcon = () => {
    switch (rule.ruleType) {
      case RuleType.INCLUDE:
        return (
          <span title={ruleTypeInfo.description}>
            <Plus
              className="text-lg flex-shrink-0"
              size={16}
              style={{ color: ruleTypeInfo.color }}
            />
          </span>
        )
      case RuleType.EXCLUDE:
        return (
          <span title={ruleTypeInfo.description}>
            <Minus
              className="text-lg flex-shrink-0"
              size={16}
              style={{ color: ruleTypeInfo.color }}
            />
          </span>
        )
      case RuleType.RESTRICT:
        return (
          <span title={ruleTypeInfo.description}>
            <Lock
              className="text-lg flex-shrink-0"
              size={16}
              style={{ color: ruleTypeInfo.color }}
            />
          </span>
        )
      default:
        return (
          <span title={ruleTypeInfo.description}>
            <HelpCircle
              className="text-lg flex-shrink-0"
              size={16}
              style={{ color: ruleTypeInfo.color }}
            />
          </span>
        )
    }
  }

  return (
    <Card
      className={`h-full flex flex-col ${!rule.enabled ? "opacity-70" : ""}`}
    >
      <CardHeader className="flex justify-between items-center gap-3 min-h-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {renderMatchIcon()}
          {renderRuleIcon()}
          <span
            className="font-mono font-medium overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0"
            title={rule.pattern}
          >
            {rule.pattern}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {container && (
            <span
              className="text-sm font-medium max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap"
              title={container.name}
              style={{ color: getContainerColor(container.color) }}
            >
              {container.name}
            </span>
          )}
          {rule.ruleType === RuleType.EXCLUDE && (
            <span className="text-xs text-gray-600 dark:text-gray-400 italic">
              No Container
            </span>
          )}
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded whitespace-nowrap">
            #{rule.priority}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between min-h-12">
        <div>
          {rule.metadata?.description && (
            <ExpandableDescription description={rule.metadata.description} />
          )}
          {!rule.metadata?.description && <div className="h-5" />}
        </div>
        {!rule.enabled && (
          <div className="mt-2">
            <span className="px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/40">
              Disabled
            </span>
          </div>
        )}
      </CardContent>

      <div className="flex justify-end">
        <CardActions>
          <button
            type="button"
            className={`btn ghost sm ${rule.enabled ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600" : "bg-gray-500 text-white border-gray-500 hover:bg-gray-600 hover:border-gray-600"}`}
            onClick={() => onToggleEnabled?.(rule)}
            title={rule.enabled ? "Disable rule" : "Enable rule"}
          >
            {rule.enabled ? "Enabled" : "Disabled"}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onEdit?.(rule)}
            title="Edit rule"
          >
            Edit
          </button>
          <button
            type="button"
            className="btn danger sm"
            onClick={() => onDelete?.(rule)}
            title="Delete rule"
          >
            Delete
          </button>
        </CardActions>
      </div>
    </Card>
  )
}
