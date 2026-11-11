import type { Ability, Collection, Entry, EntryDetail } from '@/types/encyclopedia';
import { getManifest } from './game-data';
import { formatParameters, plainGameText } from '@/utils/game-text';
import { table, localize, string, number, array, object } from './data-store';
import type { Row, Manifest } from './data-store';

async function primary(manifest: Manifest, category: Collection, signal: AbortSignal) {
  const names =
    category === 'characters' ? ['AvatarConfig', 'AvatarConfigLD'] : ['EquipmentConfig'];
  const rows = (await Promise.all(names.map((name) => table(manifest, name, signal)))).flat();
  return [...new Map(rows.map((row) => [number(row.AvatarID ?? row.EquipmentID), row])).values()];
}

function entry(row: Row, manifest: Manifest, category: Collection): Entry {
  const id = number(row.AvatarID ?? row.EquipmentID);
  const asset = manifest.assets?.entities?.[category]?.[String(id)];
  return {
    id,
    name: plainGameText(string(row.AvatarName ?? row.EquipmentName)) || '名称暂缺',
    rarity: Number(string(row.Rarity).match(/(\d)$/)?.[1] ?? 0),
    path: string(row.AvatarBaseType),
    element: string(row.DamageType),
    icon: asset?.icon ?? '',
    portrait: asset?.portrait ?? asset?.icon ?? '',
  };
}

/** 加载图鉴摘要并按星级、ID 降序排列；不预加载详情关联表。 */
export async function getEntries(category: Collection, signal: AbortSignal): Promise<Entry[]> {
  const manifest = await getManifest(signal);
  const rows = await primary(manifest, category, signal);
  // 列表仅本地化名称，技能和故事的关联表在进入详情时读取。
  const minimal = rows.map((row) => ({
    AvatarID: row.AvatarID,
    EquipmentID: row.EquipmentID,
    AvatarName: row.AvatarName,
    EquipmentName: row.EquipmentName,
    Rarity: row.Rarity,
    AvatarBaseType: row.AvatarBaseType,
    DamageType: row.DamageType,
  }));
  return (await localize(minimal, manifest, signal))
    .map((row) => entry(row, manifest, category))
    .sort((a, b) => b.rarity - a.rarity || b.id - a.id);
}

function ability(row: Row, manifest: Manifest, properties: Row[]): Ability {
  const id = number(row.SkillID ?? row.RankID ?? row.PointID);
  const stats = array(row.StatusAddList)
    .map(object)
    .map((stat) => {
      const property = string(stat.PropertyType);
      const label =
        string(properties.find((item) => item.PropertyType === property)?.PropertyName) || property;
      const value = number(object(stat.Value).Value);
      const percent = !/^(?:HP|Attack|Defence|Speed)(?:Base|Delta)$/.test(property);
      return `${label} +${Number((value * (percent ? 100 : 1)).toFixed(2))}${percent ? '%' : ''}`;
    })
    .join('\n');
  return {
    id,
    name: string(row.SkillName ?? row.Name ?? row.PointName),
    description:
      formatParameters(
        string(row.SkillDesc ?? row.Desc ?? row.PointDesc),
        array(row.ParamList ?? row.Param),
      ) || stats,
    icon:
      manifest.assets?.paths?.[string(row.SkillIcon ?? row.IconPath)] ??
      manifest.assets?.skills?.[String(id)] ??
      '',
    level: number(row.Level) || 1,
    // 无文本映射的可选标签不展示占位，避免把源表空哈希显示为技能类型。
    tag:
      string(row.SkillTypeDesc ?? row.SkillTag) === '文本暂缺'
        ? ''
        : string(row.SkillTypeDesc ?? row.SkillTag),
  };
}

