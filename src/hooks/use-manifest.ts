import { useEffect, useState } from 'react';
import { getManifest } from '@/services/game-data';
import type { GameManifest } from '@/types/game-data';

/** 首页清单请求状态；只有 success 分支提供已校验的数据。 */
type ManifestState =
  | { status: 'loading' }
  | { status: 'success'; data: GameManifest }
  | { status: 'error'; message: string };

export function useManifest() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ManifestState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    void getManifest(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : '数据加载失败',
          });
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    state,
    retry: () => {
      setState({ status: 'loading' });
      setAttempt((value) => value + 1);
    },
  };
}
