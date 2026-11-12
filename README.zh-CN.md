# 星穹铁道资料站

使用 React Hooks、TypeScript、Ant Design 和 SCSS 构建的本地资料站。

[中文说明](README.zh-CN.md) · [English](README.en-US.md)

## 功能

- 角色、光锥：筛选、无限滚动、立绘及技能详情。
- 遗器：按隧洞遗器、位面饰品分类，查询套装效果及部位故事。
- 怪物：战斗变体、等级数值、弱点、抗性及技能。
- 阅读物：按世界分类，搜索标题和正文，列表直接展示完整正文。
- 对话：正文和说话者查询，世界及差分宇宙分类，在后台线程检索。
- 成就：按成就大类查询达成条件。
- 唱片：按世界浏览曲目介绍及获取方式。
- 深色主题和手机布局。

界面为简体中文；数据包保留中文、英文、日文和韩文文本。无法从源文件确认归属的对白单独列入“世界归属未知”；相邻对白编号不代表实际剧情顺序。

## 环境与启动

- Node.js 22.13+（22.x）或 24+，以及 npm。
- 日常浏览和前端开发不需要 Python。

在项目根目录执行：

```bash
npm ci
npm run dev
```

访问 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)。按 Ctrl+C 停止服务。资料从本地读取，浏览时不需要连接数据源仓库。

## 检查与构建

```bash
npm run check       # TypeScript、ESLint 和格式检查
npm run format      # 格式化前端与构建配置
npm run build       # 生成完整静态站点 dist/
npm run preview     # 预览构建结果，默认端口 4173
```

生产部署发布 dist/ 的内容，并将页面路由回退到 index.html。构建会复制本地游戏数据和图片，所需磁盘空间约为 site/ 大小加前端产物。

## 目录

```text
index.html                  # Vite 页面入口
src/                        # React 页面、组件、Hooks、服务、类型与 SCSS
build/site-assets.ts        # 开发静态资源服务和构建复制逻辑（源代码）
data-update/                # 独立的数据更新工具
  game_data.py              # Python 命令行入口
  gamedata/                 # 下载、构建、历史记录、校验及发布
  generate-dialogue-worlds.mjs   # 对白世界归属索引生成器
site/
  data/                     # 游戏 JSON、文本分片与元数据
  images/                   # 本地图片与固定版本的资源
    resources/              # 从独立图片仓库收集的素材
```

site/ 只保存资料与图片，不是前端源码目录。site/data/common/logic/ 是游戏本身的 Config、Stages、Story 等 JSON 数据分包，供剧情关联等功能使用。

## 数据来源

当前本地清单版本为 **4.7.0**，具体文件、数量和校验信息以 site/data/manifest.json 为准。

- 游戏配置与文本来自 DimbreathBot/TurnBasedGameData 的固定快照。
- 图片复用已收集的游戏素材；缺少的素材从 Mar-7th/StarRailRes 的固定提交收集，放在 images/resources/。
- 缺失的怪物、行迹及阅读物配图按原始 SpriteOutput 路径，从 umaichanuwu/StarRailTextures 的固定快照补充；该贴图库目前为 4.3，仅用于补齐匹配素材，不改变游戏数据版本。
- metadata/historical-sources.json 记录历史补录，包括 3.8.0 的教程分组 9333、9334。
- metadata/versions.json 和 legacy-text-ids.json 保留版本标注及历史文本编号映射。
- metadata/dialogue-worlds.json 是根据本地游戏脚本生成的世界／玩法归属索引，不是另一套游戏数据。

图片、历史记录和派生索引各有用途，不能按当前页面是否直接引用而删除整个目录。

## 更新数据

更新工具集中在 data-update/。除了 Node.js，还需要 **Python 3.10+** 和 **Git**；Python 部分仅使用标准库。获取远程版本及历史记录时需要联网。

目标版本、数据提交和图片提交配置在 data-update/gamedata/source.py。运行更新前确认这些固定版本设置；更新命令使用配置的提交，不会自动跟随远程仓库的最新提交。

```bash
npm run data:update       # 下载并校验配置的完整快照，再发布到 site/
npm run data:validate     # 校验现有资料，不下载数据
npm run data:dialogues    # 手动重建对白归属索引
```

也可以直接运行：

```bash
python -B data-update/game_data.py update
python -B data-update/game_data.py validate --collection site/data
python -B data-update/game_data.py --help
```

更新在临时目录构建，校验通过后替换资料目录；会保留必要历史记录并补齐图片。npm run dev 和 npm run build 会检查对白索引，索引有效时直接复用，过期时在本地重新生成。

## 内容版权

游戏内容及图片的权利归各自权利人所有。
