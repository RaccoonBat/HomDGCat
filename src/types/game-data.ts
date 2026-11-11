/** 数据目录使用的语言代码，CH 对应简体中文。 */
export type Language = 'CH' | 'EN' | 'JP' | 'KR';

/** manifest 中一张游戏数据表的定位信息。 */
export interface TableDescriptor {
  /** 相对于 /data/ 的 JSON 路径。 */
  path: string;
  /** 源数据记录数，用于首页统计。 */
  rows: number;
  /** 数据分类目录名，例如 characters。 */
  category: string;
}

/** 按需加载 JSON 的入口清单，不包含完整业务表。 */
export interface GameManifest {
  /** 清单结构版本，与游戏版本分开维护。 */
  schema: number;
  /** 当前收集到的游戏数据版本。 */
  version: string;
  /** 数据库实际提供的语言。 */
  languages: Language[];
  /** 逻辑表名到文件描述的映射。 */
  tables: Record<string, TableDescriptor>;
}

/** 在网络响应边界检查基础清单结构，避免将任意 JSON 直接视为有效清单。 */
export function isGameManifest(value: unknown): value is GameManifest {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.schema === 'number' &&
    typeof record.version === 'string' &&
    Array.isArray(record.languages) &&
    record.languages.every((language) => ['CH', 'EN', 'JP', 'KR'].includes(String(language))) &&
    typeof record.tables === 'object' &&
    record.tables !== null &&
    !Array.isArray(record.tables) &&
    Object.values(record.tables).every((table: unknown) => {
      if (typeof table !== 'object' || table === null) return false;
      const descriptor = table as Record<string, unknown>;
      return (
        typeof descriptor.path === 'string' &&
        typeof descriptor.rows === 'number' &&
        typeof descriptor.category === 'string'
      );
    })
  );
}
