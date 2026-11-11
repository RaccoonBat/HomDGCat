import { useCallback, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import { Link, useParams } from 'react-router-dom';
import { GameImage } from '@/components/game-image';
import { GameText } from '@/components/game-text';
import { useGameResource } from '@/hooks/use-game-resource';
import { getEntryDetail } from '@/services/encyclopedia';
import type {
  Ability,
  EncyclopediaPageProps,
  EntryDetail,
  TextSection,
} from '@/types/encyclopedia';
import { plainGameText } from '@/utils/game-text';
import { elements, paths } from './labels';
import styles from './encyclopedia.module.scss';

/** 单个技能、行迹或星魂的展示参数。 */
interface AbilityContentProps {
  /** 已选择等级并替换参数的效果记录。 */
  ability: Ability;
}

/** 故事或语音折叠区域的展示参数。 */
interface TextSectionsProps {
  /** 已按源数据排序的章节；空数组展示暂无资料。 */
  rows: TextSection[];
}

/** 加载成功后的详情正文参数，分类控制角色/光锥的分区差异。 */
interface DetailContentProps extends EncyclopediaPageProps {
  /** 服务层完成本地化及关联后的详情数据。 */
  data: EntryDetail;
}

function AbilityContent({ ability }: AbilityContentProps) {
  return (
    <div className={styles.ability}>
      {ability.icon && <GameImage src={ability.icon} alt="" className={styles.skillIcon} />}
      <div>
        <Space wrap>
          <Typography.Text strong>{plainGameText(ability.name)}</Typography.Text>
          {ability.tag && <Tag>{plainGameText(ability.tag)}</Tag>}
        </Space>
        <GameText text={ability.description || '暂无技能描述'} />
      </div>
    </div>
  );
}

function TextSections({ rows }: TextSectionsProps) {
  return rows.length ? (
    <Collapse
      // 初次进入时展开全部故事或语音，之后仍允许用户独立收起各项。
      defaultActiveKey={rows.map((row) => row.id)}
      items={rows.map((row) => ({
        key: row.id,
        label: plainGameText(row.title),
        children: (
          <>
            <GameText text={row.text} />
            {row.alternate && (
              <>
                <Typography.Text type="secondary">另一开拓者版本</Typography.Text>
                <GameText text={row.alternate} />
              </>
            )}
          </>
        ),
      }))}
    />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资料" />
  );
}

function DetailContent({ data, category }: DetailContentProps) {
  const character = category === 'characters';
  const [level, setLevel] = useState(1);
  const skillIds = [...new Set(data.skills.map((skill) => skill.id))];
  // 普攻、秘技等技能的最高等级可能不同：选取不高于当前等级的最后一条记录。
  const skills = skillIds.flatMap((id) => {
    const versions = data.skills
      .filter((skill) => skill.id === id)
      .sort((a, b) => a.level - b.level);
    return versions.filter((skill) => skill.level <= level).at(-1) ?? versions[0] ?? [];
  });
  const maxLevel = Math.max(1, ...data.skills.map((skill) => skill.level));
  return (
    <>
      <header>
        <Typography.Text type="secondary">{character ? '角色档案' : '光锥档案'}</Typography.Text>
        <Typography.Title>{data.entry.name}</Typography.Title>
        <Space wrap>
          <Tag color="gold">{data.entry.rarity} 星</Tag>
          <Tag>{paths[data.entry.path] ?? data.entry.path}</Tag>
          {data.entry.element && <Tag>{elements[data.entry.element] ?? data.entry.element}</Tag>}
        </Space>
      </header>
      <div className={styles.overview}>
        <div className={styles.artwork}>
          <GameImage
            src={data.entry.portrait}
            alt={`${data.entry.name}立绘`}
            className={`${styles.portrait} ${!character ? styles.conePortrait : ''}`}
            lazy={false}
          />
        </div>
        <div className={styles.skillColumn}>
          {data.description && (
            <Card>
              <GameText text={data.description} />
            </Card>
          )}
          <Card
            title={character ? '角色技能' : '光锥效果'}
            extra={
              <Select
                aria-label={character ? '技能等级' : '叠影等级'}
                value={level}
                onChange={setLevel}
                options={Array.from({ length: maxLevel }, (_, i) => ({
                  value: i + 1,
                  label: character ? `等级 ${i + 1}` : `叠影 ${i + 1}`,
                }))}
              />
            }
          >
            {skills.length ? (
              <div className={styles.skills}>
                {skills.map((skill) => (
                  <AbilityContent key={skill.id} ability={skill} />
                ))}
              </div>
            ) : (
              <Empty description="暂无技能资料" />
            )}
          </Card>
          {data.traces.length > 0 && (
            <Card title="行迹">
              <Collapse
                defaultActiveKey={data.traces.map((trace) => trace.id)}
                items={data.traces.map((trace) => ({
                  key: trace.id,
                  label: plainGameText(trace.name),
                  children: <AbilityContent ability={trace} />,
                }))}
              />
            </Card>
          )}
        </div>
      </div>
      {character ? (
        <section className={styles.section}>
          <Typography.Title level={2}>星魂</Typography.Title>
          <div className={styles.rankGrid}>
            {data.ranks.map((rank, i) => (
              <Card
                key={rank.id}
                title={
                  <span className={styles.rankTitle}>
                    <span>星魂 {i + 1}</span>
                    <strong>{plainGameText(rank.name)}</strong>
                  </span>
                }
              >
                <AbilityContent ability={{ ...rank, name: '' }} />
              </Card>
            ))}
          </div>
          {!data.ranks.length && <Empty description="暂无星魂资料" />}
        </section>
      ) : (
        <section className={styles.section}>
          <Typography.Title level={2}>叠影</Typography.Title>
          <Collapse
            defaultActiveKey={data.skills.map((skill) => skill.level)}
            items={data.skills.map((skill) => ({
              key: skill.level,
              label: `叠影 ${skill.level} · ${plainGameText(skill.name)}`,
              children: <GameText text={skill.description} />,
            }))}
          />
        </section>
      )}
      <section className={styles.section}>
        <Typography.Title level={2}>{character ? '角色故事' : '背景故事'}</Typography.Title>
        <TextSections rows={data.stories} />
      </section>
      {character && (
        <section className={styles.section}>
          <Typography.Title level={2}>语音</Typography.Title>
          <Typography.Paragraph type="secondary">角色语音文本</Typography.Paragraph>
          <TextSections rows={data.voices} />
        </section>
      )}
    </>
  );
}

export function DetailPage({ category }: EncyclopediaPageProps) {
  const { id = '' } = useParams();
  const loader = useCallback(
    (signal: AbortSignal) =>
      /^\d+$/.test(id) ? getEntryDetail(category, Number(id), signal) : Promise.resolve(null),
    [category, id],
  );
  const { state, retry } = useGameResource(`${category}/${id}`, loader);
  return (
    <article className={styles.page}>
      <Link to={`/sr/${category}`}>← 返回{category === 'characters' ? '角色' : '光锥'}图鉴</Link>
      {state.status === 'loading' && <Skeleton active paragraph={{ rows: 12 }} />}
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
          <DetailContent key={`${category}/${id}`} data={state.data} category={category} />
        ) : (
          <Empty description="找不到这份资料" />
        ))}
    </article>
  );
}
