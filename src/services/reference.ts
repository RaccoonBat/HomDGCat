import { getManifest } from './game-data';
import { array, localize, number, string, table } from './data-store';
import { formatParameters } from '@/utils/game-text';
import type { Manifest, Row } from './data-store';
import type {
  ReferenceCategory,
  ReferenceDetail,
  ReferenceEntry,
  ReferenceIndex,
  ReferenceSection,
} from '@/types/reference';

/** 各分类使用真实主表、分类表和字段，不根据编号推断所属世界。 */
const schemas = {
  readables: {
    table: 'BookSeriesConfig',
    groups: 'BookSeriesWorld',
    id: 'BookSeriesID',
    name: 'BookSeries',
    group: 'BookSeriesWorld',
    groupId: 'BookSeriesWorld',
    groupName: 'BookSeriesWorldTextmapID',
    desc: 'BookSeriesComments',
  },
  achievements: {
    table: 'AchievementData',
    groups: 'AchievementSeries',
    id: 'AchievementID',
    name: 'AchievementTitle',
    group: 'SeriesID',
    groupId: 'SeriesID',
    groupName: 'SeriesTitle',
    desc: 'AchievementDesc',
  },
  records: {
    table: 'BackGroundMusic',
    groups: 'BackGroundMusicGroup',
    id: 'ID',
    name: 'MusicName',
    group: 'GroupID',
    groupId: 'ID',
    groupName: 'GroupName',
    desc: 'UnlockDesc',
  },
} as const;

/** 读取原表及其分类，所有网络请求可被页面取消。 */
async function source(category: ReferenceCategory, signal: AbortSignal) {
  const manifest: Manifest = await getManifest(signal);
  const schema = schemas[category];
  const [rows, groups] = await Promise.all([
    table(manifest, schema.table, signal),
    table(manifest, schema.groups, signal),
  ]);
  return { manifest, schema, rows, groups };
}

/** 替换成就条件中的数字占位符，保留正文中的安全展示标记。 */
function description(row: Row, field: string) {
  return formatParameters(string(row[field]), array(row.ParamList));
}

/** 根据实际专辑名称标注发行世界，白噪声专辑跨越多个世界。 */
function groupLabel(category: ReferenceCategory, name: string): string {
  if (category !== 'records') return name || '未分类';
  const worlds: Record<string, string> = {
    失控: '空间站「黑塔」',
    雪融于烬: '雅利洛-Ⅵ',
    长生梦短: '仙舟「罗浮」',
    飞来波的圣状: '匹诺康尼',
    洞穴寓言: '翁法罗斯',
    神不在的乐园: '二相乐园',
    宇宙的独白: '跨世界 · 白噪声',
  };
  return worlds[name] ? `${worlds[name]} · ${name}` : `未分类 · ${name}`;
}

/** 阅读物以单篇为检索单位，进入阅读物页面后加载正文，便于全文筛选和直接阅读。 */
async function getReadableIndex(signal: AbortSignal): Promise<ReferenceIndex> {
  const { manifest, rows, groups } = await source('readables', signal);
  const chapters = await table(manifest, 'LocalbookConfig', signal);
  const data = await localize(
    {
      series: rows.map((row) => ({
        BookSeriesID: row.BookSeriesID,
        BookSeries: row.BookSeries,
        BookSeriesWorld: row.BookSeriesWorld,
      })),
      chapters: chapters.map((row) => ({
        BookID: row.BookID,
        BookSeriesID: row.BookSeriesID,
        BookInsideName: row.BookInsideName,
        BookContent: row.BookContent,
        LocalBookImagePath: row.LocalBookImagePath,
      })),
      groups,
    },
    manifest,
    signal,
  );
  const series = new Map(data.series.map((row) => [row.BookSeriesID, row]));
  const menuGroups = data.groups.map((row) => ({
    id: String(number(row.BookSeriesWorld)),
    name: string(row.BookSeriesWorldTextmapID) || '未分类',
  }));
  const entries = data.chapters.map((chapter): ReferenceEntry => {
    const parent = series.get(chapter.BookSeriesID);
    const id = String(number(chapter.BookID));
    const groupId = String(number(parent?.BookSeriesWorld));
    if (!menuGroups.some((group) => group.id === groupId))
      menuGroups.push({ id: groupId, name: '未分类' });
    const name = string(chapter.BookInsideName) || string(parent?.BookSeries) || '未命名阅读物';
    return {
      id,
      detailId: String(number(chapter.BookSeriesID)),
      name,
      groupId,
      description: '',
      image: '',
      sections: [
        {
          id,
          title: name,
          content: string(chapter.BookContent),
          images: array(chapter.LocalBookImagePath)
            .map((path) => string(manifest.assets?.paths?.[string(path)]))
            .filter(Boolean),
        },
      ],
    };
  });
  return { groups: menuGroups, entries };
}

