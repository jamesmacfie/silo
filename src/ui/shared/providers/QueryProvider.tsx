import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const client = new QueryClient();

export function QueryProvider(props: { children: React.ReactNode; }): JSX.Element {
  return (
    <QueryClientProvider client={client}>
      {props.children}
    </QueryClientProvider>
  );
}


