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

3. 如有修改，请不要直接提交！！github 限制大于100Mb的文件上传，请使用 LFS！！！

4. 请使用 LFS 存储大文件，本地安装 github LFS 后，运行

```bash

git lfs install

git lfs track "site/TextMap/*.json"

```

5. 上述命令一定要在提交之前执行，告诉git lfs 要跟踪的文件，否则必然提交不成功

6. 后续为区分原和铁，我会将两者的文件夹逐步切分，原作者混杂在一起的数据也会整理重新上传

## 文本更新工具

游戏版本更新后，用 `tools/sr_update.py` 把新版本文本追加到现有数据中。

```bash
# 1. 拉取官方源文件到 tools/cache/（需要梯子，约 150 MB）
python tools/sr_update.py fetch

# 2. 查看现状与已记录的增量
python tools/sr_update.py status

# 3. 把差集追加进 site/TextMap/
python tools/sr_update.py build

# 4. 生成增量展示页
python tools/sr_update.py report
```

展示页地址：`http://localhost:9000/sr/textupd/`（需先 `python main.py serve`）

### 数据来源

[`DimbreathBot/TurnBasedGameData`](https://github.com/DimbreathBot/TurnBasedGameData)，按 commit SHA 固定下载，保证同一版本可复现：

| 源文件 | 用途 |
|---|---|
| `TextMap/TextMapCHS.json` | 中文主文本表 |
| `TextMap/TextMapEN.json` | 英文主文本表 |
| `ExcelOutput/TalkSentenceConfig.json` | 剧情对话索引 |

### 注意事项

- **`build` 只追加，不改动任何已有内容**，重复运行不会产生二次写入（差集为空时一个字节都不写）。
- 写入前会在 `tools/cache/backup/<SHA>/` 留备份。不满意可回滚：
  `git checkout -- site/TextMap/`
- **`H` 字段由本地生成**，与 homdgcat.wiki 官方站点的 hash 搜索不一致。官方 `H` 是 32 位的内部 ID，实测无法从官方 64 位 xxhash 复现，所以新条目按 `xxh32(hash64)` 生成并记录在 `tools/cache/h_map.json`，保证可复现。
- `site/TextMap/*.json` 由 LFS 管理，提交前确认已执行 `git lfs install`。
- ⚠️ **这三个文件每次修改都会往 LFS 上传约 100 MB 的新对象。** GitHub 免费额度是 1 GB 存储 / 1 GB 月流量，请避免反复提交。
- `TalkSentenceConfig.json` 的字段结构是运行时探测的。如果源文件格式变了，`build` 会报错并打印实际字段名，而不会写入错数据。
- 已知限制：版本号只依据 `TextMapCHS.json` 的提交确定。若某次发布只更新了对话索引而未动主文本表，那个更新不会被检测到。

## 许可

本工具仅用于 homdgcat.wiki 的个人离线备份。内容版权归 MHY/妮可少女 所有。
