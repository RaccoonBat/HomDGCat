/** 本次迁移支持的图鉴分类，同时用于路由和 manifest 图片分组。 */
export type Collection = 'characters' | 'light-cones';

/** 图鉴列表及详情页面共用的分类参数。 */
export interface EncyclopediaPageProps {
  /** 决定数据源、路由前缀及页面分区的图鉴分类。 */
  category: Collection;
}

/** 列表与详情共用的条目摘要；文本已本地化，图片地址来自 manifest。 */
export interface Entry {
  /** 游戏数据中的 AvatarID 或 EquipmentID，仅用于关联与路由，不在卡片展示。 */
  id: number;
  /** 去除游戏富文本标记后的中文名称。 */
  name: string;
  /** 星级：角色通常为 4/5，光锥为 3/4/5；0 表示源数据未提供。 */
  rarity: number;
  /** 游戏命途代码，例如 Warrior；展示层转换为中文命途名。 */
  path: string;
  /** 游戏伤害属性代码，例如 Ice；光锥为空字符串。 */
  element: string;
  /** 列表缩略图的站内绝对 URL；空字符串表示没有映射。 */
  icon: string;
  /** 详情大图的站内绝对 URL；缺少立绘时回退到缩略图。 */
  portrait: string;
}

/** 一个确定等级的技能、行迹或星魂；同一技能可存在多个等级记录。 */
export interface Ability {
  /** SkillID、PointID 或 RankID；技能分组时还需结合 level。 */
  id: number;
  /** 本地化名称，可能包含游戏富文本标记。 */
  name: string;
  /** 已替换等级参数的描述；属性行迹会补全加成数值，保留游戏文本换行。 */
  description: string;
  /** 技能或星魂图标 URL，空字符串表示没有对应图片。 */
  icon: string;
  /** 技能等级或光锥叠影等级，从 1 开始；固定效果默认为 1。 */
  level: number;
  /** 技能类型或标签，如普攻、战技；没有标签时为空字符串。 */
  tag: string;
}

/** 可折叠展示的一段故事或语音文本，不包含音频播放资源。 */
export interface TextSection {
  /** 所属章节中的 StoryID 或 VoiceID，用作折叠项标识。 */
  id: number;
  /** 章节标题或语音标题。 */
  title: string;
  /** 本地化正文，保留游戏富文本标记供展示组件处理。 */
  text: string;
  /** 男女开拓者语音不同时的另一版本；无差异时不提供。 */
  alternate?: string;
}

/** 详情页所需的完整展示模型；所有关联均在服务层完成。 */
export interface EntryDetail {
  /** 当前角色或光锥的基本信息。 */
  entry: Entry;
  /** 条目简介；优先使用物品描述，否则使用背景介绍。 */
  description: string;
  /** 各等级的角色技能（含忆灵技能）或各叠影等级的光锥效果。 */
  skills: Ability[];
  /** 角色额外能力与属性加成节点；光锥为空数组。 */
  traces: Ability[];
  /** 按源数据顺序排列的角色星魂；光锥为空数组。 */
  ranks: Ability[];
  /** 已排序的角色故事或光锥背景故事，缺少数据时为空数组。 */
  stories: TextSection[];
  /** 按 SortID 排列的语音文本，光锥为空数组。 */
  voices: TextSection[];
}

/** manifest 中图鉴服务使用的可选资源字段；与基础 GameManifest 组合读取。 */
export interface AssetManifest {
  /** 文本哈希分片数量；旧清单未声明时按 256 片处理。 */
  textShards?: number;
  /** 本地资源索引；字段缺失表示该类资源尚未收集。 */
  assets?: {
    /** 分类 → 游戏 ID → 条目图片。ID 保留字符串形式以匹配 JSON 键。 */
    entities?: Partial<Record<Collection, Record<string, EntryAssets>>>;
    /** SkillID 字符串到技能图片 URL 的映射。 */
    skills?: Record<string, string>;
    /** 游戏 SpriteOutput 原始路径到已收集站内图片 URL 的映射。 */
    paths?: Record<string, string>;
  };
}

/** 单个条目已收集到的图片；任一字段都可能缺失。 */
export interface EntryAssets {
  /** 列表缩略图 URL。 */
  icon?: string;
  /** 详情立绘或光锥大图 URL。 */
  portrait?: string;
}
