import { useEffect, useRef, useState } from 'react';
import type { DialogueLine, DialogueResponse, DialogueWorld } from '@/types/dialogue';

/** 一次检索响应的身份及结果，筛选变化时不复用旧内容。 */
interface SearchResult {
  /** 正文关键词、说话者、世界和详情编号组成的检索身份。 */
  key: string;
  /** 此响应最多请求展示的条数，区分滚动追加是否完成。 */
  limit: number;
  /** 本次可见的完整对白文本。 */
  lines: DialogueLine[];
  /** 匹配总数；详情模式使用 1 或 0 表示目标是否存在。 */
  total: number;
}

/** 管理线程生命周期、搜索请求版本和失败后的完整重试。 */
export function useDialogues(
  query: string,
  speaker: string,
  world: string,
  limit: number,
  id?: string,
) {
  const worker = useRef<Worker | null>(null);
  const key = JSON.stringify([query, speaker, world, id]);
  const request = useRef({ version: 0, key: '', limit: 0 });
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState('正在启动检索线程…');
  const [error, setError] = useState('');
  const [worlds, setWorlds] = useState<DialogueWorld[]>([]);
  const [result, setResult] = useState<SearchResult>();
  useEffect(() => {
    const instance = new Worker(new URL('../workers/dialogue.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    instance.onmessage = ({ data }: MessageEvent<DialogueResponse>) => {
      if (data.type === 'progress') setProgress(data.message);
      if (data.type === 'ready') {
        setWorlds(data.worlds);
        setReady(true);
      }
      if (data.type === 'error') {
        setError(data.message);
      }
      if (
        (data.type === 'results' || data.type === 'detail') &&
        data.request === request.current.version
      ) {
        setResult({
          key: request.current.key,
          limit: request.current.limit,
          lines: data.lines,
          total: data.type === 'results' ? data.total : data.found ? 1 : 0,
        });
      }
    };
    instance.onerror = () => {
      setError('检索线程加载失败，请重试');
    };
    instance.postMessage({ type: 'init' });
    return () => {
      instance.terminate();
      worker.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready) return;
    // 输入一变化便使旧结果失效，包括防抖等待期内到达的响应。
    const version = request.current.version + 1;
    request.current = { version, key, limit };
    const timer = setTimeout(() => {
      worker.current?.postMessage(
        id
          ? { type: 'detail', request: version, id }
          : { type: 'search', request: version, query, speaker, world, limit },
      );
    }, 180);
    return () => clearTimeout(timer);
  }, [ready, query, speaker, world, limit, id, key]);
  // 同一筛选的滚动追加期间保留已有结果；切换筛选则立即隐藏上一批。
  const current = result?.key === key ? result : undefined;
  return {
    lines: current?.lines ?? [],
    total: current?.total ?? 0,
    worlds,
    error,
    progress,
    busy: !ready || !current || current.limit < limit,
    ready,
    retry: () => {
      setError('');
      setReady(false);
      setResult(undefined);
      setAttempt((value) => value + 1);
    },
  };
}
