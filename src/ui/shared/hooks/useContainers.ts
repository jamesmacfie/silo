import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import browser from 'webextension-polyfill';
import type { Container } from '@/shared/types';

export function useContainers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['containers'],
    queryFn: async () => {
      const res = await browser.runtime.sendMessage({ type: 'GET_CONTAINERS' });
      return (res?.data ?? []) as Container[];
    },
  });

  useEffect(() => {
    // Placeholder for future pub/sub integration
    const handler = (msg: unknown) => {
      const m = msg as { type?: string; payload?: { topic?: string; payload?: Container[] } };
      if (m?.type === 'STATE_EVENT' && m?.payload?.topic === 'containers') {
        queryClient.setQueryData(['containers'], m.payload?.payload as Container[]);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => {
      browser.runtime.onMessage.removeListener(handler);
    };
  }, [queryClient]);

  return query;
}


