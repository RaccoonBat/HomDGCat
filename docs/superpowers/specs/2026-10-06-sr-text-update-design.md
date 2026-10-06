# 崩铁文本增量更新脚本 — 设计文档

日期：2026-10-06
状态：待评审

## 1. 背景

本仓库是 homdgcat.wiki 的离线镜像，其中 `site/TextMap/` 收录了《崩坏：星穹铁道》的全部文本。镜像下载于 2026 年 5–6 月，内容停留在 3.7 版本附近；游戏正式版本已到 4.6。

目标：新增一个脚本，运行后按现有数据格式拉取最新版本文本，**追加在现有内容之后**，并提供一个可浏览的展示页面。

## 2. 已查明的事实

以下均为本次探索中实测确认，不是推断：

### 2.1 数据源

官方数据仓库：[`DimbreathBot/TurnBasedGameData`](https://github.com/DimbreathBot/TurnBasedGameData)（Dimbreath/StarRailData 的继任者）。

- 只有 `main` 一个分支，数据按版本就地更新。
- `TextMap/TextMapCHS.json`（52 MB）、`TextMap/TextMapEN.json`（58.5 MB），最后更新 2026-09-27，commit message 为 `OSPRODWin4.6.0_D16688351_A16684237_L16658846`。
- 该 commit message 的格式可稳定提取版本号：正则 `OSPRODWin(\d+\.\d+\.\d+)`。
- `TextMap/TextMapCHS.json` 的提交历史逐版本可查（4.0.0 → 4.6.0），共 31 次提交。
- 官方 TextMap 的 key 是 **64 位 xxhash**，例如 `"12518437936274253375": "拍摄「巨树」"`。

### 2.2 现有数据的格式契约

**`site/TextMap/SR.json`**（93,514,827 字节，LFS）

- 顶层是数组，374,103 个元素。
- 元素形态与数量：
  - `{H, C, E}` — 370,974 条
  - `{H}` — 2,949 条（无文本）
  - `{C, H}` — 178 条（无英文）
  - `{E, H}` — 2 条（无中文）
- 字段顺序固定为 `H, C, E`。
- 不按 `H` 排序，是插入顺序；最新内容已在尾部聚集（末尾若干条 `H` 在 4267008xxx 区间）。

**`site/TextMap/SR_Talk_CH.json` / `SR_Talk_EN.json`**（30,771,650 / 32,917,151 字节，LFS）

- 顶层是数组，各 196,154 个元素，格式 `{I, S, T}`（条目 ID、说话人、正文）。
- **按 `I` 升序排列**，中英两文件的 ID 集合与顺序完全一致。
- `I` 取值范围 30,403,551 – 999,999,999，无重复。
- `S` 允许为空字符串（中英各 55,227 条），这是正常数据，不得过滤。
- `T` 为空的情况：中文 0 条，英文 62 条。

**`site/TextMap/SR_Book_CH.js` / `SR_Book_EN.js`**（2,196,090 / 2,655,888 字节，非 LFS）

- 形如 `var _series = [...]` + `var _books = [...]`，`_books` 元素为 `{Name, Desc, World, Books:[{Desc}], Hidden}`。

### 2.3 文件编码风格

三个 `.json` 文件与 `SR_Book_*.js` 均为 **CRLF 行尾 + 4 空格缩进**：

```
head: b'[\r\n    {\r\n        "H": 4073591624,\r\n        "C": "拍摄「巨树」"'
tail: b'...souls."\r\n    }\r\n]'
```

`.gitattributes` 对 `site/TextMap/*.json` 声明了 `-text`，意味着 git 不做行尾转换，CRLF 会原样保留。追加写入必须显式还原这一风格。

### 2.4 LFS 状态

`git lfs ls-files` 确认以下三个文件由 LFS 跟踪：

```
cf3a634a95 * site/TextMap/SR.json
8bc6051594 * site/TextMap/SR_Talk_CH.json
690e65fcd5 * site/TextMap/SR_Talk_EN.json
```

`site/TextMap/SR_Book_CH.js` 的 filter 是 `unspecified`，不走 LFS，2.2 MB 可正常提交。

仓库根目录**没有 `.gitignore`**。

### 2.5 `H` 字段不可复现

`SR.json` 的 `H` 是 32 位整数，官方 TextMap 的 key 是 64 位。经实测，`H` **不是**任何常见哈希从官方数据推导出来的：

- 测过的组合：xxh32 / xxh64 / murmur3_32 / FNV-1a / CRC32 / MD5 / SHA1 前四字节（大小端）
- 测过的输入：中文原文、英文原文、64 位 key 的十进制字符串、64 位 key 的字节序表示
- 测过的编码：UTF-8、UTF-16LE、UTF-16BE、GBK
- 测过的 32 位归约：取低 32 位、取高 32 位、高低异或、按多个模数取余
- 全部无匹配。

三条结构性证据表明 `H` 是 HomDGCat 自有的内部 ID：

1. 全部 374,103 个 `H` 值两两不重复。
2. 同一句中文在不同条目里对应不同的 `H`。
3. 任何 `f(key64)` 都无解。

用途佐证：`site/javascripts/text_sr.js` 中 `H` 只出现在 `p: d.H.toString()`（永久链接参数）和 hash 搜索分支，不参与任何跨文件的关联。站点的衍生数据文件（如 `site/data/CH/Avatar/1001.js`）直接用游戏 ID 作键、正文内联，不引用 `H`。

### 2.6 书页正文位于 TextMap 内

`SR_Book_CH.js` 里 `{Img#1}<i>回忆最终如何呈现…` 这类正文在 `SR.json` 的 `C` 字段中存在，差别只是 `\n` 被换成了 `<br>`。书名（如「梦的谢幕礼」）同样能在 TextMap 中命中。

但**未能定位**「哪本书对应哪些正文 hash」的配置：`ExcelOutput/ReadableConfig.json`、`ReadableTextConfig.json`、`BookContentConfig.json` 均返回 404；`BookSeriesConfig.json`（已下载验证，828 条）只含 `BookSeriesID / BookSeries / BookSeriesComments / BookSeriesNum / BookSeriesWorld / IsShowInBookshelf`，其中的 hash 是系列名与系列点评，不含正文。

## 3. 范围

### 本期（v1）

- `site/TextMap/SR.json` — 主文本表增量
- `site/TextMap/SR_Talk_CH.json`、`SR_Talk_EN.json` — 剧情对话增量
- 新增独立展示页 `site/sr/textupd/`
- 新增脚本 `tools/sr_update.py` + `tools/srtext/` 包

### 本期不做

- `site/data/{CH,EN}/*.js` 衍生数据（24 类 171 个文件）——二期单独开 spec
- 日文 / 韩文 / 其他语种
- `H` 与 HomDGCat 官方站点对齐（不可复现，已接受）
- 书页层——按下述方式处理

### 书页层的处理方式

v1 不把书页层列为交付项。实现阶段只安排一次不超过 30 分钟的探测（试 `Config/` 目录、试若干候选文件名、反向从 TextMap 正文 hash 查引用它的配置），找到配置源就顺带实现，找不到就明确记为二期，**不阻塞主体验收**。

## 4. 架构

```
tools/
  sr_update.py          # CLI 入口：fetch / build / report / status
  srtext/
    __init__.py
    source.py           # 下载 · 缓存 · sha256 校验 · schema 探测
    hashes.py           # xxh32 实现 + H 分配器（持久化）
    convert.py          # 转换器：textmap / talk
    append.py           # 差集 · 文本级原子追加
    report.py           # 增量 JSON + 展示页生成
  cache/                # 下载缓存 · h_map · ledger · 备份（gitignore）
  tests/                # 单元测试与集成测试
```

仓库根目录当前没有 `.gitignore`，需新建，内容至少包含 `tools/cache/`——否则 100 MB 级的下载缓存会被误提交。`tools/cache/` 下的 `h_map.json` 与 `ledger.json` 虽是生成物，但属于运行状态，同样不进版本库。

拆分为多个模块而非塞进单文件，理由：这五件事有各自独立的失败模式。下载会因网络反复重试（本次探索中 52 MB 与 41.6 MB 文件在本环境全部超时）；转换规则需要对照真实数据逐条调试；追加写要保证字节级不变量。混在一起会导致调一条转换规则就要付一次下载代价。

`tools/sr_update.py` 的风格对齐现有 `main.py`：`argparse` 子命令 + 中英双语 i18n 字典。

## 5. 数据流

```
fetch  → cache/{TextMapCHS,TextMapEN,TalkSentenceConfig}.json + manifest.json
build  → 读缓存 + 读现有 site/TextMap/* → 算差集 → 原子追加 → ledger.json
report → 读 ledger → site/sr/textupd/{index.html, added.json} + report.md
status → 只读，报告覆盖率与差异，不写任何文件
```

`build` 与 `report` 完全依赖缓存，可在无网络环境下反复运行。只有 `fetch` 需要联网。

## 6. 模块职责

### `source.py`

**下载锚点**：先经 GitHub API 查询 `TextMapCHS.json` 的最新 commit，取得 SHA 与 message，用正则 `OSPRODWin(\d+\.\d+\.\d+)` 提取版本号。随后**按该 SHA 固定下载**而非按 `main`，保证同一版本可复现、可校验。

**下载清单**：

| 文件 | 用途 |
|---|---|
| `TextMap/TextMapCHS.json` | 中文主文本表 |
| `TextMap/TextMapEN.json` | 英文主文本表 |
| `ExcelOutput/TalkSentenceConfig.json` | 对话条目 |

下载后校验 sha256 并写入 `manifest.json`（记录 SHA、版本号、抓取时间、各文件 sha256 与字节数）。已存在且校验通过的文件不重复下载。

续传：先尝试 HTTP Range。本次探索中 `raw.githubusercontent.com` 对 Range 请求返回空响应，因此 Range 不可用时降级为整体重下，并复用已成功下载的其他文件，避免一次网络抖动导致全部重来。

**schema 探测**：每个文件解析后先验证预期结构。`TalkSentenceConfig.json` 的字段结构属未实测项（见第 2 节），探测失败时**打印实际解析出的 keys 与前若干条样本，然后报错退出**，绝不静默继续。

### `hashes.py`

纯 Python 的 xxh32 实现，零第三方依赖。已用标准向量验证：`"" → 0x02CC5D05`、`"abc" → 0x32D153FF`、`"a" → 0x550D7456`。

`H` 分配器：

- 启动时读入现有 `SR.json` 的全部 `H` 值，建立占用集合。
- 新条目的基准值 `base = xxh32(str(hash64))`。
- 若 `base` 已被占用，依次探测 `xxh32(str(hash64) + ":" + str(i))`，`i` 从 1 递增，取第一个空位。
- 分配结果立即持久化到 `cache/h_map.json`（`hash64 → H`）。

以 `hash64` 而非文本作为输入，是为了让 `H` 与文本内容解耦：同一官方条目在不同版本间若文本微调，`H` 保持不变。持久化分配表保证重跑、乱序、增量追加都不会改变已有分配。

### `convert.py`

**文本层**：遍历 `union(CHS.keys(), EN.keys())`。空字符串视为缺失（还原现有 `{H}` 形态）。输出形态与现有数据一一对应：

| 条件 | 输出 |
|---|---|
| C、E 均非空 | `{H, C, E}` |
| 仅 C 非空 | `{H, C}` |
| 仅 E 非空 | `{H, E}` |
| 均空 | `{H}` |

字段顺序固定 `H, C, E`。

**对话层**：从 `TalkSentenceConfig` 取出 `条目 ID → 说话人 hash / 正文 hash`，再用 TextMapCHS、TextMapEN 解析出 `S` 与 `T`，产出 `{I, S, T}`。`S` 为空字符串是合法值，照常输出。

### `append.py`

核心不变量：**追加不得改动已有内容的任何一个字节**。

**差集的判定键**：`SR.json` 里没有官方 64 位 hash，无法按 key 比对，因此以 `(C, E)` 文本对作为身份键——先读出现有全部条目的 `(C, E)` 集合，官方条目若其 `(C, E)` 已在集合中则跳过。比对使用**原始字符串，不做 trim 或规范化**：规范化存在把真实新条目误判为已存在而静默吞掉的风险，宁可保留少量近似重复条目，也不接受漏条目。仅有 `H` 的 2,949 条无文本条目不参与比对，它们不产生新内容。

对话层的判定键是 `I`（条目 ID），现有文件已按 `I` 升序排列，新增条目直接追加在尾部即可保持有序。

实现方式：

1. 探测目标文件的行尾风格（CRLF / LF）与缩进宽度，不硬编码。
2. 定位末尾的 `]`，删除它，插入 `,\r\n` + 新条目序列化结果，再补回 `\r\n]`。
3. 写临时文件后 `os.replace` 原子换入。
4. 写前把原文件复制到 `cache/backup/<run_id>/`。

**LFS 指针防护**：若文件内容以 `version https://git-lfs` 开头，说明 LFS 未拉取，直接报错并提示执行 `git lfs pull`，避免把指针当 JSON 解析后写坏。

不使用「解析 + 重新序列化」的方式，因为那会重写整个文件的字节，破坏 git diff 的可读性，也会让 LFS 每次都产生全新对象而无法复用。

### `report.py`

生成独立页面 `site/sr/textupd/`：

- `index.html` — 复用站点现有 `stylesheets/style.css`、`text_sr.css` 与 `plugins/jquery.js`、`plugins/thin.js`，保持观感一致。
- `added.json` — 只含本次新增条目（文本、对话），附带类型与来源版本标签。

页面只加载增量 JSON（MB 级），**不加载 94 MB 的 `SR.json`**。功能：中英双语搜索、按类型筛选、按来源版本筛选、分页浏览。

同时输出摘要到 `tools/cache/report.md` 并在控制台同步打印：首次收录版本、本次增量版本、各层新增条数、与现有内容的覆盖对比。放在缓存目录是为了不污染仓库内容，需要归档时再手动复制。

## 7. 幂等与版本归属

`cache/ledger.json` 按 run 记录：版本号、commit SHA、抓取时间、各层新增条数、新增条目的 ID/哈希列表。

- 重跑时若差集为空，**不写任何站点文件**，只刷新报告。
- 版本号来自官方 commit message，因此页面上可标注「4.6.0 新增」。多次运行会累积成多版本标签。

## 8. 错误处理

| 场景 | 处理 |
|---|---|
| 网络失败 | 指数退避重试；失败后回退到已有缓存并明确提示数据可能不是最新 |
| 缓存文件 sha256 不符 | 删除并重下 |
| schema 不符预期 | 打印实际结构与样本后报错退出，不产出数据 |
| 文件是 LFS 指针 | 报错并提示 `git lfs pull` |
| 新增量与现有内容比例异常（默认阈值 30%） | 中止并要求 `--yes` 确认后才写入 |
| 无网络 | `build` / `report` / `status` 可用缓存离线运行；`fetch` 明确报错 |

## 9. 验证方式

不写单元测试。这是个人使用的离线工具，验证靠下面三步：

**1. `status` 只读检查**

报告现有文件大小、缓存版本号与 SHA、已记录的增量。任何写操作之前先跑这个。

**2. `build` 的输出与条数合理性**

`build` 打印 schema 探测结果和新增条数。文本新增应在数万量级；若出现几十万条，说明差集判定有问题，立即停止并回滚。

**3. 字节级不变量自检**

`append.py` 在写盘前断言 `new_bytes.startswith(body)` —— 即追加后原有内容逐字节不变。不满足直接抛 `AssertionError`，不会写坏文件。写入前另有备份到 `tools/cache/backup/<SHA>/`。

回滚：`git checkout -- site/TextMap/`

## 10. 风险与未决项

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| 1 | `TalkSentenceConfig.json` 字段结构未实测（本环境下载超时） | 转换器可能整体不可用 | 运行时 schema 探测，不符即报错并打印真实结构 |
| 2 | `SR.json` 追加后突破 100 MB | LFS 允许单文件至 2 GB，GitHub 不拦；但免费额度为 1 GB 存储 / 1 GB 月流量，而每次修改都会上传一个全新约 100 MB 的对象 | 先用 `status` / `report` 看差异，确认后再 `build`；文档中明确提示配额消耗 |
| 3 | 新增条目的 `H` 与 HomDGCat 官方站点不一致 | 站点 hash 搜索与永久链接对不上（已接受） | 分配表持久化，保证本地自洽且可复现 |
| 4 | 官方 TextMap 可能包含 HomDGCat 已过滤的内部/调试字符串 | 可能引入噪声条目 | `status` 报告按类别分布；比例异常时中止并要求确认 |
| 5 | 书页正文配置源未定位 | 书页层无法实现 | 限时探测，找不到则移入二期，不阻塞 |

## 11. 验收标准

1. `python tools/sr_update.py status` 能离线报告现有内容与 4.6 官方的差异，不写入任何文件。
2. `python tools/sr_update.py fetch` 能拉取三个源文件并落缓存，校验 sha256，记录版本号 4.6.0。
3. `python tools/sr_update.py build` 追加后，`site/TextMap/SR.json` 与两个 `SR_Talk_*.json` 的**原有字节前缀完全未变**，新增条目位于文件尾部。
4. 追加后三个文件仍是合法 JSON，且能被现有 `site/sr/search/index.html` 正常加载。
5. `python tools/sr_update.py report` 生成的 `site/sr/textupd/` 页面可浏览、可搜索、可筛选，且不加载 `SR.json`。
6. 重复执行 `build` 不产生任何写入（幂等）。
7. 在 LFS 未拉取的情况下运行 `build`，得到明确报错而非损坏文件。

## 12. 分期

- **v1（本 spec）**：`SR.json` + `SR_Talk_{CH,EN}.json` 增量，展示页，脚本与测试
- **v2**：书页层（若 v1 未探测到配置源）
- **v3**：`site/data/{CH,EN}/*.js` 衍生数据（24 类）
