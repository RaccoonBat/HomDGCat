/** 怪物图鉴摘要，以模板聚合不同战斗实例。 */
export interface MonsterEntry {
  /** MonsterTemplateID，详情路由使用的模板身份。 */
  id: number;
  /** 已本地化的怪物名称。 */
  name: string;
  /** 源数据中的强度分级，如 Elite、BigBoss。 */
  rank: string;
  /** 列表缩略图 URL，缺失时为空字符串。 */
  icon: string;
  /** 详情立绘 URL，缺少大图时回退到缩略图。 */
  portrait: string;
  /** 此模板各战斗实例所包含的弱点属性代码。 */
  weaknesses: string[];
}

/** 一个属性或状态的抗性。 */
export interface MonsterResistance {
  /** 属性代码或状态键，展示层负责转换可识别的中文名称。 */
  type: string;
  /** 抗性比例，0.2 对应 20%。 */
  ratio: number;
}

/** 选定实例和等级后可直接展示的怪物数值。 */
export interface MonsterStats {
  /** 生命值，已应用等级、实例和精英倍率。 */
  hp: number;
  /** 攻击力。 */
  attack: number;
  /** 防御力。 */
  defence: number;
  /** 速度。 */
  speed: number;
  /** 削韧值，以游戏常用单位表示，源表 Stance 数值除以 3。 */
  toughness: number;
}

/** 怪物技能说明。 */
export interface MonsterSkill {
  /** MonsterSkillConfig.SkillID。 */
  id: number;
  /** 本地化技能名称。 */
  name: string;
  /** 已替换技能参数的说明文本。 */
  description: string;
  /** 本地化技能类型，源表未提供时为空字符串。 */
  tag: string;
}

/** 模板下的一个战斗实例，拥有独立弱点、技能与数值倍率。 */
export interface MonsterVariant {
  /** MonsterConfig.MonsterID，作为变体选择值。 */
  id: number;
  /** 实例名称，可能与模板名称不同。 */
  name: string;
  /** 实例背景介绍。 */
  description: string;
  /** 实例实际弱点属性代码。 */
  weaknesses: string[];
  /** 实例属性抗性。 */
  resistances: MonsterResistance[];
  /** 实例异常状态抗性。 */
  debuffResistances: MonsterResistance[];
  /** 当前实例使用的技能，按 SkillList 顺序排列。 */
  skills: MonsterSkill[];
  /** 此实例源表实际提供的等级配置，不补造缺失倍率。 */
  levels: MonsterLevel[];
}

/** 某一可用等级对应的完整数值。 */
export interface MonsterLevel {
  /** 源表 HardLevelGroup.Level。 */
  level: number;
  /** 按此等级计算的属性。 */
  stats: MonsterStats;
}

/** 怪物详情展示模型。 */
export interface MonsterDetail {
  /** 模板基本信息。 */
  entry: MonsterEntry;
  /** 模板关联的战斗实例，缺少实例时为空数组。 */
  variants: MonsterVariant[];
}
