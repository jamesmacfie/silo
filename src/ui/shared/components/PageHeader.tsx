import React from "react"

interface PageHeaderProps {
  title: string
  children?: React.ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps): JSX.Element {
  return (
    <div className="header">
      <h2 className="title">{title}</h2>
      {children}
    </div>
  )
}
