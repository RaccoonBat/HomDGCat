import { useCallback, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
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
import { getMonsterDetail } from '@/services/monsters';
import type { MonsterDetail, MonsterResistance } from '@/types/monsters';
import { elements } from '@/pages/encyclopedia/labels';
import { plainGameText } from '@/utils/game-text';
import styles from './monsters.module.scss';

/** 怪物详情成功状态的内容参数。 */
interface MonsterContentProps {
  /** 已本地化且已计算各等级数值的怪物资料。 */
  data: MonsterDetail;
}

/** 属性或异常状态抗性区域的参数。 */
interface ResistanceProps {
  /** 待展示抗性；没有显式抗性时展示“无额外配置”。 */
  rows: MonsterResistance[];
}

/** 常见状态抗性代码；未识别代码保留原值，避免误译。 */
const statusNames: Record<string, string> = {
  STAT_CTRL_Frozen: '冻结',
  STAT_CTRL_Confine: '禁锢',
  STAT_CTRL_Entangle: '纠缠',
  STAT_CTRL_Stun: '眩晕',
  STAT_CTRL: '控制效果',
};

function Resistances({ rows }: ResistanceProps) {
  return rows.length ? (
    <Space wrap>
      {rows.map((row) => (
        <Tag key={row.type}>
          {elements[row.type] ?? statusNames[row.type] ?? row.type}{' '}
          {Number((row.ratio * 100).toFixed(2))}%
        </Tag>
      ))}
    </Space>
  ) : (
    <Typography.Text type="secondary">无额外配置</Typography.Text>
  );
}

function MonsterContent({ data }: MonsterContentProps) {
  const [variantId, setVariantId] = useState(data.variants[0]?.id);
  const variant = data.variants.find((item) => item.id === variantId);
  const [requestedLevel, setRequestedLevel] = useState(80);
  // 切换实例时沿用可用的同等级，否则使用该实例实际提供的最高等级。
  const level =
    variant?.levels.find((item) => item.level === requestedLevel) ?? variant?.levels.at(-1);
  return (
    <>
      <Typography.Title>{data.entry.name}</Typography.Title>
      <div className={styles.overview}>
        <GameImage
          src={data.entry.portrait}
          alt={data.entry.name}
          className={styles.portrait}
          lazy={false}
        />
        <div className={styles.page}>
          {variant ? (
            <>
              <Card title="战斗资料">
                <Space orientation="vertical" size="middle" className={styles.fullWidth}>
                  <Space wrap>
                    <span>战斗变体</span>
                    <Select
                      aria-label="战斗变体"
                      value={variant.id}
                      onChange={setVariantId}
                      className={styles.variantSelect}
                      options={data.variants.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.id}`,
                      }))}
                    />
                  </Space>
                  <Space wrap>
                    <span>等级</span>
                    <Select
                      aria-label="怪物等级"
                      value={level?.level}
                      onChange={setRequestedLevel}
                      disabled={!variant.levels.length}
                      options={variant.levels.map((item) => ({
                        value: item.level,
                        label: `等级 ${item.level}`,
                      }))}
                    />
                  </Space>
                  {level ? (
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={Object.entries({
                        生命值: level.stats.hp,
                        攻击力: level.stats.attack,
                        防御力: level.stats.defence,
                        速度: level.stats.speed,
                        韧性: level.stats.toughness,
                      }).map(([label, value]) => ({
                        key: label,
                        label,
                        children: value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }),
                      }))}
                    />
                  ) : (
                    <Alert type="info" title="该变体暂无完整等级配置" />
                  )}
                  <div>
                    <Typography.Title level={5}>弱点</Typography.Title>
                    <Space wrap>
                      {variant.weaknesses.length ? (
                        variant.weaknesses.map((type) => (
                          <Tag key={type}>{elements[type] ?? type}</Tag>
                        ))
                      ) : (
                        <Typography.Text type="secondary">无弱点</Typography.Text>
                      )}
                    </Space>
                  </div>
                  <div>
                    <Typography.Title level={5}>属性抗性</Typography.Title>
                    <Resistances rows={variant.resistances} />
                  </div>
                  <div>
                    <Typography.Title level={5}>状态抗性</Typography.Title>
                    <Resistances rows={variant.debuffResistances} />
                  </div>
                </Space>
              </Card>
              {variant.description && (
                <Card title="怪物介绍">
                  <GameText text={variant.description} />
                </Card>
              )}
              <Card title="怪物技能">
                {variant.skills.length ? (
                  <Collapse
                    key={variant.id}
                    defaultActiveKey={variant.skills.map((skill) => skill.id)}
                    items={variant.skills.map((skill) => ({
                      key: skill.id,
                      label: (
                        <Space wrap>
                          <span>{plainGameText(skill.name)}</span>
                          {skill.tag && <Tag>{plainGameText(skill.tag)}</Tag>}
                        </Space>
                      ),
                      children: <GameText text={skill.description || '暂无技能说明'} />,
                    }))}
                  />
                ) : (
                  <Empty description="暂无技能资料" />
                )}
              </Card>
            </>
          ) : (
            <Empty description="暂无战斗变体资料" />
          )}
        </div>
      </div>
    </>
  );
}

export function MonsterDetailPage() {
  const { id = '' } = useParams();
  const loader = useCallback(
    (signal: AbortSignal) =>
      /^\d+$/.test(id) ? getMonsterDetail(Number(id), signal) : Promise.resolve(null),
    [id],
  );
  const { state, retry } = useGameResource(`monster/${id}`, loader);
  return (
    <article className={styles.page}>
      <Link to="/sr/monsters">← 返回怪物图鉴</Link>
      {state.status === 'loading' && <Skeleton active paragraph={{ rows: 10 }} />}
      {state.status === 'error' && (
        <Alert
          type="error"
          title="怪物资料加载失败"
          description={state.message}
          action={<Button onClick={retry}>重试</Button>}
        />
      )}
      {state.status === 'success' &&
        (state.data ? (
          <MonsterContent key={id} data={state.data} />
        ) : (
          <Empty description="找不到这份怪物资料" />
        ))}
    </article>
  );
}
