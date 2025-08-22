export function iconToEmoji(icon: string | undefined): string {
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

export function colorToCss(color: string | undefined): string {
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
      return "#ccc"
  }
}

export interface ContainerColors {
  bg: string
  border: string
  text: string
}

export function getContainerColors(color?: string): ContainerColors {
  switch ((color || "").toLowerCase()) {
    case "blue":
      return { bg: "#4A90E240", border: "#4A90E2", text: "#2563EB" }
    case "turquoise":
      return { bg: "#30D5C840", border: "#30D5C8", text: "#0891B2" }
    case "green":
      return { bg: "#5CB85C40", border: "#5CB85C", text: "#16A34A" }
    case "yellow":
      return { bg: "#F0AD4E40", border: "#F0AD4E", text: "#CA8A04" }
    case "orange":
      return { bg: "#FF8C4240", border: "#FF8C42", text: "#EA580C" }
    case "red":
      return { bg: "#D9534F40", border: "#D9534F", text: "#DC2626" }
    case "pink":
      return { bg: "#FF69B440", border: "#FF69B4", text: "#EC4899" }
    case "purple":
      return { bg: "#7B68EE40", border: "#7B68EE", text: "#7C3AED" }
    case "toolbar":
      return { bg: "#99999940", border: "#999999", text: "#6B7280" }
    default:
      return { bg: "#6c757d40", border: "#6c757d", text: "#6B7280" }
  }
}
