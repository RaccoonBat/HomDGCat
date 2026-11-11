import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** 无限滚动窗口；数据由外部筛选，此 Hook 仅控制渲染数量。 */
interface InfiniteList {
  /** 绑定列表底部哨兵元素，接近视口时追加下一批。 */
  sentinel: RefObject<HTMLDivElement | null>;
  /** 当前展示条目数，不超过筛选结果总数。 */
  count: number;
  /** 是否还有未渲染的条目。 */
  hasMore: boolean;
}

/**
 * 分批渲染已加载的索引。
 * @param filterKey 分类及全部筛选条件的序列化值，改变后回到首批。
 * @param total 当前筛选结果总数，单位为条。
 * @param batch 每次追加条目数，默认 30。
 */
export function useInfiniteList(filterKey: string, total: number, batch = 30): InfiniteList {
  const sentinel = useRef<HTMLDivElement>(null);
  const [window, setWindow] = useState({ key: filterKey, count: batch });
  // 每次身份变化都持久化首批状态，即使新结果不足一批、不会触发观察器。
  // 条件更新只会重渲染一次；这样清空搜索时也不会恢复更早的展开数量。
  if (window.key !== filterKey) {
    setWindow({ key: filterKey, count: batch });
  }
  const count = window.key === filterKey ? window.count : batch;
  useEffect(() => {
    const target = sentinel.current;
    if (!target || count >= total) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // 一次观察只追加一批，避免同一交叉事件重复累加。
        observer.disconnect();
        setWindow({ key: filterKey, count: Math.min(count + batch, total) });
      },
      // 提前 400px 渲染，避免滚动到底时出现空白。
      { rootMargin: '400px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filterKey, total, count, batch]);
  return { sentinel, count: Math.min(count, total), hasMore: count < total };
}
