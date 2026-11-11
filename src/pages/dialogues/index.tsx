import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Menu, Space, Spin, Tag, Typography } from 'antd';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDialogues } from '@/hooks/use-dialogues';
import type { DialogueLine } from '@/types/dialogue';
import './dialogues.scss';
/** 纵向对白组件参数。 */
interface LineProps {
  /** 待显示的纯文本对白。 */
  line: DialogueLine;
  /** 是否为详情页正在查看的条目。 */
  active?: boolean;
}
/** 默认展开的纵向对白，全部内容均由 React 文本节点输出。 */
function Line({ line, active = false }: LineProps) {
  const [params] = useSearchParams();
  const suffix = params.get('world')
    ? `?${new URLSearchParams({ world: params.get('world')! })}`
    : '';
  return (
    <article className={active ? 'dialogue-line dialogue-line--active' : 'dialogue-line'}>
      <Space wrap>
        <Typography.Text strong>{line.speaker}</Typography.Text>
        <Tag>#{line.id}</Tag>
        {line.worlds.length > 1 && <Tag>跨世界</Tag>}
        {!line.worlds.length && <Tag>世界归属未知</Tag>}
      </Space>
      <p>{line.text}</p>
      <Link to={`/sr/dialogues/${line.id}${suffix}`}>查看对白与相邻索引</Link>
    </article>
  );
}
/** 世界二级导航、全文/说话者检索及自动增量展示。 */
export function DialoguePage() {
  const [params, setParams] = useSearchParams();
  const world = params.get('world') ?? '';
  const [query, setQuery] = useState('');
  const [speaker, setSpeaker] = useState('');
  const filterKey = JSON.stringify([query, speaker, world]);
  const [window, setWindow] = useState({ key: filterKey, limit: 40 });
  // 二级菜单、输入框或浏览器前进/后退改变筛选时，均重置到首批。
  if (window.key !== filterKey) setWindow({ key: filterKey, limit: 40 });
  const limit = window.key === filterKey ? window.limit : 40;
  const data = useDialogues(query, speaker, world, limit);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !data.ready || data.busy || data.lines.length >= data.total) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setWindow({ key: filterKey, limit: limit + 40 });
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.ready, data.busy, data.lines.length, data.total, filterKey, limit]);
  return (
    <div className="dialogue-page">
      <Typography.Title level={2}>剧情对白</Typography.Title>
      <div className="dialogue-layout">
        <aside>
          <Menu
            selectedKeys={[world]}
            onClick={({ key }) => {
              setParams(key ? { world: key } : {});
            }}
            items={[
              { key: '', label: '全部世界' },
              ...data.worlds.map((item) => ({
                key: item.id,
                label: `${item.name}（${item.count}）`,
              })),
            ]}
          />
        </aside>
        <section className="dialogue-results">
          <Space wrap className="dialogue-search">
            <Input
              aria-label="全文搜索"
              placeholder="搜索对白正文内容"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              allowClear
            />
            <Input
              aria-label="说话者搜索"
              placeholder="筛选说话者"
              value={speaker}
              onChange={(event) => {
                setSpeaker(event.target.value);
              }}
              allowClear
            />
          </Space>
          {data.error ? (
            <Alert
              type="error"
              title={data.error}
              action={<Button onClick={data.retry}>重试</Button>}
            />
          ) : !data.ready || (data.busy && !data.lines.length) ? (
            <Spin description={data.ready ? '正在筛选正文…' : data.progress}>
              <div className="dialogue-loading" />
            </Spin>
          ) : (
            <>
              <Typography.Paragraph type="secondary">
                共 {data.total.toLocaleString()} 条结果 ·
                世界归属依据任务、位面与脚本引用；未能确认的条目单独列出。
              </Typography.Paragraph>
              {data.lines.map((line) => (
                <Line key={line.id} line={line} />
              ))}
              {!data.lines.length && <Empty description="没有匹配的对白" />}
              <div ref={sentinel} className="dialogue-sentinel">
                {data.lines.length < data.total ? '继续向下滚动加载' : '已显示全部结果'}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
/** 展示指定对白及编号排序的相邻条目，不将编号顺序当作叙事顺序。 */
export function DialogueDetailPage() {
  const [params] = useSearchParams();
  const suffix = params.get('world')
    ? `?${new URLSearchParams({ world: params.get('world')! })}`
    : '';
  const { id = '' } = useParams();
  const data = useDialogues('', '', '', 0, id);
  return (
    <div className="dialogue-page">
      <Link to={`/sr/dialogues${suffix}`}>返回剧情对白</Link>
      <Typography.Title level={2}>对白 #{id}</Typography.Title>
      <Alert type="info" title="以下为对白编号索引中的相邻条目，不代表实际剧情播放顺序。" />
      {data.error ? (
        <Alert
          type="error"
          title={data.error}
          action={<Button onClick={data.retry}>重试</Button>}
        />
      ) : data.busy ? (
        <Spin description={data.progress}>
          <div className="dialogue-loading" />
        </Spin>
      ) : !data.total ? (
        <Empty description="未找到该对白" />
      ) : (
        data.lines.map((line) => <Line key={line.id} line={line} active={line.id === id} />)
      )}
    </div>
  );
}
