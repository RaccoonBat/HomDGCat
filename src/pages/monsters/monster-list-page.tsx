import { useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { GameImage } from '@/components/game-image';
import { useGameResource } from '@/hooks/use-game-resource';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { getMonsters } from '@/services/monsters';
import { elements } from '@/pages/encyclopedia/labels';
import styles from './monsters.module.scss';

/** 源表强度分级的中文展示名。 */
const monsterRanks: Record<string, string> = {
  Minion: '普通敌人',
  MinionLv2: '召唤物',
  Elite: '精英敌人',
  LittleBoss: '首领',
  BigBoss: '强敌',
};

export function MonsterListPage() {
  const { state, retry } = useGameResource('monsters', getMonsters);
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState<string>();
  const [weakness, setWeakness] = useState<string>();
  const filtered = useMemo(
    () =>
      state.status === 'success'
        ? state.data.filter(
            (entry) =>
              entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
              (!rank || entry.rank === rank) &&
              (!weakness || entry.weaknesses.includes(weakness)),
          )
        : [],
    [state, query, rank, weakness],
  );
  const { sentinel, count, hasMore } = useInfiniteList(
    JSON.stringify([query, rank, weakness]),
    filtered.length,
  );
  const reset = () => {
    setQuery('');
    setRank(undefined);
    setWeakness(undefined);
  };
  return (
    <section className={styles.page}>
      <header>
        <Typography.Text type="secondary">星穹档案 / 怪物</Typography.Text>
        <Typography.Title>怪物图鉴</Typography.Title>
        <Typography.Paragraph type="secondary">
          查看敌人的弱点、战斗变体与技能。
        </Typography.Paragraph>
      </header>
      <div className={styles.filters}>
        <Input
          aria-label="搜索怪物"
          placeholder="搜索怪物名称"
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="怪物类型"
          placeholder="全部类型"
          allowClear
          value={rank}
          onChange={setRank}
          options={Object.entries(monsterRanks).map(([value, label]) => ({ value, label }))}
        />
        <Select
          aria-label="怪物弱点"
          placeholder="全部弱点"
          allowClear
          value={weakness}
          onChange={setWeakness}
          options={Object.entries(elements).map(([value, label]) => ({ value, label }))}
        />
        <Button onClick={reset}>重置</Button>
      </div>
      {state.status === 'loading' && <Skeleton active paragraph={{ rows: 8 }} />}
      {state.status === 'error' && (
        <Alert
          type="error"
          title="怪物资料加载失败"
          description={state.message}
          action={<Button onClick={retry}>重试</Button>}
        />
      )}
      {state.status === 'success' && (
        <>
          <Typography.Text type="secondary">共 {filtered.length} 种怪物</Typography.Text>
          {filtered.length ? (
            <div className={styles.grid}>
              {filtered.slice(0, count).map((entry) => (
                <Link key={entry.id} to={`/sr/monsters/${entry.id}`} className={styles.link}>
                  <GameImage src={entry.icon} alt={entry.name} className={styles.thumbnail} />
                  <Typography.Text strong>{entry.name}</Typography.Text>
                  <Space wrap size={4}>
                    <Tag>{monsterRanks[entry.rank] ?? entry.rank}</Tag>
                    {entry.weaknesses.map((type) => (
                      <Tag key={type}>{elements[type] ?? type}</Tag>
                    ))}
                  </Space>
                </Link>
              ))}
            </div>
          ) : (
            <Empty description="没有匹配的怪物">
              <Button onClick={reset}>清空筛选</Button>
            </Empty>
          )}
          <div className={styles.status} ref={sentinel} role="status">
            {filtered.length > 0 && (hasMore ? '继续向下滚动，查看更多' : '已展示全部怪物')}
          </div>
        </>
      )}
    </section>
  );
}
