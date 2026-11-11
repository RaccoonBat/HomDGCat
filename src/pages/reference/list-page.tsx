import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Menu, Skeleton, Typography } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { GameText } from '@/components/game-text';
import { GameImage } from '@/components/game-image';
import { plainGameText } from '@/utils/game-text';
import { useGameResource } from '@/hooks/use-game-resource';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { getReferenceIndex } from '@/services/reference';
import type { ReferencePageProps } from '@/types/reference';
import styles from './reference.module.scss';

/** 读物、成就及唱片列表：二级分类写入 URL，结果以滚动方式追加。 */
export function ReferenceListPage({ category }: ReferencePageProps) {
  const loader = useCallback(
    (signal: AbortSignal) => getReferenceIndex(category, signal),
    [category],
  );
  const { state, retry } = useGameResource(category, loader);
  const [params, setParams] = useSearchParams();
  const group = params.get('group') ?? '';
  const [query, setQuery] = useState('');
  const data = state.status === 'success' ? state.data : undefined;
  const filtered = useMemo(
    () =>
      (data?.entries ?? []).filter(
        (entry) =>
          (!group || entry.groupId === group) &&
          plainGameText(
            `${entry.name} ${entry.description} ${(entry.sections ?? []).map((section) => section.content).join('\n')}`,
          )
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [data, group, query],
  );
  const { sentinel, count, hasMore } = useInfiniteList(
    JSON.stringify([category, group, query]),
    filtered.length,
  );
  const title = { readables: '阅读物', achievements: '成就', records: '唱片与音乐' }[category];
  return (
    <section className={styles.page}>
      <Typography.Text type="secondary">星穹档案 / {title}</Typography.Text>
      <Typography.Title>{title}</Typography.Title>
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
          <nav
            aria-label={category === 'achievements' ? '成就系列' : '星球与世界'}
            className={styles.menu}
          >
            <Menu
              mode="horizontal"
              selectedKeys={[group]}
              items={[
                { key: '', label: '全部' },
                ...state.data.groups.map((item) => ({ key: item.id, label: item.name })),
              ]}
              onClick={({ key }) => {
                const next = new URLSearchParams(params);
                if (key) next.set('group', key);
                else next.delete('group');
                setParams(next);
              }}
            />
          </nav>
          <div className={styles.filters}>
            <Input
              aria-label="搜索资料"
              placeholder={category === 'readables' ? '搜索阅读物标题或正文内容' : '搜索名称或说明'}
              value={query}
              allowClear
              onChange={(event) => setQuery(event.target.value)}
            />
            <Typography.Text type="secondary">共 {filtered.length} 项</Typography.Text>
          </div>
          {!filtered.length && (
            <Empty description="没有匹配的资料">
              <Button
                onClick={() => {
                  setQuery('');
                  setParams({});
                }}
              >
                清空筛选
              </Button>
            </Empty>
          )}
          <div className={styles.list}>
            {filtered.slice(0, count).map((entry) =>
              category === 'readables' ? (
                <Card
                  key={entry.id}
                  title={
                    <Link
                      to={`/sr/readables/${entry.detailId}${group ? `?group=${encodeURIComponent(group)}` : ''}`}
                    >
                      <GameText text={entry.name} />
                    </Link>
                  }
                >
                  {/* 正文直接展示，不折叠、不截断；只把标题作为详情链接，避免选中文字时跳页。 */}
                  {entry.sections?.map((section) => (
                    <div key={section.id}>
                      <GameText text={section.content} />
                      {section.images.map((src) => (
                        <GameImage
                          key={src}
                          src={src}
                          alt={entry.name}
                          className={styles.illustration}
                        />
                      ))}
                    </div>
                  ))}
                </Card>
              ) : (
                <Link
                  key={entry.id}
                  to={`/sr/${category}/${entry.id}${group ? `?group=${encodeURIComponent(group)}` : ''}`}
                >
                  <Card hoverable title={<GameText text={entry.name} />}>
                    <GameText text={entry.description || '查看详细资料'} />
                  </Card>
                </Link>
              ),
            )}
          </div>
          <div ref={sentinel} role="status" aria-live="polite" className={styles.status}>
            {filtered.length > 0 &&
              (hasMore ? '继续向下滚动，查看更多' : `已展示全部 ${filtered.length} 项`)}
          </div>
        </>
      )}
    </section>
  );
}
