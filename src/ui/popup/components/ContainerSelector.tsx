import type { Container } from "@/shared/types"
import { useContainerLoading, useContainers } from "@/ui/shared/stores"

type Props = { onSelect(container: Container): void }

export function ContainerSelector(props: Props): JSX.Element {
  const containers = useContainers()
  const isLoading = useContainerLoading()

  if (isLoading) {
    return <div>Loading…</div>
  }

  return (
    <div>
      {containers.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            props.onSelect(c)
            return
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
