/** 单项怪物数值计算所需的源表系数。 */
export interface MonsterStatFactors {
  /** 模板基础值。 */
  base: number;
  /** 战斗实例倍率，未配置时使用 1。 */
  instanceRatio: number;
  /** 选定等级的难度倍率。 */
  levelRatio: number;
  /** 实例精英组倍率。 */
  eliteRatio: number;
  /** 实例额外固定加成，未配置时为 0。 */
  addition: number;
}

/** 与旧版怪物页面一致：基础值依次乘实例、等级、精英倍率，最后加固定值。 */
export function calculateMonsterStat(factors: MonsterStatFactors): number {
  return (
    factors.base * factors.instanceRatio * factors.levelRatio * factors.eliteRatio +
    factors.addition
  );
}
