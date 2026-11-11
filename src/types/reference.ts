/** 文字资料的路由分类。 */
export type ReferenceCategory = 'readables' | 'achievements' | 'records';
/** 资料页面的公共参数。 */
export interface ReferencePageProps {
  /** 当前资料分类。 */
  category: ReferenceCategory;
}
/** 二级菜单分组，由原始世界或成就系列表提供。 */
export interface ReferenceGroup {
  /** 原始分组主键。 */
  id: string;
  /** 本地化分组名称。 */
  name: string;
}
/** 可独立展示的资料索引条目。 */
export interface ReferenceEntry {
  /** 资料主键；阅读物列表按单篇 BookID 区分。 */
  id: string;
  /** 列表条目与详情主键不同的情况下使用；阅读物指向其 BookSeriesID。 */
  detailId?: string;
  /** 本地化标题。 */
  name: string;
  /** 原始分类表提供的分组主键。 */
  groupId: string;
  /** 摘要或条件文本。 */
  description: string;
  /** manifest 中可用的图片地址。 */
  image: string;
  /** 阅读物的完整章节正文与插图；其他分类的摘要列表不提供此字段。 */
  sections?: ReferenceSection[];
}
/** 列表索引与二级分类菜单。 */
export interface ReferenceIndex {
  /** 全部资料索引。 */
  entries: ReferenceEntry[];
  /** 世界或成就系列分类。 */
  groups: ReferenceGroup[];
}
/** 纵向详情正文面板。 */
export interface ReferenceSection {
  /** 面板唯一标识。 */
  id: string;
  /** 面板标题。 */
  title: string;
  /** 本地化正文。 */
  content: string;
  /** 正文附图的站内地址。 */
  images: string[];
}
/** 详情完整展示模型。 */
export interface ReferenceDetail extends ReferenceEntry {
  /** 本地化的分组名称。 */
  groupName: string;
  /** 默认全部展开的正文面板。 */
  sections: ReferenceSection[];
}
