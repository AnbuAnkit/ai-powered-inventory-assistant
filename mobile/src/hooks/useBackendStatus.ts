import { useEffect, useState } from 'react';

import { fetchHealth } from '@/api/chat';

export type BackendState = 'checking' | 'online' | 'offline';

export interface BackendStatus {
  state: BackendState;
  model: string | null;
}

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>({ state: 'checking', model: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((report) => {
        if (controller.signal.aborted) return;
        setStatus({
          state: report.ollamaReachable ? 'online' : 'offline',
          model: report.model,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus({ state: 'offline', model: null });
      });
    return () => controller.abort();
  }, []);

  return status;
}
