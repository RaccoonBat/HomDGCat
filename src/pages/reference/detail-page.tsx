import { useCallback } from 'react';
import { Alert, Button, Card, Empty, Skeleton, Typography } from 'antd';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { GameText } from '@/components/game-text';
import { GameImage } from '@/components/game-image';
import { useGameResource } from '@/hooks/use-game-resource';
import { getReferenceDetail } from '@/services/reference';
import type { ReferencePageProps } from '@/types/reference';
import styles from './reference.module.scss';

/** 简洁纵向详情；所有正文面板直接展开，返回列表保留世界分类。 */
export function ReferenceDetailPage({ category }: ReferencePageProps) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const loader = useCallback(
    (signal: AbortSignal) => getReferenceDetail(category, id, signal),
    [category, id],
  );
  const { state, retry } = useGameResource(`${category}:${id}`, loader);
  const group = params.get('group');
  return (
    <article className={styles.page}>
      <Link to={`/sr/${category}${group ? `?group=${encodeURIComponent(group)}` : ''}`}>
        ← 返回列表
      </Link>
      {state.status === 'loading' && <Skeleton active paragraph={{ rows: 10 }} />}
      {state.status === 'error' && (
        <Alert
          type="error"
          title="资料加载失败"
          description={state.message}
          action={<Button onClick={retry}>重试</Button>}
        />
      )}
      {state.status === 'success' &&
        (state.data ? (
          <>
            <Typography.Title>
              <GameText text={state.data.name} />
            </Typography.Title>
            <Typography.Paragraph type="secondary">{state.data.groupName}</Typography.Paragraph>
            {state.data.image && (
              <GameImage
                src={state.data.image}
                alt={state.data.name}
                className={styles.image}
                lazy={false}
              />
            )}
            {category === 'readables' && state.data.description && (
              <Card title="简介">
                <GameText text={state.data.description} />
              </Card>
            )}
            {state.data.sections.map((section) => (
              <Card key={section.id} title={<GameText text={section.title} />}>
                <GameText text={section.content} />
                {section.images.map((src) => (
                  <GameImage
                    key={src}
                    src={src}
                    alt={section.title}
                    className={styles.illustration}
                  />
                ))}
              </Card>
            ))}
            {!state.data.sections.length && <Empty description="暂无详细正文" />}
          </>
        ) : (
          <Empty description="未找到这条资料" />
        ))}
    </article>
  );
}
