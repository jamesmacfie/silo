interface StatusBarProps {
  message: string
  className?: string
}

export function StatusBar({
  message,
  className = "status",
}: StatusBarProps): JSX.Element {
  return <div className={className}>{message}</div>
}
