import type { GameManifest } from '@/types/game-data';
import type { AssetManifest } from '@/types/encyclopedia';
import { textBucket } from '@/utils/game-text';

/** 原始异构游戏表记录；读取字段时逐项收窄，避免使用 any。 */
export type Row = Record<string, unknown>;
/** 图鉴使用的清单视图，包含表索引和可选图片、文本分片信息。 */
export type Manifest = GameManifest & AssetManifest;
// 只缓存成功响应，不缓存失败或取消请求，确保失败后可重新加载。
const cache = new Map<string, unknown>();
/** 仅接受字符串字段，缺失或类型不符时返回空字符串。 */
export const string = (value: unknown) => (typeof value === 'string' ? value : '');
/** 仅接受数字字段，缺失或类型不符时返回 0。 */
export const number = (value: unknown) => (typeof value === 'number' ? value : 0);
/** 将可选数组字段收窄为数组，缺失时返回空数组。 */
export const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
/** 将原始对象字段收窄为记录，数组或空值返回空对象。 */
export const object = (value: unknown): Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : {};

/** 读取 /data/ 下的 JSON，成功后在当前页面运行时缓存；失败允许重试。 */
export async function json(path: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  if (cache.has(path)) return cache.get(path);
  const response = await fetch(`/data/${path}`, { signal });
  if (!response.ok) throw new Error(`资料加载失败（HTTP ${response.status}）`);
  const data: unknown = await response.json();
  cache.set(path, data);
  return data;
}

/** 根据清单表名读取原始记录；可选表不在清单时返回空数组。 */
export async function table(manifest: Manifest, name: string, signal: AbortSignal): Promise<Row[]> {
  const descriptor = manifest.tables[name];
  if (!descriptor) return [];
  const data = await json(descriptor.path, signal);
  if (!Array.isArray(data)) throw new Error(`${name} 数据格式不正确`);
  return data.map(object);
}

/** 递归将 Hash 包装字段替换为中文文本，保留调用方的记录层次与数组顺序。 */
export async function localize<T>(data: T, manifest: Manifest, signal: AbortSignal): Promise<T> {
  const catalog = object(await json('CH/texts/catalog.json', signal));
  const hashes = new Set<string>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') {
      const row = object(value);
      if (typeof row.Hash === 'string' || typeof row.Hash === 'number')
        hashes.add(String(row.Hash));
      Object.values(row).forEach(collect);
    }
  };
  collect(data);
  // 名称通常在 catalog 中；其他文本按哈希定位分片，避免整库加载。
  const buckets = new Set(
    [...hashes]
      .filter((hash) => /^\d+$/.test(hash) && !Object.hasOwn(catalog, hash))
      .map((hash) => textBucket(hash, manifest.textShards)),
  );
  const parts = await Promise.all(
    [...buckets].map((bucket) => json(`CH/texts/${bucket}.json`, signal)),
  );
  const texts = Object.assign({}, catalog, ...parts.map(object)) as Row;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object') {
      const row = object(value);
      if (
        (typeof row.Hash === 'string' || typeof row.Hash === 'number') &&
        Object.keys(row).length === 1
      )
        return texts[String(row.Hash)] ?? '文本暂缺';
      return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, visit(item)]));
    }
    return value;
  };
  return visit(data) as T;
}