/** 加载单个条目及关联资料；ID 不存在时返回 null，请求失败时抛出异常。 */
export async function getEntryDetail(
  category: Collection,
  id: number,
  signal: AbortSignal,
): Promise<EntryDetail | null> {
  const manifest = await getManifest(signal);
  const rows = await primary(manifest, category, signal);
  const row = rows.find((row) => number(row.AvatarID ?? row.EquipmentID) === id);
  if (!row) return null;
  const character = category === 'characters';
  const names = character
    ? [
        'AvatarSkillConfig',
        'AvatarSkillConfigLD',
        'AvatarServantSkillConfig',
        'AvatarServantConfig',
        'AvatarRankConfig',
        'AvatarRankConfigLD',
        'AvatarSkillTreeConfig',
        'AvatarSkillTreeConfigLD',
        'StoryAtlas',
        'VoiceAtlas',
        'ItemConfigAvatar',
        'AvatarPropertyConfig',
        'MultiplePathAvatarConfig',
        'MultiplePathAvatarAtlas',
      ]
    : ['EquipmentSkillConfig', 'ItemConfigEquipment'];
  const all = await Promise.all(names.map((name) => table(manifest, name, signal)));
  const tables = Object.fromEntries(names.map((name, i) => [name, all[i] ?? []]));
  const skillIds = new Set(array(row.SkillList));
  // 忆灵技能不直接挂在角色 SkillList 中，通过忆灵的生命/速度技能反向关联。
  for (const servant of tables.AvatarServantConfig ?? []) {
    if (skillIds.has(servant.HPSkill) || skillIds.has(servant.SpeedSkill)) {
      array(servant.SkillIDList).forEach((id) => skillIds.add(id));
    }
  }
  const rankIds = new Set(array(row.RankIDList));
  const select = (name: string, predicate: (row: Row) => boolean) =>
    (tables[name] ?? []).filter(predicate);
  // 多命途角色共享基础故事和部分语音；按源表指定的命途及性别找基础档案。
  const variant = (tables.MultiplePathAvatarConfig ?? []).find((item) => item.AvatarID === id);
  const atlas = (tables.MultiplePathAvatarAtlas ?? []).find((item) => item.AvatarID === id);
  const baseId = variant
    ? ((tables.MultiplePathAvatarConfig ?? [])
        .filter(
          (item) => item.BaseAvatarID === variant.BaseAvatarID && item.Gender === variant.Gender,
        )
        .sort((a, b) => number(a.AvatarID) - number(b.AvatarID))[0]?.AvatarID ?? id)
    : id;
  const storyIds = new Set(array(atlas?.StoryIDList));
  const voiceIds = new Set(array(atlas?.VoiceIDList));
  const selected = {
    row,
    properties: (tables.AvatarPropertyConfig ?? []).map((item) => ({
      PropertyType: item.PropertyType,
      PropertyName: item.PropertyName,
    })),
    skills: character
      ? ['AvatarSkillConfig', 'AvatarSkillConfigLD', 'AvatarServantSkillConfig'].flatMap((name) =>
          select(name, (item) => skillIds.has(item.SkillID)),
        )
      : select('EquipmentSkillConfig', (item) => item.SkillID === row.SkillID),
    traces: character
      ? ['AvatarSkillTreeConfig', 'AvatarSkillTreeConfigLD'].flatMap((name) =>
          select(
            name,
            (item) =>
              item.AvatarID === id &&
              (item.PointType === 1 || item.PointType === 3) &&
              (item.Level ?? 1) === 1,
          ),
        )
      : [],
    ranks: character
      ? ['AvatarRankConfig', 'AvatarRankConfigLD'].flatMap((name) =>
          select(name, (item) => rankIds.has(item.RankID)),
        )
      : [],
    stories: select(
      'StoryAtlas',
      (item) => item.AvatarID === baseId && (!atlas || storyIds.has(item.StoryID)),
    ),
    voices: select(
      'VoiceAtlas',
      (item) => item.AvatarID === baseId && (!atlas || voiceIds.has(item.VoiceID)),
    ),
    items: select(character ? 'ItemConfigAvatar' : 'ItemConfigEquipment', (item) => item.ID === id),
  };
  const data = await localize(selected, manifest, signal);
  const uniqueAbilities = (rows: Row[]) => [
    ...new Map(
      rows.map((row) => {
        const item = ability(row, manifest, data.properties);
        return [`${item.id}:${item.level}`, item];
      }),
    ).values(),
  ];
  const item = data.items[0];
  return {
    entry: entry(data.row, manifest, category),
    description: string(item?.ItemDesc ?? item?.ItemBGDesc),
    skills: uniqueAbilities(data.skills),
    traces: uniqueAbilities(data.traces),
    ranks: uniqueAbilities(data.ranks),
    stories: character
      ? data.stories
          .sort((a, b) => number(a.StoryID) - number(b.StoryID))
          .map((story, i) => ({
            id: number(story.StoryID),
            title: `角色故事 ${i + 1}`,
            text: string(story.Story),
          }))
      : [{ id, title: '背景故事', text: string(item?.ItemBGDesc) }].filter((story) => story.text),
    voices: data.voices
      .sort((a, b) => number(a.SortID) - number(b.SortID) || number(a.VoiceID) - number(b.VoiceID))
      .map((voice) => ({
        id: number(voice.VoiceID),
        title: string(voice.VoiceTitle),
        text: string(voice.Voice_M ?? voice.Voice_F),
        alternate: voice.Voice_F !== voice.Voice_M ? string(voice.Voice_F) : undefined,
      })),
  };
}
