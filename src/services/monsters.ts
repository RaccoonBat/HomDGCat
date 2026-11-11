import { getManifest } from './game-data';
import { array, localize, number, object, string, table } from './data-store';
import type { Manifest, Row } from './data-store';
import type {
  MonsterDetail,
  MonsterEntry,
  MonsterLevel,
  MonsterResistance,
  MonsterStats,
} from '@/types/monsters';
import { formatParameters, plainGameText } from '@/utils/game-text';
import { calculateMonsterStat } from '@/utils/monster-stats';

/** 清单中的怪物图片分组，独立于角色/光锥分类。 */
interface MonsterAssetManifest extends Manifest {
  /** 怪物资源来自已有静态清单。 */
  assets?: Manifest['assets'] & {
    /** MonsterTemplateID 字符串到图片的映射。 */
    entities?: NonNullable<Manifest['assets']>['entities'] & {
      /** 模板大图及缩略图 URL。 */
      monsters?: Record<
        string,
        { /** 缩略图 URL。 */ icon?: string; /** 立绘 URL。 */ portrait?: string }
      >;
    };
  };
}

/** 源表数值可能包裹在 Value 中；默认值只用于未配置字段，不能覆盖合法的零。 */
function value(input: unknown, fallback = 0): number {
  const raw = typeof input === 'number' ? input : object(input).Value;
  return typeof raw === 'number' ? raw : fallback;
}

function entry(row: Row, instances: Row[], manifest: MonsterAssetManifest): MonsterEntry {
  const id = number(row.MonsterTemplateID);
  const asset = manifest.assets?.entities?.monsters?.[String(id)];
  return {
    id,
    name: plainGameText(string(row.MonsterName)) || '名称暂缺',
    rank: string(row.Rank),
    icon: asset?.icon ?? '',
    portrait: asset?.portrait ?? asset?.icon ?? '',
    weaknesses: [
      ...new Set(
        instances.flatMap((instance) => array(instance.StanceWeakList).map(string)).filter(Boolean),
      ),
    ],
  };
}

/** 获取按模板聚合的怪物索引；实例仅用于收集弱点筛选，不提前下载技能文本。 */
export async function getMonsters(signal: AbortSignal): Promise<MonsterEntry[]> {
  const manifest = await getManifest(signal);
  const [templates = [], instances = []] = await Promise.all(
    ['MonsterTemplateConfig', 'MonsterConfig'].map((name) => table(manifest, name, signal)),
  );
  const minimal = await localize(
    templates.map((row) => ({
      MonsterTemplateID: row.MonsterTemplateID,
      MonsterName: row.MonsterName,
      Rank: row.Rank,
    })),
    manifest,
    signal,
  );
  const grouped = new Map<number, Row[]>();
  for (const instance of instances) {
    const id = number(instance.MonsterTemplateID);
    const group = grouped.get(id) ?? [];
    group.push(instance);
    grouped.set(id, group);
  }
  return minimal
    .map((row) => entry(row, grouped.get(number(row.MonsterTemplateID)) ?? [], manifest))
    .sort((a, b) => b.id - a.id);
}

function resistances(input: unknown): MonsterResistance[] {
  return array(input)
    .map(object)
    .map((row) => ({ type: string(row.DamageType ?? row.Key), ratio: value(row.Value) }));
}

function stats(template: Row, instance: Row, hard: Row, elite: Row): MonsterStats {
  const field = (base: string, modify: string, ratio: string) =>
    calculateMonsterStat({
      base: value(template[base]),
      instanceRatio: value(instance[modify], 1),
      levelRatio: value(hard[ratio], 1),
      eliteRatio: value(elite[ratio], 1),
      addition: value(instance[modify.replace('Ratio', 'Value')]),
    });
  return {
    hp: field('HPBase', 'HPModifyRatio', 'HPRatio'),
    attack: field('AttackBase', 'AttackModifyRatio', 'AttackRatio'),
    defence: field('DefenceBase', 'DefenceModifyRatio', 'DefenceRatio'),
    speed: field('SpeedBase', 'SpeedModifyRatio', 'SpeedRatio'),
    toughness: field('StanceBase', 'StanceModifyRatio', 'StanceRatio') / 3,
  };
}

/** 支持模板 ID 和旧版实例 ID 深链接；缺少目标时返回 null。 */
export async function getMonsterDetail(
  id: number,
  signal: AbortSignal,
): Promise<MonsterDetail | null> {
  const manifest = await getManifest(signal);
  const [templates = [], instances = [], allSkills = [], hardLevels = [], elites = []] =
    await Promise.all(
      [
        'MonsterTemplateConfig',
        'MonsterConfig',
        'MonsterSkillConfig',
        'HardLevelGroup',
        'EliteGroup',
      ].map((name) => table(manifest, name, signal)),
    );
  const requestedInstance = instances.find((row) => row.MonsterID === id);
  const template =
    templates.find((row) => row.MonsterTemplateID === id) ??
    templates.find((row) => row.MonsterTemplateID === requestedInstance?.MonsterTemplateID);
  if (!template) return null;
  const variants = instances.filter((row) => row.MonsterTemplateID === template.MonsterTemplateID);
  // 旧实例链接优先展示所指实例，不改变模板下其余变体的可选范围。
  variants.sort(
    (a, b) =>
      Number(b.MonsterID === id) - Number(a.MonsterID === id) ||
      number(a.MonsterID) - number(b.MonsterID),
  );
  const skillIds = new Set(variants.flatMap((row) => array(row.SkillList)));
  const localized = await localize(
    { template, variants, skills: allSkills.filter((row) => skillIds.has(row.SkillID)) },
    manifest,
    signal,
  );
  return {
    entry: entry(localized.template, variants, manifest),
    variants: localized.variants.map((instance) => {
      const elite = elites.find((row) => row.EliteGroup === (instance.EliteGroup ?? 0));
      // 仅展示确有匹配难度组和精英组的等级，避免将缺失倍率误当成 1。
      const levels: MonsterLevel[] = elite
        ? hardLevels
            .filter((row) => row.HardLevelGroup === (instance.HardLevelGroup ?? 0))
            .map((hard) => ({
              level: number(hard.Level),
              stats: stats(template, instance, hard, elite),
            }))
            .sort((a, b) => a.level - b.level)
        : [];
      return {
        id: number(instance.MonsterID),
        name: plainGameText(string(instance.MonsterName)),
        description: string(instance.MonsterIntroduction),
        weaknesses: array(instance.StanceWeakList).map(string),
        resistances: resistances(instance.DamageTypeResistance),
        debuffResistances: resistances(instance.DebuffResist),
        levels,
        skills: array(instance.SkillList).flatMap((id) => {
          const skill = localized.skills.find((row) => row.SkillID === id);
          return skill
            ? [
                {
                  id: number(skill.SkillID),
                  name: string(skill.SkillName),
                  description: formatParameters(string(skill.SkillDesc), array(skill.ParamList)),
                  tag:
                    string(skill.SkillTypeDesc) === '文本暂缺' ? '' : string(skill.SkillTypeDesc),
                },
              ]
            : [];
        }),
      };
    }),
  };
}
