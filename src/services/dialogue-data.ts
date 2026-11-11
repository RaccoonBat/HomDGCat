import { getManifest } from '@/services/game-data';
import { json, localize, table, object, string, number } from '@/services/data-store';
import { plainGameText } from '@/utils/game-text';
import type { DialogueLine, DialogueWorld } from '@/types/dialogue';
/** 在 Worker 内加载、汉化和建立检索索引，主线程不解析整库。 */
export async function loadDialogues(signal: AbortSignal, progress: (message: string) => void) {
  progress('正在加载对白数据…');
  const manifest = await getManifest(signal);
  const [raw, rawWorlds, mapping] = await Promise.all([
    table(manifest, 'TalkSentenceConfig', signal),
    table(manifest, 'WorldDataConfig', signal),
    json('metadata/dialogue-worlds.json', signal),
  ]);
  // 开发/构建会检查归属索引；也可用 npm run data:dialogues 手动重建。
  if (
    object(mapping).version !== 2 ||
    !string(object(mapping).revision) ||
    object(mapping).revision !== object(manifest).revision
  ) {
    throw new Error('对白世界索引与资料版本不一致，请更新资料后重试');
  }
  progress('正在加载中文文本并建立索引…');
  const [rows, worldRows] = await Promise.all([
    localize(raw, manifest, signal),
    localize(rawWorlds, manifest, signal),
  ]);
  const links = object(object(mapping).worlds);
  const lines: DialogueLine[] = rows
    .map((row) => ({
      id: String(number(row.TalkSentenceID)),
      speaker: plainGameText(string(row.TextmapTalkSentenceName)) || '未标注说话者',
      text: plainGameText(string(row.TalkSentenceText)) || '文本暂缺',
      worlds: Array.isArray(links[String(row.TalkSentenceID)])
        ? (links[String(row.TalkSentenceID)] as (number | string)[]).map(String)
        : [],
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const id of line.worlds) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!line.worlds.length) counts.set('unknown', (counts.get('unknown') ?? 0) + 1);
    if (line.worlds.length > 1) counts.set('multiple', (counts.get('multiple') ?? 0) + 1);
  }
  const worlds: DialogueWorld[] = worldRows
    .filter((row) => counts.has(String(row.ID)))
    .map((row) => ({
      id: String(row.ID),
      name: string(row.WorldName) || `世界 ${String(row.ID)}`,
      count: counts.get(String(row.ID)) ?? 0,
    }));
  // 差分宇宙是玩法分类，不伪造 WorldDataConfig 中的世界编号。
  worlds.push({
    id: 'divergent-universe',
    name: '差分宇宙',
    count: counts.get('divergent-universe') ?? 0,
  });
  worlds.push(
    { id: 'multiple', name: '跨世界对白', count: counts.get('multiple') ?? 0 },
    { id: 'unknown', name: '世界归属未知', count: counts.get('unknown') ?? 0 },
  );
  return { lines, worlds };
}
