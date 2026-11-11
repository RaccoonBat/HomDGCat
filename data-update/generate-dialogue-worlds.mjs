/**
 * 正式数据更新工具：从游戏任务、位面和剧情引用生成对白归属索引。
 * 默认写入 site/data/metadata/dialogue-worlds.json；--collection 指定暂存资料目录。
 * --if-needed 在数据提交和索引算法版本一致时跳过生成。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const collectionArg = process.argv.indexOf('--collection');
if (
  collectionArg >= 0 &&
  (!process.argv[collectionArg + 1] || process.argv[collectionArg + 1].startsWith('--'))
) {
  throw new Error('--collection requires a directory');
}
const root =
  collectionArg >= 0
    ? path.resolve(process.argv[collectionArg + 1])
    : fileURLToPath(new URL('../site/data/', import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
// 索引算法版本独立于资料版本，避免更新规则后复用旧产物。
const version = 2;
// 开发和构建入口可传 --if-needed；版本一致时不读取大体积逻辑分片。
if (process.argv.includes('--if-needed')) {
  try {
    const existing = read('metadata/dialogue-worlds.json');
    const revision = read('manifest.json').revision;
    if (
      revision &&
      existing.version === version &&
      existing.revision === revision &&
      existing.worlds &&
      typeof existing.worlds === 'object'
    ) {
      console.log('Dialogue world index is current; skipping rebuild.');
      process.exit(0);
    }
  } catch {
    // 索引缺失或损坏时继续完整重建。
  }
}
const index = read('common/logic/index.json');
const missions = new Map(
  read('common/system/MainMission.json').map((r) => [String(r.MainMissionID), r.WorldID]),
);
const planes = new Map(
  read('common/stages/MazePlane.json').map((r) => [String(r.PlaneID), r.WorldID]),
);
const validTalks = new Set(
  read('common/stories/TalkSentenceConfig.json').map((r) => r.TalkSentenceID),
);
const validWorlds = new Set(read('common/stages/WorldDataConfig.json').map((r) => r.ID));
validWorlds.add('divergent-universe');
const nodes = new Map();
// 演出表提供文件路径和位面编号，是位置归属的直接来源。
const performancePaths = new Map();
const performanceWorlds = new Map();
for (const type of ['A', 'C', 'D', 'DS', 'E']) {
  for (const row of read(`common/system/Performance${type}.json`)) {
    performancePaths.set(`${type}:${row.PerformanceID}`, row.PerformancePath);
    const world = planes.get(String(row.PlaneID));
    if (world && row.PerformancePath) {
      const set = performanceWorlds.get(row.PerformancePath) ?? new Set();
      set.add(world);
      performanceWorlds.set(row.PerformancePath, set);
    }
  }
}
const talkKeys = new Set();
function walk(value, fn, key = '') {
  if (Array.isArray(value)) value.forEach((v) => walk(v, fn, key));
  else if (value && typeof value === 'object')
    Object.entries(value).forEach(([k, v]) => walk(v, fn, k));
  else fn(key, value);
}
function performanceRefs(value, refs) {
  if (Array.isArray(value)) value.forEach((v) => performanceRefs(v, refs));
  else if (value && typeof value === 'object') {
    const target = performancePaths.get(`${value.PerformanceType}:${value.PerformanceID}`);
    if (target) refs.add(target);
    Object.values(value).forEach((v) => performanceRefs(v, refs));
  }
}
for (const file of new Set(Object.values(index))) {
  for (const [name, data] of Object.entries(read(file))) {
    const node = { worlds: new Set(), talks: new Set(), refs: new Set() };
    // 仅使用明确的任务/位面目录，以及脚本中的具名关联字段；不推断对白编号。
    const mission = name.match(/^Story\/(?:Discussion\/)?Mission\/(\d+)\//);
    const levelMission = name.match(/^Config\/Level\/Mission\/(\d+)\//);
    if (mission && missions.get(mission[1])) node.worlds.add(missions.get(mission[1]));
    if (levelMission && missions.get(levelMission[1]))
      node.worlds.add(missions.get(levelMission[1]));
    for (const world of performanceWorlds.get(name) ?? []) node.worlds.add(world);
    // RogueEventTourn 是差分宇宙专用事件目录；普通 Rogue 和 RogueEventMagic 不属于此分类。
    if (
      /^Config\/Level\/Rogue\/RogueDialogue\/RogueEventTourn\d+\//.test(name) ||
      /^Config\/Level\/Maze\/MazeRogue\/RogueTourn\//.test(name) ||
      /^Config\/Level\/GroupTemplateGraph\/03_Rogue\/RogueTourn\d+\//.test(name)
    ) {
      node.worlds = new Set(['divergent-universe']);
    }
    const ownWorlds = new Set(node.worlds);
    performanceRefs(data, node.refs);
    walk(data, (key, value) => {
      if (/TalkSentence/.test(key)) talkKeys.add(key);
      // 脚本事件中的 TalkSentence_<ID> 是显式对白引用，并校验目标确实存在。
      if (
        typeof value === 'string' &&
        /^TalkSentence_\d+$/.test(value) &&
        validTalks.has(Number(value.slice(13)))
      )
        node.talks.add(Number(value.slice(13)));
      if (/^(TalkSentenceID|TalkSentenceId|SentenceID)$/.test(key) && typeof value === 'number')
        node.talks.add(value);
      if (key === 'WorldID' && validWorlds.has(value)) node.worlds.add(value);
      if (key === 'PlaneID' && planes.has(String(value)))
        node.worlds.add(planes.get(String(value)));
      if (key === 'MainMissionID' && missions.has(String(value)))
        node.worlds.add(missions.get(String(value)));
      if (typeof value === 'string' && index[value]) node.refs.add(value);
    });
    // 自身任务目录/演出位面优先；脚本中的传送目标和其他任务条件不能改变其自身归属。
    if (ownWorlds.size) node.worlds = ownWorlds;
    // 某些测试位面没有有效世界，不能据此阻止来自已知任务的关联。
    for (const world of node.worlds) if (!validWorlds.has(world)) node.worlds.delete(world);
    node.anchored = node.worlds.size > 0;
    if (node.talks.size || node.refs.size || node.worlds.size) nodes.set(name, node);
  }
}
// 仅向缺少自身位置依据的脚本传播，防止共享工具脚本把调用者归属写进另一任务。
let changed = true;
while (changed) {
  changed = false;
  for (const node of nodes.values())
    for (const ref of node.refs) {
      const target = nodes.get(ref);
      if (!target || target.anchored) continue;
      for (const world of node.worlds)
        if (!target.worlds.has(world)) {
          target.worlds.add(world);
          changed = true;
        }
    }
}
const worlds = {};
for (const node of nodes.values())
  for (const id of node.talks) {
    if (!validTalks.has(id)) continue;
    const set = (worlds[id] ??= []);
    for (const w of node.worlds) if (validWorlds.has(w) && !set.includes(w)) set.push(w);
  }
for (const id of Object.keys(worlds))
  if (!worlds[id].length) delete worlds[id];
  else worlds[id].sort((a, b) => String(a).localeCompare(String(b)));
const output = {
  version,
  revision: read('manifest.json').revision,
  method:
    'Own mission directory and Performance A/C/D/DS/E location take precedence over incidental fields and callers. RogueEventTourn1/2/3 and RogueTourn maze/template namespaces identify Divergent Universe. Otherwise named WorldID/PlaneID/MainMissionID fields; explicit script and typed PerformanceID references propagate only to unanchored scripts. Exact TalkSentence_<ID> references validated against source rows; sentence-level unions retain genuine shared use.',
  groups: [{ id: 'divergent-universe', name: '差分宇宙' }],
  worlds,
};
fs.mkdirSync(path.join(root, 'metadata'), { recursive: true });
fs.writeFileSync(path.join(root, 'metadata/dialogue-worlds.json'), JSON.stringify(output));
console.log({
  linked: Object.keys(worlds).length,
  talkKeys: [...talkKeys],
  bytes: JSON.stringify(output).length,
});