/** 阅读物加载单篇完整正文；其他分类仅加载标题及摘要。 */
export async function getReferenceIndex(
  category: ReferenceCategory,
  signal: AbortSignal,
): Promise<ReferenceIndex> {
  if (category === 'readables') return getReadableIndex(signal);
  const { manifest, schema, rows, groups } = await source(category, signal);
  const localized = await localize(
    {
      rows: rows.map((row) => ({
        [schema.id]: row[schema.id],
        [schema.name]: row[schema.name],
        [schema.group]: row[schema.group],
        [schema.desc]: row[schema.desc],
        ParamList: row.ParamList,
      })),
      groups,
    },
    manifest,
    signal,
  );
  const menuGroups = localized.groups.map((row) => ({
    id: String(row[schema.groupId]),
    name: groupLabel(category, string(row[schema.groupName])),
  }));
  // 原表新增或缺失的分类也提供明确入口，避免条目只能在“全部”中找到。
  for (const row of localized.rows) {
    const id = String(number(row[schema.group]));
    if (!menuGroups.some((item) => item.id === id)) menuGroups.push({ id, name: '未分类' });
  }
  return {
    groups: menuGroups,
    entries: localized.rows.map((row): ReferenceEntry => ({
      id: String(row[schema.id]),
      name: string(row[schema.name]) || '未命名资料',
      groupId: String(number(row[schema.group])),
      description: description(row, schema.desc),
      image: '',
    })),
  };
}

/** 详情按主键读取，书籍章节按卷序排序，音乐保留白噪声等所有曲目。 */
export async function getReferenceDetail(
  category: ReferenceCategory,
  id: string,
  signal: AbortSignal,
): Promise<ReferenceDetail | null> {
  const { manifest, schema, rows, groups } = await source(category, signal);
  const raw = rows.find((row) => String(row[schema.id]) === id);
  if (!raw) return null;
  const group = groups.find((row) => row[schema.groupId] === raw[schema.group]);
  let chapters: Row[] = [];
  let disk: Row = {};
  if (category === 'readables')
    chapters = (await table(manifest, 'LocalbookConfig', signal))
      .filter((row) => row.BookSeriesID === raw.BookSeriesID)
      .sort((a, b) => number(a.BookSeriesInsideID) - number(b.BookSeriesInsideID));
  if (category === 'records')
    disk = (await table(manifest, 'ItemConfigDisk', signal)).find((row) => row.ID === raw.ID) ?? {};
  const data = await localize({ row: raw, group: group ?? {}, chapters, disk }, manifest, signal);
  const sections: ReferenceSection[] = [];
  const image = (path: unknown) => string(manifest.assets?.paths?.[string(path)]);
  const add = (key: string, title: string, content: unknown) => {
    if (string(content)) sections.push({ id: key, title, content: string(content), images: [] });
  };
  if (category === 'readables') {
    data.chapters.forEach((chapter) =>
      sections.push({
        id: String(chapter.BookID),
        title: string(chapter.BookInsideName) || `第 ${number(chapter.BookSeriesInsideID)} 卷`,
        content: string(chapter.BookContent),
        images: array(chapter.LocalBookImagePath).map(image).filter(Boolean),
      }),
    );
  } else if (category === 'achievements') {
    add('condition', '达成条件', description(data.row, 'AchievementDesc'));
    add('extra', '补充说明', description(data.row, 'AchievementDescPS'));
    add(
      'visibility',
      '显示条件',
      data.row.ShowType === 'ShowAfterFinish' ? '达成后显示' : '默认显示',
    );
  } else {
    add('story', '曲目介绍', data.row.BGMDesc);
    add('unlock', '获取方式', data.row.UnlockDesc);
    add('disk', '唱片说明', data.disk.ItemDesc);
    add('background', '唱片故事', data.disk.ItemBGDesc);
  }
  return {
    id,
    name: string(data.row[schema.name]),
    groupId: String(number(raw[schema.group])),
    groupName: groupLabel(category, string(data.group[schema.groupName])),
    description: description(data.row, schema.desc),
    image: image(data.disk.ItemIconPath),
    sections,
  };
}
