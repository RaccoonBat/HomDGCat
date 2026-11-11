/** 可展示的单条对白；世界关联来自离线脚本引用索引。 */
export interface DialogueLine {
  /** 原始对白编号。 */
  id: string;
  /** 纯文本说话者。 */
  speaker: string;
  /** 去除游戏标记后的正文。 */
  text: string;
  /** 明确关联的世界编号或 divergent-universe 玩法分类；空数组表示未知。 */
  worlds: string[];
}
/** 世界二级导航项。 */
export interface DialogueWorld {
  /** 世界编号或 divergent-universe；unknown 表示未知，multiple 表示跨世界。 */
  id: string;
  /** 本地化世界名称或明确的未知、跨世界标签。 */
  name: string;
  /** 该导航项匹配的对白总数；跨世界对白可计入多个世界。 */
  count: number;
}
/** 工作线程请求；检索编号用于丢弃过期响应。 */
export type DialogueRequest =
  /** 初始化完整语料和世界导航。 */
  | {
      /** 初始化请求标识。 */
      type: 'init';
    }
  /** 按世界、全文和说话者筛选，并限制返回的可见条数。 */
  | {
      /** 搜索请求标识。 */
      type: 'search';
      /** 单调递增的请求编号，用于拒绝过期结果。 */
      request: number;
      /** 仅匹配对白正文的检索词，不与说话者或编号混合匹配。 */
      query: string;
      /** 说话者名称包含的筛选词。 */
      speaker: string;
      /** 空串表示全部；unknown/multiple 为特殊分组，divergent-universe 为差分宇宙，其余为世界编号。 */
      world: string;
      /** 本次最多返回并渲染的累计条数，不限制匹配总数。 */
      limit: number;
    }
  /** 读取指定对白与编号排序中的相邻上下文。 */
  | {
      /** 详情请求标识。 */
      type: 'detail';
      /** 请求编号，用于拒绝过期详情。 */
      request: number;
      /** 要查看的原始对白编号。 */
      id: string;
    };
/** 工作线程仅发送当前可见结果，避免复制整个语料库。 */
export type DialogueResponse =
  /** 报告加载和建立索引的当前阶段。 */
  | {
      /** 进度响应标识。 */
      type: 'progress';
      /** 可直接展示的中文阶段说明。 */
      message: string;
    }
  /** 语料加载完成并返回世界导航统计。 */
  | {
      /** 初始化完成响应标识。 */
      type: 'ready';
      /** 世界及 unknown、multiple 特殊分组。 */
      worlds: DialogueWorld[];
      /** 完整语料的对白条数。 */
      total: number;
    }
  /** 返回当前搜索的可见结果与完整匹配数。 */
  | {
      /** 搜索结果响应标识。 */
      type: 'results';
      /** 对应搜索请求的编号。 */
      request: number;
      /** 累计可见条目；长度至多为请求中的 limit。 */
      lines: DialogueLine[];
      /** 所有匹配条数，可能大于已返回的可见条数。 */
      total: number;
    }
  /** 返回目标对白及相邻索引，不代表实际叙事顺序。 */
  | {
      /** 详情响应标识。 */
      type: 'detail';
      /** 对应详情请求的编号。 */
      request: number;
      /** 目标前后最多各两条，包含目标本身；未找到时为空。 */
      lines: DialogueLine[];
      /** 是否在语料中找到目标编号。 */
      found: boolean;
    }
  /** 报告可重试的加载或检索错误。 */
  | {
      /** 错误响应标识。 */
      type: 'error';
      /** 可直接展示的错误说明。 */
      message: string;
    };
