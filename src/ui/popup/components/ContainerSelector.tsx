import type { Container } from '@/shared/types';
import { useContainers } from '@/ui/shared/hooks/useContainers';

type Props = { onSelect(container: Container): void };

export function ContainerSelector(props: Props): JSX.Element {
  const { data: containers = [], isLoading } = useContainers();

  if (isLoading) {
    return (
      <div>Loading…</div>
    );
  }

  return (
    <div>
      {containers.map((c) => (
        <button key={c.id} type="button" onClick={() => { props.onSelect(c); return; }}>
          {c.name}
        </button>
      ))}
    </div>
  );
}


