import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useGameResource } from '@/hooks/use-game-resource';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { getEntries } from '@/services/encyclopedia';
import type { EncyclopediaPageProps } from '@/types/encyclopedia';
import { GameImage } from '@/components/game-image';
import { paths, elements } from './labels';
import styles from './encyclopedia.module.scss';

export function CollectionPage({ category }: EncyclopediaPageProps) {
  const loader = useCallback((signal: AbortSignal) => getEntries(category, signal), [category]);
  const { state, retry } = useGameResource(category, loader);
  const [query, setQuery] = useState('');
  const [path, setPath] = useState<string>();
  const [element, setElement] = useState<string>();
  const [rarity, setRarity] = useState<number>();
  const entries = state.status === 'success' ? state.data : undefined;
  const filtered = useMemo(
    () =>
      (entries ?? []).filter(
        (entry) =>
          entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
          (!path || entry.path === path) &&
          (!element || entry.element === element) &&
          (!rarity || entry.rarity === rarity),
      ),
    [entries, query, path, element, rarity],
  );
  const character = category === 'characters';
  const { sentinel, count, hasMore } = useInfiniteList(
    JSON.stringify([category, query, path, element, rarity]),
    filtered.length,
  );
  const reset = () => {
    setQuery('');
    setPath(undefined);
    setElement(undefined);
    setRarity(undefined);
  };
  return (
    <section className={styles.page}>
      <header>
        <Typography.Text type="secondary">星穹档案 / {character ? '角色' : '光锥'}</Typography.Text>
        <Typography.Title>{character ? '角色图鉴' : '光锥图鉴'}</Typography.Title>
        <Typography.Paragraph type="secondary">
          {character
            ? '沿着不同的命途，与旅途中的同行者重逢。'
            : '收藏时光的切片，读懂每一道光里的故事。'}
        </Typography.Paragraph>
      </header>
      <div className={styles.filters}>
        <Input
          aria-label="搜索名称"
          placeholder="搜索名称"
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="命途"
          placeholder="全部命途"
          allowClear
          value={path}
          onChange={setPath}
          options={[...new Set(entries?.map((entry) => entry.path))]
            .filter(Boolean)
            .map((value) => ({ value, label: paths[value] ?? value }))}
        />
        {character && (
          <Select
            aria-label="属性"
            placeholder="全部属性"
            allowClear
            value={element}
            onChange={setElement}
            options={Object.entries(elements).map(([value, label]) => ({ value, label }))}
          />
        )}
        <Select
          aria-label="星级"
          placeholder="全部星级"
          allowClear
          value={rarity}
          onChange={setRarity}
          options={(character ? [4, 5] : [3, 4, 5]).map((value) => ({
            value,
            label: `${value} 星`,
          }))}
        />
        <Button onClick={reset}>重置</Button>
      </div>
      {state.status === 'loading' && <Skeleton active paragraph={{ rows: 8 }} />}
      {state.status === 'error' && (
        <Alert
          type="error"
          title="资料加载失败"
          description={state.message}
          action={<Button onClick={retry}>重试</Button>}
        />
      )}
      {state.status === 'success' && (
        <>
          <Typography.Text type="secondary">
            共 {filtered.length} {character ? '位角色' : '张光锥'}
          </Typography.Text>
          {filtered.length === 0 ? (
            <Empty description="没有匹配的资料">
              <Button onClick={reset}>清空筛选</Button>
            </Empty>
          ) : (
            <div className={styles.grid}>
              {filtered.slice(0, count).map((entry) => (
                <Link to={`/sr/${category}/${entry.id}`} className={styles.entry} key={entry.id}>
                  <GameImage
                    src={entry.icon}
                    alt={entry.name}
                    className={`${styles.cover} ${!character ? styles.coneCover : ''}`}
                  />
                  <div className={styles.caption}>
                    <strong>{entry.name}</strong>
                    <Space size={4}>
                      <Tag variant="filled">{paths[entry.path] ?? entry.path}</Tag>
                      {entry.element && <span>{elements[entry.element] ?? entry.element}</span>}
                      <span className={styles.stars} aria-label={`${entry.rarity}星`}>
                        {'★'.repeat(entry.rarity)}
                      </span>
                    </Space>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div ref={sentinel} role="status" aria-live="polite" className={styles.scrollStatus}>
            {filtered.length > 0 &&
              (hasMore ? '继续向下滚动，查看更多' : `已展示全部 ${filtered.length} 项`)}
          </div>
        </>
      )}
    </section>
  );
}
