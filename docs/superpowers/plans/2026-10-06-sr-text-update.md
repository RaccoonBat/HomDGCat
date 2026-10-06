# 崩铁文本增量更新工具 — 实现说明

日期：2026-10-06
设计文档：[../specs/2026-10-06-sr-text-update-design.md](../specs/2026-10-06-sr-text-update-design.md)

## 目标

游戏版本从 3.7 更新到 4.6 后，把新版本文本拉下来，**追加**到 `site/TextMap/` 现有数据后面，并提供一个可浏览的增量页面。

## 用法

```bash
python tools/sr_update.py fetch     # 下载官方源文件到 tools/cache/（需梯子，约 150 MB）
python tools/sr_update.py status    # 查看现状，不写任何文件
python tools/sr_update.py build     # 把差集追加进 site/TextMap/
python tools/sr_update.py report    # 生成 site/sr/textupd/ 展示页
python main.py serve                # 然后访问 http://localhost:9000/sr/textupd/
```

只有 `fetch` 需要联网。`build` / `report` / `status` 读缓存即可离线运行。

## 数据源

[`DimbreathBot/TurnBasedGameData`](https://github.com/DimbreathBot/TurnBasedGameData)（Dimbreath/StarRailData 的继任者）。

| 源文件 | 缓存文件名 | 大小 | 用途 |
|---|---|---|---|
| `TextMap/TextMapCHS.json` | `TextMapCHS.json` | 52 MB | 中文主文本表 |
| `TextMap/TextMapEN.json` | `TextMapEN.json` | 58 MB | 英文主文本表 |
| `ExcelOutput/TalkSentenceConfig.json` | `TalkSentenceConfig.json` | 42 MB | 剧情对话索引 |

该仓库只有 `main` 一个分支，数据按版本就地更新，所以**按 commit SHA 固定下载**而不是按分支名 —— 这样同一次运行取到的是同一个版本快照，可复现、可校验。版本号从 commit message（`OSPRODWin4.6.0_...`）里正则提取。

## 目标文件的格式契约

实测得出，必须严格遵守：

**`site/TextMap/SR.json`**（93 MB，LFS）— `[{H, C, E}, ...]`，374,103 条

- **CRLF 行尾 + 4 空格缩进**，结尾是 `\r\n    }\r\n]`
- 字符串**不做 `\uXXXX` 转义**（裸 UTF-8），等价于 `json.dumps(..., ensure_ascii=False)`
- 字段顺序固定 `H, C, E`
- 不按 `H` 排序，是插入顺序，最新内容已在尾部
- 四种形态并存：`{H,C,E}` 370,974 条 / `{H}` 2,949 条 / `{H,C}` 178 条 / `{H,E}` 2 条 —— 空字符串视为缺失

**`site/TextMap/SR_Talk_CH.json` / `SR_Talk_EN.json`**（31 MB / 33 MB，LFS）— `[{I, S, T}, ...]`，各 196,154 条

- **按 `I` 升序排列**，中英两文件 ID 顺序完全一致
- `S`（说话人）**允许为空字符串**，中英各 55,227 条 —— 这是正常数据，不得过滤

**`site/TextMap/SR_Book_*.js`**（2.2 MB，非 LFS）— 本期未做，见下

## 模块职责

```
tools/
  sr_update.py      CLI 四子命令
  srtext/
    source.py       下载 · 缓存 · sha256 · schema 探测
    hashes.py       xxh32 实现 + H 分配器
    convert.py      文本层 + 对话层转换
    append.py       风格探测 · 条目渲染 · 原子追加
    report.py       运行台账 + 增量数据
  cache/            下载缓存 · h_map · ledger · 备份（gitignore）
site/sr/textupd/
  index.html        展示页
  viewer.js         展示页逻辑（手写）
  added.json        增量数据（report 生成）
```

`source.py` 是唯一碰网络的模块。`append.py` 是唯一改 `site/TextMap/` 的模块。

## 关键设计决策

### 1. 追加不改动已有字节

核心不变量：**追加不得改动已有内容的任何一个字节**。

因此禁止「解析 + 重新序列化」整份文件 —— 那会重写全部字节，破坏 git diff 可读性，也让 LFS 每次都产生全新对象。做法是探测文件的行尾风格与缩进，定位末尾的 `]` 后原地插入 `,\r\n    {...}`，写临时文件再 `os.replace` 原子换入。

写入前备份到 `tools/cache/backup/<SHA>/`。若文件内容是 LFS 指针（以 `version https://git-lfs` 开头），直接报错提示 `git lfs pull`，避免把指针当 JSON 解析后写坏。

### 2. `H` 字段由本地生成

`SR.json` 的 `H` 是 32 位整数，是 HomDGCat 自有的内部 ID。**实测无法从官方数据复现**：

- 测过 xxh32 / xxh64 / murmur3 / FNV-1a / CRC32 / MD5 / SHA1 前四字节（大小端），输入涵盖中英文原文、64 位 key 的十进制字符串与字节序表示，编码涵盖 UTF-8 / UTF-16LE / UTF-16BE / GBK，32 位归约涵盖取高低 32 位、异或、多种取模 —— 全部无匹配。
- 三条结构性证据：374,103 个 `H` 两两不重复；同一句中文在不同条目里对应不同 `H`；任何 `f(key64)` 都无解。
- 用途佐证：`text_sr.js` 里 `H` 只用于 hash 搜索与永久链接参数，不参与任何跨文件关联。

所以：已有条目的 `H` 原样不动；新条目 `H = xxh32(str(hash64))`，冲突时递增探测，分配表持久化到 `tools/cache/h_map.json` 保证重跑、乱序、增量追加都不会改变已有分配。以 `hash64` 而非文本作输入，是为了让 `H` 与文本内容解耦 —— 同一官方条目文本微调时 `H` 不变。

**代价**：新增条目的 hash 搜索与官方站点对不上。已确认接受。

### 3. 差集判定键

`SR.json` 不存官方 64 位 hash，无法按 key 比对，所以用 **`(C, E)` 原始字符串对**作身份键。

**不做 trim 或规范化** —— 规范化有把真实新条目误判为已存在而静默吞掉的风险，宁可留少量近似重复，也不接受漏条目。

对话层用 `I` 作判定键，现有文件已按 `I` 升序，新增直接追加保持有序。

### 4. schema 探测（重要）

`TalkSentenceConfig.json` 的字段结构**从未实测过** —— 设计阶段这个 42 MB 文件在当时的网络环境下下不动。所以 `probe_talk()` 在运行时发现结构：

- `text_field`（必需）：候选字段必须在**所有样本**中都出现 —— 选错正文引用会写坏数据，必须严格。
- `name_field`（可选）：用**并集**挑选 —— 说话人可为空（现有数据 28% 是空说话人），用交集会让一个无说话人的样本把它整体忽略掉，导致所有新对话的说话人变成空字符串。

对不上时**打印实际字段名与样本条目后报错退出**，绝不静默产出错数据。这是本工具最重要的一条防线。

### 5. 下载完整性

`fetch_sources` 最初只是把刚下载的内容哈希一遍记进 manifest —— 那只能保证跨次运行一致，**不能保证下载本身完整**：一个被代理截断的响应会被写盘、记为有效，然后永远被当作「已缓存」跳过。

现在 `download()` 校验 `Content-Length` 与实际字节数，不符则删除半成品并重试。同时改成**流式下载 + 进度输出** —— 三个文件合计 150 MB，整体读进内存既不必要，也让用户在整个下载期间看不到任何反馈。

其他网络处理：4xx 快速失败不重试（里面特别区分 GitHub 未认证 API 的 60 次/小时限额并给出提示），5xx 指数退避重试；`HTTPException`、非 JSON 响应、非预期的 API 结构都有明确报错。

## 验证方式

没有单元测试。验证靠这三步：

1. **`status`** —— 只读，报告现有文件大小、缓存版本、已记录的增量。跑任何写操作前先看这个。
2. **`build` 的输出** —— 打印 schema 探测结果和新增条数。**先看条数是否合理**（文本新增应在数万量级；若出现几十万条说明差集判定有问题，立刻停止）。
3. **字节级不变量** —— `build` 后检查原有内容未被改动：

```bash
python -c "
import json
for name in ('SR.json','SR_Talk_CH.json','SR_Talk_EN.json'):
    d = json.load(open('site/TextMap/'+name, encoding='utf-8'))
    print(name, len(d))
"
```

追加逻辑本身也在写入前断言 `new_bytes.startswith(body)`，不满足直接抛 `AssertionError`，不会写坏文件。

回滚：

```bash
git checkout -- site/TextMap/
```

## 未完成项

### 书页层（`SR_Book_*.js`）

**未实现。** 已验证书页正文确实存在于 TextMap（`<br>` 是 `\n` 换的），书名与系列名也在，但**没找到「哪本书对应哪些正文 hash」的那份配置**：

- `ExcelOutput/ReadableConfig.json`、`ReadableTextConfig.json`、`BookContentConfig.json` 均 404
- `BookSeriesConfig.json`（已下载验证，828 条）字段为 `BookSeriesID / BookSeries / BookSeriesComments / BookSeriesNum / BookSeriesWorld / IsShowInBookshelf`，其中的 hash 是系列名与系列点评，**不含正文**

留待后续。

### `site/data/{CH,EN}/*.js` 衍生数据

24 类 171 个文件（角色技能、成就、怪物等）。这些是 HomDGCat 自己加工的衍生格式，官方仓库里没有现成对应，需逐类逆向。属于独立项目，不在本工具范围内。

### 多语种

只处理中英。官方仓库还有 CHT / DE / ES / FR / ID / JP / KR / PT / RU / TH / VI，现有数据也只有中英，保持一致。

## 已知限制

1. **版本号只依据 `TextMapCHS.json` 的提交确定。** 若某次发布只更新了对话索引而未动主文本表，那个更新不会被检测到，会静默停留在旧版本。（加 3 次 API 调用可以解决，但会消耗 GitHub 的 60 次/小时限额，权衡后未做。）

2. **`probe_talk` 迄今没在真实数据上跑过。** 关于 `TalkSentenceConfig` 结构的一切都是推断。第一次真实 `fetch` + `build` 才是真正的检验 —— 好消息是如果字段名与假设不符，它会报错并打印真实字段名，而不是写坏数据。

3. **LFS 配额。** `SR.json` 追加后大概率突破 100 MB。它是 LFS 文件所以 GitHub 不拦（LFS 单文件上限 2 GB），但**每次修改都会上传一个全新的约 100 MB 对象**，而免费额度是 1 GB 存储 / 1 GB 月流量。避免反复提交。
