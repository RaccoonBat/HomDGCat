import { useEffect, useState } from 'react';

/** 异步资源状态；通过 status 收窄后才可读取 data 或 message。 */
type State<T> =
  /** 首次进入、切换条目或重试期间，不暴露上一份数据。 */
  | { status: 'loading' }
  /** 当前请求成功，data 保持服务函数的返回类型。 */
  | { status: 'success'; data: T }
  /** 当前请求失败，message 可直接展示给用户。 */
  | { status: 'error'; message: string };

/** 请求身份与结果，避免路由切换时短暂显示上一位角色。 */
interface ResourceResult<T> {
  /** 分类、条目 ID 等组成的资源身份。 */
  key: string;
  /** 重试次数，防止同一 key 的旧请求覆盖重试状态。 */
  attempt: number;
  /** 对应本次身份的加载结果。 */
  state: State<T>;
}

/** 业务组件消费的资源及重试入口。 */
interface Resource<T> {
  /** 当前资源状态。 */
  state: State<T>;
  /** 重新执行 loader，立即进入 loading 状态。 */
  retry: () => void;
}

/**
 * 读取可取消的业务资源。
 * @param key 当前资源的唯一身份，改变时立即隐藏旧结果。
 * @param loader 用 useCallback 保持稳定的加载函数，需将 signal 传递给 fetch。
 */
export function useGameResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ResourceResult<T>>();
  useEffect(() => {
    const controller = new AbortController();
    void loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key, attempt, state: { status: 'success', data } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            attempt,
            state: {
              status: 'error',
              message: error instanceof Error ? error.message : '资料加载失败',
            },
          });
      });
    // 卸载、切换条目和重试都会取消旧请求；取消后不再更新状态。
    return () => controller.abort();
  }, [key, attempt, loader]);
  const state: State<T> =
    result?.key === key && result.attempt === attempt ? result.state : { status: 'loading' };
  return { state, retry: () => setAttempt((value) => value + 1) };
}
