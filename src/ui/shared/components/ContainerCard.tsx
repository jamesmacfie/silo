import { Cookie, Edit3, Trash2 } from "lucide-react"
import { colorToCss, iconToEmoji } from "@/shared/utils/containerHelpers"
import { ActionIcon } from "@/ui/shared/components/ActionIcon"
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
          <ActionIcon
            icon={Edit3}
            onClick={() => onEdit(container)}
            actionType="edit"
            context="card"
            title="Edit container"
          />
          {onClearCookies && (
            <ActionIcon
              icon={Cookie}
              onClick={() => onClearCookies(container)}
              actionType="clear"
              context="card"
              title="Clear cookies"
            />
          )}
          <ActionIcon
            icon={Trash2}
            onClick={() => onDelete(container)}
            actionType="delete"
            context="card"
            title="Delete container"
          />
        </CardActions>
      </div>
    </Card>
  )
}
