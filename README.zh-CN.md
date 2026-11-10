# 星穹铁道资料站

提供角色、光锥、遗器、怪物、关卡、阅读物和文本查询，支持简体中文、英文、日文与韩文。

[中文说明](README.zh-CN.md) · [English](README.en-US.md)

## 环境要求

- Python 3.10 或更高版本。
- 支持 JavaScript 的现代浏览器。
- 前端运行库已包含在项目中，无需安装 Node.js 或 npm 依赖。

## 本地启动

在项目根目录运行：

```bash
python main.py serve
```

浏览器访问 [http://localhost:9000/](http://localhost:9000/)。按 `Ctrl+C` 停止服务。

自定义端口：

```bash
python main.py serve --port 3000
```

通过 HTTP 地址访问站点，不要直接双击 HTML 文件。

## 目录结构

```text
.
├── main.py                     # 本地 HTTP 服务入口
├── filelist.txt                # 静态资源路径清单
├── site/
│   ├── pages/
│   │   ├── index.html          # 共用页面入口
│   │   └── routes.json         # 路由及页面配置
│   ├── javascripts/
│   │   ├── app.js              # 应用入口
│   │   ├── core/               # 语言、公共界面与富文本处理
│   │   ├── data/               # 数据读取与关联处理
│   │   └── pages/              # 各页面逻辑
│   ├── data/
│   │   ├── common/             # 公共配置与逻辑数据
│   │   ├── CH/                 # 简体中文文本
│   │   ├── EN/                 # 英文文本
│   │   ├── JP/                 # 日文文本
│   │   ├── KR/                 # 韩文文本
│   │   └── metadata/           # 版本与文件索引
│   ├── stylesheets/            # 页面样式
│   ├── images/                 # 图片资源
│   ├── fonts/                  # 字体
│   ├── UI/                     # 公共界面素材
│   └── plugins/                # 本地前端运行库
└── tools/
    ├── game_data.py            # 数据更新与校验入口
    ├── gamedata/               # 数据处理模块
    ├── site_assets.py          # 图片引用检查与清理
    └── site_pages.py           # 页面路由与静态导出
```

## 静态部署

```bash
python -B tools/site_pages.py export --output dist
```

输出目录需为空。将 `dist/` 内的内容部署到站点根目录，即可使用纯静态托管，无需业务后端。

## 维护命令

```bash
# 更新站点数据（需要联网，日常浏览无需执行）
python -B tools/game_data.py update

# 校验现有数据
python -B tools/game_data.py validate --collection site/data

# 检查图片引用
python -B tools/site_assets.py audit

# 删除未引用图片并清理空图片目录
python -B tools/site_assets.py prune
```

## 可选 HTTPS 服务

默认启动无需第三方 Python 依赖。需要 ASGI 与 HTTPS 时，可安装：

```bash
pip install starlette hypercorn h2
python main.py serve --cert cert.pem --key key.pem
```

## 内容说明

游戏内容与素材版权归各自权利人所有。
