import { colorToCss, iconToEmoji } from "@/shared/utils/containerHelpers"
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
} from "@/ui/shared/components/Card"

export interface ContainerLite {
  id: string
  name: string
  cookieStoreId: string
  color?: string
  icon?: string
  created?: number
  modified?: number
  temporary?: boolean
  syncEnabled?: boolean
}

interface ContainerCardProps {
  container: ContainerLite
  onEdit: (container: ContainerLite) => void
  onDelete: (container: ContainerLite) => void
  onClearCookies?: (container: ContainerLite) => void
}

export function ContainerCard({
  container,
  onEdit,
  onDelete,
  onClearCookies,
}: ContainerCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <span
          className="swatch"
          style={{ background: colorToCss(container.color) }}
        />
        <span className="mr-1.5 text-base">{iconToEmoji(container.icon)}</span>
        <div className="name">{container.name}</div>
      </CardHeader>
      <CardContent>
        <div className="small">{container.cookieStoreId}</div>
      </CardContent>
      <div className="row">
        <div />
        <CardActions>
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => onEdit(container)}
          >
            Edit
          </button>
          {onClearCookies && (
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => onClearCookies(container)}
            >
              Clear Cookies
            </button>
          )}
          <button
            className="btn danger sm"
            type="button"
            onClick={() => onDelete(container)}
          >
            Delete
          </button>
        </CardActions>
      </div>
    </Card>
  )
}
