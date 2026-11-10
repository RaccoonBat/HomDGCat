> Pages now use a shared, locally bundled Vue entry (no npm installation). Keep using `python main.py serve` locally. For static hosting, run `python tools/site_pages.py export --output dist` and publish dist.

# HomDGCat Wiki Mirror

[homdgcat.wiki](https://homdgcat.wiki) 的完整离线镜像，涵盖崩坏：星穹铁道的角色、光锥、遗器等数据。

## 内容

- [中文文档](README.zh-CN.md) | [English](README.en-US.md)

## Quick Start

### 本地开发流程

1. 请使用稳定的梯子

2. 将仓库克隆至本地后，可以直接运行以下命令, 启动本地服务器，即可看见本地站点
   
```bash

python main.py serve

```

3. 页面使用本地 Vue 运行时，不需要安装 Node 或 npm 依赖。

## 数据更新

网站使用统一的 4.6 完整合集：公共配置只保存一份，简中、英文、日文、韩文文本按语言分片，页面按需读取。正式数据位于 `site/data`；原始解包压缩包不进入仓库。

```bash
# 下载固定版本、转换全部配置与四语文本、校验、替换正式数据，再清理临时源文件
python -B tools/game_data.py update

# 校验本地正式合集
python -B tools/game_data.py validate --collection site/data

# 已有下载文件时复用；不会删除用户提供的压缩包
python -B tools/game_data.py update --archive /path/to/source.zip
```

全文、对话、阅读物直接从同一合集读取；独立的文本增量更新页和旧增量工具已移除。

数据源：[DimbreathBot/TurnBasedGameData](https://github.com/DimbreathBot/TurnBasedGameData)，固定提交 `74a7b96fba32f00cf495a5c00b0311bd02207aaf`。图片补充来源：[Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes)，固定提交 `dbe8cdfcfb0bf657b9fe1cf92d5537f118ccb487`。升级目标版本时需同时核对 `tools/gamedata/source.py` 和 `release.py` 中的版本及比较基线。

`manifest.json` 记录版本、文件索引和摘要，校验结果直接输出到终端。文本使用远程 64 位 ID 字符串，避免浏览器数值精度损失。

目前有 80 个怪物模板暂无图片，页面显示缺图提示。未来版本日程没有可靠源数据时不预测日期。云璃计算器、公式等站点原创内容保留，游戏数值以远程合集为准。

版本倒序使用 `metadata/versions.json`：实体按远程正式版本中首次可用的记录排序，文本按首次收录排序；3.1 的文本 ID 迁移通过稳定字段引用和中英双语内容匹配衔接。镜像历史未覆盖的早期文本标为“2.6及以前”，不会冒充当前版本新增。

## 脚本与资源维护

`site/javascripts/` 分为 `core/`（公共界面与文本）、`data/`（统一数据读取）和 `pages/`（页面），文件使用小写连字符命名。

```bash
# 核对图片的页面、样式、动态目录和游戏数据引用
python -B tools/site_assets.py audit
# 删除未引用图片并清理空图片目录
python -B tools/site_assets.py prune
```

## 许可

本工具仅用于 homdgcat.wiki 的个人离线备份。内容版权归 MHY/妮可少女 所有。
