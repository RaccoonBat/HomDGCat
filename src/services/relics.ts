import { getManifest } from './game-data';
import { array, localize, number, object, string, table } from './data-store';
import type { Manifest, Row } from './data-store';
import type { ReferenceDetail, ReferenceIndex } from '@/types/reference';
import { formatParameters } from '@/utils/game-text';

/** 按游戏实际部位分类，不依据套装编号推测类型。 */
function group(parts: Row[]): string {
  if (parts.some((part) => part.Type === 'NECK' || part.Type === 'OBJECT')) return 'planar';
  return parts.length ? 'cavern' : 'unknown';
}

/** 遗器部位代码的中文显示名。 */
const partNames: Record<string, string> = {
  HEAD: '头部',
  HAND: '手部',
  BODY: '躯干',
  FOOT: '脚部',
  NECK: '位面球',
  OBJECT: '连结绳',
};
/** 套装类型二级菜单。 */
const groups = [
  { id: 'cavern', name: '隧洞遗器' },
  { id: 'planar', name: '位面饰品' },
  { id: 'unknown', name: '未分类' },
];

function image(set: Row, manifest: Manifest): string {
  const asset = object(object(object(manifest.assets?.entities).relics)[String(set.SetID)]);
  return string(asset.icon) || string(manifest.assets?.paths?.[string(set.SetIconPath)]);
}

/** 展示源表参数计算后的完整套装效果。 */
function effect(row: Row): string {
  return formatParameters(string(row.SkillDesc), array(row.AbilityParamList));
}

/** 按需读取遗器索引及效果，单件故事留待详情加载。 */
export async function getRelicIndex(signal: AbortSignal): Promise<ReferenceIndex> {
  const manifest: Manifest = await getManifest(signal);
  const [sets = [], skills = [], parts = []] = await Promise.all(
    ['RelicSetConfig', 'RelicSetSkillConfig', 'RelicConfig'].map((name) =>
      table(manifest, name, signal),
    ),
  );
  const data = await localize({ sets, skills }, manifest, signal);
  const entries = data.sets.map((set) => ({
    id: String(number(set.SetID)),
    name: string(set.SetName),
    groupId: group(parts.filter((part) => part.SetID === set.SetID)),
    description: data.skills
      .filter((skill) => skill.SetID === set.SetID)
      .sort((a, b) => number(a.RequireNum) - number(b.RequireNum))
      .map((skill) => `${number(skill.RequireNum)} 件套：${effect(skill)}`)
      .join('\n'),
    image: image(set, manifest),
  }));
  return {
    entries,
    groups: groups.filter((item) => entries.some((entry) => entry.groupId === item.id)),
  };
}

/** 遗器套装详情：效果、部位与故事均直接展开；重复星级部位只展示最高星级版本。 */
export async function getRelicDetail(
  id: string,
  signal: AbortSignal,
): Promise<ReferenceDetail | null> {
  const manifest: Manifest = await getManifest(signal);
  const sets = await table(manifest, 'RelicSetConfig', signal);
  const set = sets.find((row) => String(row.SetID) === id);
  if (!set) return null;
  const [skills = [], parts = [], items = []] = await Promise.all(
    ['RelicSetSkillConfig', 'RelicConfig', 'ItemConfigRelic'].map((name) =>
      table(manifest, name, signal),
    ),
  );
  const matching = parts
    .filter((part) => part.SetID === set.SetID)
    .sort(
      (a, b) =>
        Number(string(b.Rarity).match(/\d+$/)?.[0] ?? 0) -
        Number(string(a.Rarity).match(/\d+$/)?.[0] ?? 0),
    );
  const unique: Row[] = Object.keys(partNames).flatMap((type) => {
    const part = matching.find((row) => row.Type === type);
    const item = part && items.find((row) => row.ID === part.ID);
    return item ? [{ ...item, partType: type }] : [];
  });
  const data = await localize(
    { set, skills: skills.filter((row) => row.SetID === set.SetID), items: unique },
    manifest,
    signal,
  );
  const groupId = group(matching);
  return {
    id,
    name: string(data.set.SetName),
    image: image(set, manifest),
    groupId,
    groupName: groups.find((item) => item.id === groupId)?.name ?? '未分类',
    description: '',
    sections: [
      ...data.skills
        .sort((a, b) => number(a.RequireNum) - number(b.RequireNum))
        .map((skill) => ({
          id: `effect-${number(skill.RequireNum)}`,
          title: `${number(skill.RequireNum)} 件套效果`,
          content: effect(skill),
          images: [],
        })),
      ...data.items.map((item) => ({
        id: `part-${number(item.ID)}`,
        title: `${partNames[string(item.partType)]} · ${string(item.ItemName)}`,
        content: string(item.ItemBGDesc),
        images: [
          string(manifest.assets?.paths?.[string(item.ItemFigureIconPath)]) ||
            string(manifest.assets?.paths?.[string(item.ItemIconPath)]),
        ].filter(Boolean),
      })),
    ],
  };
}
