import { isGameManifest } from '@/types/game-data';
import type { GameManifest } from '@/types/game-data';

export async function getManifest(signal: AbortSignal): Promise<GameManifest> {
  const response = await fetch('/data/manifest.json', { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`数据加载失败（HTTP ${response.status}）`);
  const result: unknown = await response.json();
  if (!isGameManifest(result)) throw new Error('数据清单格式不正确');
  return result;
}
