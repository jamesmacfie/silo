// Helper function to convert Firefox container colors to CSS colors
export function getContainerColor(color?: string): string {
  const colorMap: Record<string, string> = {
    blue: "#3b82f6",
    turquoise: "#06b6d4",
    green: "#10b981",
    yellow: "#f59e0b",
    orange: "#f97316",
    red: "#ef4444",
    pink: "#ec4899",
    purple: "#8b5cf6",
    toolbar: "#6b7280",
  }

  return colorMap[color || "blue"] || "#6b7280" // Default to gray
}
