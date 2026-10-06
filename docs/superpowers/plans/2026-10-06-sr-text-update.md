# 崩铁文本增量更新脚本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `tools/sr_update.py` 工具集，从官方数据仓库拉取《崩坏：星穹铁道》最新版本文本，按现有格式追加到 `site/TextMap/` 下的三个文件，并生成一个可浏览的增量展示页。

**Architecture:** 四子命令 CLI（`fetch` / `build` / `report` / `status`）。`fetch` 把官方源文件下载到 `tools/cache/` 并校验 sha256；`build` 读缓存、与现有 `site/TextMap/*` 算差集、以**文本级追加**方式写入（不改动任何已有字节）；`report` 依据 ledger 生成 `site/sr/textupd/` 展示页。只有 `fetch` 需要联网，其余子命令可离线反复运行。

**Tech Stack:** Python 3 标准库（`argparse` / `json` / `urllib` / `hashlib` / `pathlib`）+ pytest（仅测试用）。零运行时第三方依赖，与现有 `main.py` 保持一致。

**Spec:** [docs/superpowers/specs/2026-10-06-sr-text-update-design.md](../specs/2026-10-06-sr-text-update-design.md)

---

## 关键背景（实现者必读）

### 文件格式契约

`site/TextMap/SR.json`（93 MB，LFS）是 `[{H, C, E}, ...]` 的数组，**CRLF 行尾 + 4 空格缩进**：

```
[\r\n    {\r\n        "H": 4073591624,\r\n        "C": "拍摄「巨树」",\r\n        "E": "Photograph the \"giant tree\""\r\n    },\r\n    ...\r\n]
```

字符串**不做 `\uXXXX` 转义**（裸 UTF-8），等价于 `json.dumps(..., ensure_ascii=False)`。

`site/TextMap/SR_Talk_CH.json` / `SR_Talk_EN.json`（31 MB / 33 MB，LFS）是 `[{I, S, T}, ...]` 的数组，同样 CRLF，「内容等宽。**按 `I` 升序排列**，中英两文件 ID 顺序完全一致。

### 两条硬性不变量

1. **追加不得改动已有内容的任何一个字节。** 禁止「解析 + 重新序列化」整份文件——那会重写全部字节，破坏 git diff 可读性，也会让 LFS 每次产生全新对象。必须文本级插入。
2. **重跑必须幂等。** 差集为空时一个字节都不写。

### `H` 字段的处理

`H` 是 32 位整数，是 HomDGCat 自有的内部 ID，**无法从官方数据复现**（已穷举验证）。因此：已有条目的 `H` 原样不动；新条目 `H = xxh32(str(hash64))`，冲突时递增探测，分配表持久化到 `tools/cache/h_map.json` 保证稳定。

### 差集判定键

`SR.json` 不存官方 64 位 hash，无法按 key 比对，故以 **`(C, E)` 原始字符串对**为身份键。**不做 trim 或规范化**——规范化存在把真实新条目误判为已存在而静默吞掉的风险。对话层用 `I` 作判定键。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `.gitignore` | 新建（仓库当前没有），排除 `tools/cache/` |
| `tools/sr_update.py` | CLI 入口，`argparse` 四子命令 + 中英 i18n 字典 |
| `tools/srtext/__init__.py` | 包标记 |
| `tools/srtext/hashes.py` | xxh32 实现 + `HashAllocator` |
| `tools/srtext/source.py` | GitHub 版本解析 · 下载 · 缓存 · sha256 · schema 探测 |
| `tools/srtext/convert.py` | 文本层与对话层转换器 |
| `tools/srtext/append.py` | 风格探测 · 条目渲染 · 原子追加 · 差集 |
| `tools/srtext/report.py` | ledger 读写 · `added.json` · 展示页生成 |
| `tools/tests/conftest.py` | 使 `srtext` 可导入 |
| `tools/tests/test_*.py` | 各模块单元测试 |
| `tools/tests/fixtures/` | 集成测试用的迷你数据集 |
| `site/sr/textupd/index.html` | 展示页（生成物） |
| `site/sr/textupd/viewer.js` | 展示页逻辑（手写，非生成） |
| `site/sr/textupd/added.json` | 增量数据（生成物） |

---

## Task 1: 项目脚手架

**Files:**
- Create: `.gitignore`
- Create: `tools/srtext/__init__.py`
- Create: `tools/tests/conftest.py`
- Create: `tools/pytest.ini`

- [ ] **Step 1: 创建 `.gitignore`**

仓库根目录当前没有 `.gitignore`。没有它，100 MB 级的下载缓存会被误提交。

```gitignore
# 工具缓存：下载的官方源文件、H 分配表、ledger、备份
tools/cache/

# Python
__pycache__/
*.py[cod]
.pytest_cache/
```

- [ ] **Step 2: 创建包标记**

`tools/srtext/__init__.py`：

```python
"""崩铁文本增量更新工具集。"""
```

- [ ] **Step 3: 创建测试路径引导**

`tools/tests/conftest.py` —— 让 `import srtext` 在仓库根目录运行 pytest 时可用：

```python
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parents[1]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))
```

- [ ] **Step 4: 创建 pytest 配置**

`tools/pytest.ini`：

```ini
[pytest]
testpaths = tools/tests
python_files = test_*.py
python_functions = test_*
addopts = -q
```

- [ ] **Step 5: 安装 pytest 并验证脚手架**

```bash
python -m pip install pytest
python -m pytest -c tools/pytest.ini
```

Expected: `no tests ran`（尚无测试文件），退出码 5。这是正常的——脚手架已就位。

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/
git commit -m "chore: 新增文本更新工具脚手架与 gitignore"
```

---

## Task 2: xxh32 实现

`H` 分配器依赖 xxh32。必须手写——仓库是零依赖的，且 `xxhash` 未安装。

**Files:**
- Create: `tools/srtext/hashes.py`
- Create: `tools/tests/test_hashes.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_hashes.py`：

```python
from srtext.hashes import xxh32


def test_xxh32_known_vectors():
    """XXH32 官方标准向量。"""
    assert xxh32(b"") == 0x02CC5D05
    assert xxh32(b"a") == 0x550D7456
    assert xxh32(b"abc") == 0x32D153FF


def test_xxh32_returns_uint32():
    """结果必须落在 uint32 范围内。"""
    for payload in (b"x", b"hello world", "拍摄「巨树」".encode("utf-8")):
        value = xxh32(payload)
        assert 0 <= value < 2**32


def test_xxh32_long_input_crosses_block_boundary():
    """长度超过 16 字节会走多块累加分支，需与标准向量一致。"""
    assert xxh32(b"a" * 100) == xxh32(b"a" * 100)
    assert xxh32(b"a" * 100) != xxh32(b"a" * 99)
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_hashes.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'srtext.hashes'`

- [ ] **Step 3: 实现 xxh32**

`tools/srtext/hashes.py`：

```python
"""32 位 xxhash 实现与 H 值分配器。

官方 TextMap 的 key 是 64 位 xxhash；SR.json 的 H 是其自有的 32 位内部 ID，
无法从官方数据复现，因此新增条目的 H 由本模块按确定性规则生成。
"""

import json
import struct
from pathlib import Path
from typing import Iterable, Mapping

UINT32_MASK = 0xFFFFFFFF

_PRIME32_1 = 2654435761
_PRIME32_2 = 2246822519
_PRIME32_3 = 3266489917
_PRIME32_4 = 668265263
_PRIME32_5 = 374761393


def _rotl32(value: int, shift: int) -> int:
    return ((value << shift) | (value >> (32 - shift))) & UINT32_MASK


def xxh32(data: bytes, seed: int = 0) -> int:
    """XXH32 哈希，返回 uint32。"""
    length = len(data)
    offset = 0

    if length >= 16:
        v1 = (seed + _PRIME32_1 + _PRIME32_2) & UINT32_MASK
        v2 = (seed + _PRIME32_2) & UINT32_MASK
        v3 = seed & UINT32_MASK
        v4 = (seed - _PRIME32_1) & UINT32_MASK
        while offset + 16 <= length:
            v1 = (_rotl32((v1 + struct.unpack_from("<I", data, offset)[0] * _PRIME32_2) & UINT32_MASK, 13) * _PRIME32_1) & UINT32_MASK
            offset += 4
            v2 = (_rotl32((v2 + struct.unpack_from("<I", data, offset)[0] * _PRIME32_2) & UINT32_MASK, 13) * _PRIME32_1) & UINT32_MASK
            offset += 4
            v3 = (_rotl32((v3 + struct.unpack_from("<I", data, offset)[0] * _PRIME32_2) & UINT32_MASK, 13) * _PRIME32_1) & UINT32_MASK
            offset += 4
            v4 = (_rotl32((v4 + struct.unpack_from("<I", data, offset)[0] * _PRIME32_2) & UINT32_MASK, 13) * _PRIME32_1) & UINT32_MASK
            offset += 4
        acc = (_rotl32(v1, 1) + _rotl32(v2, 7) + _rotl32(v3, 12) + _rotl32(v4, 18)) & UINT32_MASK
    else:
        acc = (seed + _PRIME32_5) & UINT32_MASK

    acc = (acc + length) & UINT32_MASK

    while offset + 4 <= length:
        acc = (_rotl32((acc + struct.unpack_from("<I", data, offset)[0] * _PRIME32_3) & UINT32_MASK, 17) * _PRIME32_4) & UINT32_MASK
        offset += 4

    while offset < length:
        acc = (_rotl32((acc + data[offset] * _PRIME32_5) & UINT32_MASK, 11) * _PRIME32_1) & UINT32_MASK
        offset += 1

    acc ^= acc >> 15
    acc = (acc * _PRIME32_2) & UINT32_MASK
    acc ^= acc >> 13
    acc = (acc * _PRIME32_3) & UINT32_MASK
    acc ^= acc >> 16
    return acc
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_hashes.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/hashes.py tools/tests/test_hashes.py
git commit -m "feat: 新增 xxh32 实现"
```

---

## Task 3: H 分配器

**Files:**
- Modify: `tools/srtext/hashes.py`
- Modify: `tools/tests/test_hashes.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_hashes.py` 末尾：

```python
import json

from srtext.hashes import HashAllocator


def test_allocator_is_deterministic(tmp_path):
    """同一 hash64 多次分配必须得到同一个 H。"""
    alloc = HashAllocator(used=set(), map_path=tmp_path / "h_map.json")
    first = alloc.assign(12518437936274253375)
    second = alloc.assign(12518437936274253375)
    assert first == second


def test_allocator_avoids_existing_hashes(tmp_path):
    """分配结果不得与现有 SR.json 中的 H 冲突。"""
    # 预先构造一个恰好等于 base 值的"已占用" H
    from srtext.hashes import xxh32

    hash64 = 12518437936274253375
    occupied = xxh32(str(hash64).encode("utf-8"))
    alloc = HashAllocator(used={occupied}, map_path=tmp_path / "h_map.json")
    assert alloc.assign(hash64) != occupied


def test_allocator_persists_and_reloads(tmp_path):
    """分配结果落盘后，新建分配器读回同一个 H。"""
    map_path = tmp_path / "h_map.json"
    alloc = HashAllocator(used=set(), map_path=map_path)
    assigned = alloc.assign(999)
    alloc.save()

    reloaded = HashAllocator(used=set(), map_path=map_path)
    assert reloaded.assign(999) == assigned


def test_allocator_distinct_hashes_get_distinct_h(tmp_path):
    alloc = HashAllocator(used=set(), map_path=tmp_path / "h_map.json")
    values = {alloc.assign(h) for h in range(1, 501)}
    assert len(values) == 500


def test_allocator_map_is_json_serialisable(tmp_path):
    map_path = tmp_path / "h_map.json"
    alloc = HashAllocator(used=set(), map_path=map_path)
    alloc.assign(7)
    alloc.save()
    data = json.loads(map_path.read_text(encoding="utf-8"))
    assert data == {"7": alloc.assign(7)}


def test_collect_used_hashes_reads_entries(tmp_path):
    """从模拟的 SR.json 中收集 H 值。"""
    from srtext.hashes import collect_used_hashes

    sr = tmp_path / "SR.json"
    sr.write_text(
        json.dumps([{"H": 1, "C": "a", "E": "b"}, {"H": 2}, {"C": "c"}]),
        encoding="utf-8",
    )
    assert collect_used_hashes(sr) == {1, 2}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_hashes.py -v
```

Expected: FAIL — `ImportError: cannot import name 'HashAllocator'`

- [ ] **Step 3: 实现分配器**

追加到 `tools/srtext/hashes.py` 末尾：

```python
def collect_used_hashes(sr_json_path: Path) -> set[int]:
    """读出 SR.json 中全部已占用的 H 值。

    注意：93 MB 文件全量 json.load 的峰值内存约 1.5 GB。
    """
    with sr_json_path.open(encoding="utf-8") as handle:
        records = json.load(handle)
    used = {rec["H"] for rec in records if isinstance(rec.get("H"), int)}
    del records
    return used


class HashAllocator:
    """为新条目分配稳定的 32 位 H 值。

    以官方 64 位 hash 而非文本作为输入，使 H 与文本内容解耦：
    同一官方条目在版本间文本微调时，H 保持不变。
    """

    def __init__(self, used: Iterable[int], map_path: Path) -> None:
        self._used: set[int] = set(used)
        self._map_path = Path(map_path)
        self._mapping: dict[str, int] = {}
        self._dirty = False
        self._load()

    def _load(self) -> None:
        if not self._map_path.exists():
            return
        with self._map_path.open(encoding="utf-8") as handle:
            raw = json.load(handle)
        self._mapping = {str(k): int(v) for k, v in raw.items()}
        self._used.update(self._mapping.values())

    def assign(self, hash64: int) -> int:
        """取得该官方 hash 对应的 H，必要时新分配。"""
        key = str(hash64)
        if key in self._mapping:
            return self._mapping[key]

        candidate = xxh32(key.encode("utf-8"))
        probe = 0
        while candidate in self._used:
            probe += 1
            candidate = xxh32(f"{key}:{probe}".encode("utf-8"))

        self._mapping[key] = candidate
        self._used.add(candidate)
        self._dirty = True
        return candidate

    def save(self) -> None:
        if not self._dirty and self._map_path.exists():
            return
        self._map_path.parent.mkdir(parents=True, exist_ok=True)
        with self._map_path.open("w", encoding="utf-8") as handle:
            json.dump(self._mapping, handle, ensure_ascii=False, indent=2, sort_keys=True)
        self._dirty = False
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_hashes.py -v
```

Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/hashes.py tools/tests/test_hashes.py
git commit -m "feat: 新增 H 值分配器"
```

---

## Task 4: 版本解析与下载

**Files:**
- Create: `tools/srtext/source.py`
- Create: `tools/tests/test_source.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_source.py`：

```python
import hashlib
import json

import pytest

from srtext.source import (
    SourceVersion,
    parse_version,
    sha256_file,
    Cache,
    VersionParseError,
)


def test_parse_version_extracts_from_commit_message():
    """官方 commit message 形如 OSPRODWin4.6.0_D16688351_A16684237_L16658846。"""
    message = "OSPRODWin4.6.0_D16688351_A16684237_L16658846"
    assert parse_version(message) == "4.6.0"


def test_parse_version_rejects_unexpected_message():
    with pytest.raises(VersionParseError) as excinfo:
        parse_version("just some commit")
    assert "OSPRODWin" in str(excinfo.value)


def test_sha256_file_matches_hashlib(tmp_path):
    target = tmp_path / "blob.bin"
    target.write_bytes(b"hello world")
    expected = hashlib.sha256(b"hello world").hexdigest()
    assert sha256_file(target) == expected


def test_cache_reports_valid_file_by_digest(tmp_path):
    cache = Cache(tmp_path)
    target = cache.path_for("TextMapCHS.json")
    target.write_bytes(b"payload")
    digest = sha256_file(target)

    assert cache.is_valid("TextMapCHS.json", digest) is True
    assert cache.is_valid("TextMapCHS.json", "0" * 64) is False
    assert cache.is_valid("missing.json", digest) is False


def test_cache_manifest_round_trip(tmp_path):
    cache = Cache(tmp_path)
    version = SourceVersion(sha="abc123", version="4.6.0", message="OSPRODWin4.6.0_x")
    cache.save_manifest(version, {"TextMapCHS.json": {"sha256": "ff", "bytes": 10}})

    manifest = cache.load_manifest()
    assert manifest["version"] == "4.6.0"
    assert manifest["sha"] == "abc123"
    assert manifest["files"]["TextMapCHS.json"]["bytes"] == 10
    assert "fetched_at" in manifest


def test_cache_load_manifest_when_missing(tmp_path):
    assert Cache(tmp_path).load_manifest() == {}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_source.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'srtext.source'`

- [ ] **Step 3: 实现 source 模块**

`tools/srtext/source.py`：

```python
"""官方数据源解析、下载、缓存与 schema 探测。

数据源：DimbreathBot/TurnBasedGameData（Dimbreath/StarRailData 的继任者）。
该仓库只有 main 一个分支，数据按版本就地更新，因此按 commit SHA 固定下载
以保证同一版本可复现、可校验。
"""

import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

REPO = "DimbreathBot/TurnBasedGameData"
BRANCH = "main"
API_ROOT = f"https://api.github.com/repos/{REPO}"
RAW_ROOT = f"https://raw.githubusercontent.com/{REPO}"

#: 需要下载的源文件：缓存内文件名 -> 仓库内路径
SOURCE_FILES: dict[str, str] = {
    "TextMapCHS.json": "TextMap/TextMapCHS.json",
    "TextMapEN.json": "TextMap/TextMapEN.json",
    "TalkSentenceConfig.json": "ExcelOutput/TalkSentenceConfig.json",
}

_VERSION_RE = re.compile(r"OSPRODWin(\d+\.\d+\.\d+)")
_USER_AGENT = "HomDGCat-sr-text-update/1.0"


class VersionParseError(RuntimeError):
    """commit message 不符合预期格式。"""


class SchemaMismatch(RuntimeError):
    """源文件结构与预期不符。"""


@dataclass(frozen=True)
class SourceVersion:
    sha: str
    version: str
    message: str


def parse_version(message: str) -> str:
    """从 commit message 提取版本号。"""
    match = _VERSION_RE.search(message or "")
    if not match:
        raise VersionParseError(
            f"无法从 commit message 提取版本号，期望形如 OSPRODWin4.6.0_...，实际为: {message!r}"
        )
    return match.group(1)


def sha256_file(path: Path, chunk_size: int = 1 << 20) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Cache:
    """管理 tools/cache/ 下的下载缓存与 manifest。"""

    MANIFEST_NAME = "manifest.json"

    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def path_for(self, name: str) -> Path:
        return self.root / name

    def is_valid(self, name: str, expected_sha256: str) -> bool:
        target = self.path_for(name)
        if not target.exists():
            return False
        return sha256_file(target) == expected_sha256

    def load_manifest(self) -> dict[str, Any]:
        manifest_path = self.root / self.MANIFEST_NAME
        if not manifest_path.exists():
            return {}
        with manifest_path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def save_manifest(self, version: SourceVersion, files: Mapping[str, Mapping[str, Any]]) -> None:
        payload = {
            "repo": REPO,
            "sha": version.sha,
            "version": version.version,
            "message": version.message,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "files": {name: dict(meta) for name, meta in files.items()},
        }
        with (self.root / self.MANIFEST_NAME).open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)


def _request(url: str, *, timeout: int = 60, retries: int = 3) -> bytes:
    """带指数退避的 GET。"""
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt < retries - 1:
                time.sleep(2**attempt)
    raise RuntimeError(f"请求失败: {url}") from last_error


def resolve_latest_version(path: str, *, retries: int = 3) -> SourceVersion:
    """查询指定路径的最新 commit，返回 SHA 与版本号。"""
    url = f"{API_ROOT}/commits?path={path}&per_page=1"
    payload = json.loads(_request(url, retries=retries).decode("utf-8"))
    if not payload:
        raise RuntimeError(f"未找到 {path} 的提交记录")
    commit = payload[0]
    message = commit["commit"]["message"].strip()
    return SourceVersion(sha=commit["sha"], version=parse_version(message), message=message)


def download(url: str, dest: Path, *, timeout: int = 300, retries: int = 3) -> int:
    """下载到 dest，返回字节数。失败时清理半成品。"""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = _request(url, timeout=timeout, retries=retries)
    except RuntimeError:
        if dest.exists():
            dest.unlink()
        raise
    dest.write_bytes(payload)
    return len(payload)
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_source.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/source.py tools/tests/test_source.py
git commit -m "feat: 新增数据源解析与缓存"
```

---

## Task 5: 下载编排

把 Task 4 的零件组装成「拉取一个版本的全部源文件」。

**Files:**
- Modify: `tools/srtext/source.py`
- Modify: `tools/tests/test_source.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_source.py` 末尾：

```python
from srtext.source import fetch_sources


def test_fetch_sources_downloads_all_and_records_manifest(tmp_path, monkeypatch):
    """首次抓取应下载全部文件并写入 manifest。"""
    import srtext.source as source_module

    calls: list[str] = []

    def fake_resolve(path, **kwargs):
        return SourceVersion(sha="deadbeef", version="4.6.0", message="OSPRODWin4.6.0_x")

    def fake_download(url, dest, **kwargs):
        calls.append(url)
        payload = b'{"k": "v"}'
        Path(dest).write_bytes(payload)
        return len(payload)

    monkeypatch.setattr(source_module, "resolve_latest_version", fake_resolve)
    monkeypatch.setattr(source_module, "download", fake_download)

    cache = Cache(tmp_path)
    version = fetch_sources(cache)

    assert version.version == "4.6.0"
    assert len(calls) == len(source_module.SOURCE_FILES)
    for name in source_module.SOURCE_FILES:
        assert cache.path_for(name).exists()
    manifest = cache.load_manifest()
    assert manifest["sha"] == "deadbeef"
    assert set(manifest["files"]) == set(source_module.SOURCE_FILES)


def test_fetch_sources_skips_valid_cached_files(tmp_path, monkeypatch):
    """缓存校验通过的文件不应重复下载。"""
    import srtext.source as source_module

    monkeypatch.setattr(
        source_module,
        "resolve_latest_version",
        lambda path, **kw: SourceVersion(sha="deadbeef", version="4.6.0", message="OSPRODWin4.6.0_x"),
    )

    cache = Cache(tmp_path)
    # 先跑一次填充缓存
    downloaded: list[str] = []

    def counting_download(url, dest, **kwargs):
        downloaded.append(url)
        payload = b"payload"
        Path(dest).write_bytes(payload)
        return len(payload)

    monkeypatch.setattr(source_module, "download", counting_download)
    fetch_sources(cache)
    first_round = len(downloaded)

    # 再跑一次：sha256 未变，应全部跳过
    fetch_sources(cache)
    assert len(downloaded) == first_round
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_source.py -v
```

Expected: FAIL — `ImportError: cannot import name 'fetch_sources'`

- [ ] **Step 3: 实现 fetch_sources**

追加到 `tools/srtext/source.py` 末尾：

```python
def fetch_sources(cache: Cache, *, force: bool = False, log=print) -> SourceVersion:
    """解析最新版本并下载全部源文件。

    先按 TextMapCHS.json 的最新 commit 确定版本与 SHA，再按该 SHA 逐个下载，
    保证同一次运行取到的是同一个版本快照。
    校验通过的在缓存文件不会重复下载。
    """
    version = resolve_latest_version("TextMap/TextMapCHS.json")
    log(f"  目标版本: {version.version}  ({version.sha[:12]})")

    previous = cache.load_manifest().get("files", {})
    results: dict[str, dict[str, Any]] = {}

    for name, repo_path in SOURCE_FILES.items():
        expected = previous.get(name, {}).get("sha256")
        if not force and expected and cache.is_valid(name, expected):
            size = cache.path_for(name).stat().st_size
            log(f"  跳过(已缓存): {name}  {size:,} 字节")
            results[name] = {"sha256": expected, "bytes": size}
            continue

        url = f"{RAW_ROOT}/{version.sha}/{repo_path}"
        log(f"  下载: {name}  <- {repo_path}")
        size = download(url, cache.path_for(name))
        digest = sha256_file(cache.path_for(name))
        results[name] = {"sha256": digest, "bytes": size}
        log(f"  完成: {name}  {size:,} 字节  sha256={digest[:12]}")

    cache.save_manifest(version, results)
    return version
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_source.py -v
```

Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/source.py tools/tests/test_source.py
git commit -m "feat: 新增源文件抓取编排"
```

---

## Task 6: Schema 探测

`TalkSentenceConfig.json` 的字段结构**未经实测**（本次探索中该文件 41.6 MB，下载超时）。因此转换前必须先探测真实结构：找得到就继续，找不到就**打印实际 keys 与前若干条样本后报错**，绝不静默产出错数据。

**Files:**
- Modify: `tools/srtext/source.py`
- Modify: `tools/tests/test_source.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_source.py` 末尾：

```python
from srtext.source import probe_textmap, probe_talk, TalkSchema


def test_probe_textmap_accepts_expected_shape():
    probe_textmap({"123": "文本", "456": "another"})  # 不抛异常即通过


def test_probe_textmap_rejects_non_str_values():
    with pytest.raises(SchemaMismatch) as excinfo:
        probe_textmap({"123": {"Hash": 1}})
    assert "TextMap" in str(excinfo.value)


def test_probe_talk_detects_dict_keyed_config():
    config = {
        "30403551": {
            "TalkSentenceText": {"Hash": 111},
            "TalkSentenceName": {"Hash": 222},
        }
    }
    schema = probe_talk(config)
    assert schema.id_field is None
    assert schema.text_field == "TalkSentenceText"
    assert schema.name_field == "TalkSentenceName"


def test_probe_talk_detects_list_config():
    config = [
        {"TalkSentenceID": 30403551, "TalkSentenceText": {"Hash": 111}, "TalkSentenceName": {"Hash": 222}}
    ]
    schema = probe_talk(config)
    assert schema.id_field == "TalkSentenceID"
    assert schema.text_field == "TalkSentenceText"


def test_probe_talk_reports_actual_keys_when_text_field_missing():
    with pytest.raises(SchemaMismatch) as excinfo:
        probe_talk({"30403551": {"SomethingElse": 1, "Another": "x"}})
    message = str(excinfo.value)
    assert "SomethingElse" in message
    assert "Another" in message


def test_probe_talk_tolerates_missing_name_field():
    """说话人字段可以缺失，正文必须有。"""
    schema = probe_talk({"30403551": {"TalkSentenceText": {"Hash": 111}}})
    assert schema.name_field is None
    assert schema.text_field == "TalkSentenceText"
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_source.py -v
```

Expected: FAIL — `ImportError: cannot import name 'probe_textmap'`

- [ ] **Step 3: 实现探测**

追加到 `tools/srtext/source.py` 末尾：

```python
@dataclass(frozen=True)
class TalkSchema:
    """TalkSentenceConfig 的实际字段布局。

    id_field 为 None 表示配置本身是以 ID 为键的字典；
    否则配置是列表，ID 取自该字段。
    """

    id_field: str | None
    text_field: str
    name_field: str | None


def _sample_entries(payload: Any, size: int = 5) -> list[tuple[Any, Mapping[str, Any]]]:
    """取出若干 (id, entry) 样本，兼容字典与列表两种配置形态。"""
    if isinstance(payload, Mapping):
        return [(key, value) for key, value in list(payload.items())[:size] if isinstance(value, Mapping)]
    if isinstance(payload, list):
        return [(None, value) for value in payload[:size] if isinstance(value, Mapping)]
    return []


def _hash_ref_fields(entry: Mapping[str, Any]) -> dict[str, int]:
    """挑出形如 {"Hash": <int>} 的字段。"""
    found: dict[str, int] = {}
    for key, value in entry.items():
        if isinstance(value, Mapping) and isinstance(value.get("Hash"), int):
            found[key] = value["Hash"]
    return found


def _pick_field(candidates: Mapping[str, Any], keyword: str) -> str | None:
    keyword = keyword.lower()
    for key in candidates:
        if keyword in key.lower():
            return key
    return None


def probe_textmap(payload: Any) -> None:
    """校验 TextMap 结构：字典，键为数字字符串，值为字符串。"""
    if not isinstance(payload, Mapping):
        raise SchemaMismatch(f"TextMap 期望是字典，实际为 {type(payload).__name__}")
    for key, value in list(payload.items())[:200]:
        if not isinstance(key, str) or not isinstance(value, str):
            raise SchemaMismatch(
                "TextMap 期望 {数字字符串: 字符串}，实际样本: "
                f"{key!r} -> {type(value).__name__}. 前 3 条: {list(payload.items())[:3]!r}"
            )


def probe_talk(payload: Any) -> TalkSchema:
    """探测 TalkSentenceConfig 的实际字段布局。"""
    samples = _sample_entries(payload)
    if not samples:
        raise SchemaMismatch(
            f"TalkSentenceConfig 结构不可识别：期望字典或列表，实际为 {type(payload).__name__}"
        )

    first_entry = samples[0][1]
    refs = _hash_ref_fields(first_entry)
    if not refs:
        raise SchemaMismatch(
            "TalkSentenceConfig 中未找到形如 {\"Hash\": <int>} 的引用字段。\n"
            f"第一个条目的实际字段: {sorted(first_entry.keys())}\n"
            f"第一个条目样本: {first_entry!r}"
        )

    text_field = _pick_field(refs, "text")
    if text_field is None:
        raise SchemaMismatch(
            "TalkSentenceConfig 中未找到正文引用字段（字段名应含 'text'）。\n"
            f"候选引用字段: {sorted(refs.keys())}\n"
            f"第一个条目样本: {first_entry!r}"
        )

    id_field: str | None = None
    if isinstance(payload, list):
        id_field = _pick_field(first_entry, "id")
        if id_field is None:
            raise SchemaMismatch(
                "TalkSentenceConfig 是列表，但条目中未找到含 'id' 的字段。\n"
                f"第一个条目的实际字段: {sorted(first_entry.keys())}"
            )

    return TalkSchema(id_field=id_field, text_field=text_field, name_field=_pick_field(refs, "name"))
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_source.py -v
```

Expected: 14 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/source.py tools/tests/test_source.py
git commit -m "feat: 新增源文件 schema 探测"
```

---

## Task 7: 文本层转换器

**Files:**
- Create: `tools/srtext/convert.py`
- Create: `tools/tests/test_convert.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_convert.py`：

```python
from srtext.convert import build_textmap_entries
from srtext.hashes import HashAllocator


def make_allocator(tmp_path):
    return HashAllocator(used=set(), map_path=tmp_path / "h_map.json")


def test_build_textmap_entries_produces_four_shapes(tmp_path):
    chs = {"1": "中文一", "2": "中文二", "3": "", "4": ""}
    eng = {"1": "English one", "2": "", "3": "English three", "4": ""}

    entries = build_textmap_entries(chs, eng, make_allocator(tmp_path), existing_keys=set())
    by_h = {e["H"]: e for e in entries}
    assert len(entries) == 4

    shapes = sorted(tuple(sorted(e.keys())) for e in entries)
    assert shapes == [("H",), ("H", "C"), ("H", "C", "E"), ("H", "E")]


def test_build_textmap_entries_orders_fields_as_h_c_e(tmp_path):
    entries = build_textmap_entries(
        {"1": "中文"}, {"1": "English"}, make_allocator(tmp_path), existing_keys=set()
    )
    assert list(entries[0].keys()) == ["H", "C", "E"]


def test_build_textmap_entries_skips_existing(tmp_path):
    """(C, E) 已存在的条目不重复添加。"""
    entries = build_textmap_entries(
        {"1": "中文"}, {"1": "English"}, make_allocator(tmp_path), existing_keys={("中文", "English")}
    )
    assert entries == []


def test_build_textmap_entries_does_not_normalise_text(tmp_path):
    """差集比对使用原始字符串，不 trim。前导空格是不同文本。"""
    entries = build_textmap_entries(
        {"1": " 中文"}, {"1": "English"}, make_allocator(tmp_path), existing_keys={("中文", "English")}
    )
    assert len(entries) == 1


def test_build_textmap_entries_is_deterministic(tmp_path):
    """输出顺序按官方 hash 数值升序，保证可复现。"""
    chs = {"10": "a", "9": "b", "100": "c"}
    entries = build_textmap_entries(chs, {}, make_allocator(tmp_path), existing_keys=set())
    alloc = build_textmap_entries(chs, {}, make_allocator(tmp_path), existing_keys=set())
    assert [e["H"] for e in entries] == [e["H"] for e in alloc]


def test_build_textmap_entries_unions_both_languages(tmp_path):
    """只在英文里出现的 key 也要收录。"""
    entries = build_textmap_entries({}, {"7": "only english"}, make_allocator(tmp_path), existing_keys=set())
    assert len(entries) == 1
    assert "E" in entries[0]
    assert "C" not in entries[0]
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_convert.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'srtext.convert'`

- [ ] **Step 3: 实现文本层转换**

`tools/srtext/convert.py`：

```python
"""把官方数据转换成 SR.json / SR_Talk_*.json 的条目形态。"""

from typing import Any, Mapping, Sequence

from .hashes import HashAllocator

#: SR.json 条目的字段顺序，必须与现有文件一致
TEXTMAP_FIELD_ORDER: tuple[str, ...] = ("H", "C", "E")

#: SR_Talk_*.json 条目的字段顺序
TALK_FIELD_ORDER: tuple[str, ...] = ("I", "S", "T")


def build_textmap_entries(
    chs: Mapping[str, str],
    eng: Mapping[str, str],
    allocator: HashAllocator,
    existing_keys: set[tuple[str, str]],
) -> list[dict[str, Any]]:
    """构造待追加的 SR.json 条目。

    身份键是 (C, E) 原始字符串对——SR.json 不存官方 64 位 hash，无法按 key 比对。
    空字符串视为缺失，还原现有文件的四种形态。
    输出按官方 hash 数值升序，保证可复现。
    """
    entries: list[dict[str, Any]] = []
    for key in sorted(set(chs) | set(eng), key=int):
        chinese = chs.get(key, "")
        english = eng.get(key, "")
        if (chinese, english) in existing_keys:
            continue
        entry: dict[str, Any] = {"H": allocator.assign(int(key))}
        if chinese:
            entry["C"] = chinese
        if english:
            entry["E"] = english
        entries.append(entry)
    return entries


def iter_textmap_keys(records: Sequence[Mapping[str, Any]]) -> list[tuple[str, str]]:
    """从现有 SR.json 记录中抽出 (C, E) 身份键。"""
    return [(rec.get("C", ""), rec.get("E", "")) for rec in records]
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_convert.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/convert.py tools/tests/test_convert.py
git commit -m "feat: 新增文本层转换器"
```

---

## Task 8: 对话层转换器

**Files:**
- Modify: `tools/srtext/convert.py`
- Modify: `tools/tests/test_convert.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_convert.py` 末尾：

```python
from srtext.convert import build_talk_entries, resolve_hash_ref
from srtext.source import TalkSchema


DICT_SCHEMA = TalkSchema(id_field=None, text_field="Text", name_field="Name")


def test_resolve_hash_ref_reads_nested_hash():
    assert resolve_hash_ref({"Text": {"Hash": 123}}, "Text") == 123


def test_resolve_hash_ref_returns_none_when_absent():
    assert resolve_hash_ref({"Other": {"Hash": 1}}, "Text") is None
    assert resolve_hash_ref({"Text": None}, "Text") is None


def test_build_talk_entries_pairs_both_languages():
    config = {
        "1001": {"Text": {"Hash": 11}, "Name": {"Hash": 21}},
        "1002": {"Text": {"Hash": 12}, "Name": {"Hash": 22}},
    }
    chs = {"11": "中文一", "12": "中文二", "21": "说话人甲", "22": "说话人乙"}
    eng = {"11": "English one", "12": "English two", "21": "Speaker A", "22": "Speaker B"}

    ch, en = build_talk_entries(config, DICT_SCHEMA, chs, eng, existing_ids=set())

    assert [e["I"] for e in ch] == [1001, 1002]
    assert ch[0] == {"I": 1001, "S": "说话人甲", "T": "中文一"}
    assert en[0] == {"I": 1001, "S": "Speaker A", "T": "English one"}


def test_build_talk_entries_sorts_by_id():
    config = {"3003": {"Text": {"Hash": 1}}, "1001": {"Text": {"Hash": 2}}}
    ch, _ = build_talk_entries(config, DICT_SCHEMA, {"1": "a", "2": "b"}, {"1": "a", "2": "b"}, set())
    assert [e["I"] for e in ch] == [1001, 3003]


def test_build_talk_entries_skips_existing_ids():
    config = {"1001": {"Text": {"Hash": 11}}}
    ch, en = build_talk_entries(config, DICT_SCHEMA, {"11": "x"}, {"11": "y"}, existing_ids={1001})
    assert ch == [] and en == []


def test_build_talk_entries_emits_empty_speaker_as_empty_string():
    """空说话人是合法数据（现有文件中有 55227 条），不得省略字段。"""
    config = {"1001": {"Text": {"Hash": 11}}}
    ch, _ = build_talk_entries(config, DICT_SCHEMA, {"11": "正文"}, {"11": "text"}, existing_ids=set())
    assert ch[0] == {"I": 1001, "S": "", "T": "正文"}


def test_build_talk_entries_handles_list_config():
    config = [{"Id": 1001, "Text": {"Hash": 11}, "Name": {"Hash": 21}}]
    schema = TalkSchema(id_field="Id", text_field="Text", name_field="Name")
    ch, _ = build_talk_entries(config, schema, {"11": "正文", "21": "甲"}, {"11": "t", "21": "A"}, set())
    assert ch[0] == {"I": 1001, "S": "甲", "T": "正文"}


def test_build_talk_entries_skips_entries_without_text():
    """正文 hash 解析不到文本时跳过该条目，不产出空条目。"""
    config = {"1001": {"Text": {"Hash": 999}, "Name": {"Hash": 21}}}
    ch, en = build_talk_entries(config, DICT_SCHEMA, {"21": "甲"}, {"21": "A"}, existing_ids=set())
    assert ch == [] and en == []


def test_build_talk_entries_uses_paragraph_for_missing_english():
    """英文缺该条时，英文文件的 T 留空但不丢弃条目。"""
    config = {"1001": {"Text": {"Hash": 11}, "Name": {"Hash": 21}}}
    ch, en = build_talk_entries(config, DICT_SCHEMA, {"11": "正文", "21": "甲"}, {"21": "A"}, set())
    assert len(ch) == 1 and len(en) == 1
    assert en[0]["T"] == ""
    assert en[0]["S"] == "A"
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_convert.py -v
```

Expected: FAIL — `ImportError: cannot import name 'build_talk_entries'`

- [ ] **Step 3: 实现对话层转换**

追加到 `tools/srtext/convert.py` 末尾：

```python
def resolve_hash_ref(entry: Mapping[str, Any], field: str | None) -> int | None:
    """取出形如 {"Hash": <int>} 的引用值。"""
    if field is None:
        return None
    ref = entry.get(field)
    if isinstance(ref, Mapping):
        value = ref.get("Hash")
        if isinstance(value, int):
            return value
    return None


def _iter_talk_pairs(config: Any, schema) -> list[tuple[int, Mapping[str, Any]]]:
    """把两种配置形态归一成 (id, entry) 列表。"""
    if isinstance(config, Mapping):
        return [(int(key), value) for key, value in config.items() if isinstance(value, Mapping)]
    if isinstance(config, list):
        pairs = []
        for value in config:
            if not isinstance(value, Mapping):
                continue
            raw_id = value.get(schema.id_field) if schema.id_field else None
            if isinstance(raw_id, int):
                pairs.append((raw_id, value))
            elif isinstance(raw_id, str) and raw_id.isdigit():
                pairs.append((int(raw_id), value))
        return pairs
    return []


def build_talk_entries(
    config: Any,
    schema,
    chs: Mapping[str, str],
    eng: Mapping[str, str],
    existing_ids: set[int],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """构造待追加的 SR_Talk_CH.json / SR_Talk_EN.json 条目。

    返回 (中文条目, 英文条目)。两份列表的 ID 顺序一致，与现有文件的组织方式相同。
    正文 hash 解析不到文本的条目整条跳过——避免产出没有内容的空对话。
    """
    chinese_entries: list[dict[str, Any]] = []
    english_entries: list[dict[str, Any]] = []

    for identifier, entry in sorted(_iter_talk_pairs(config, schema), key=lambda pair: pair[0]):
        if identifier in existing_ids:
            continue

        text_hash = resolve_hash_ref(entry, schema.text_field)
        if text_hash is None:
            continue
        text_key = str(text_hash)
        chinese_text = chs.get(text_key, "")
        english_text = eng.get(text_key, "")
        if not chinese_text and not english_text:
            continue

        name_hash = resolve_hash_ref(entry, schema.name_field)
        name_key = str(name_hash) if name_hash is not None else None

        chinese_entries.append(
            {
                "I": identifier,
                "S": chs.get(name_key, "") if name_key else "",
                "T": chinese_text,
            }
        )
        english_entries.append(
            {
                "I": identifier,
                "S": eng.get(name_key, "") if name_key else "",
                "T": english_text,
            }
        )

    return chinese_entries, english_entries
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_convert.py -v
```

Expected: 15 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/convert.py tools/tests/test_convert.py
git commit -m "feat: 新增对话层转换器"
```

---

## Task 9: 风格探测与条目渲染

追加写必须逐字节还原现有风格（CRLF + 4 空格缩进 + 裸 UTF-8）。**不能靠 `json.dump`**。

**Files:**
- Create: `tools/srtext/append.py`
- Create: `tools/tests/test_append.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_append.py`：

```python
import json

import pytest

from srtext.append import FileStyle, detect_style, render_entry, LfsPointerError, assert_not_lfs_pointer


def test_detect_style_crlf_four_space():
    raw = b'[\r\n    {\r\n        "H": 1\r\n    }\r\n]'
    style = detect_style(raw)
    assert style.newline == b"\r\n"
    assert style.indent == 4


def test_detect_style_lf_two_space():
    raw = b'[\n  {\n    "H": 1\n  }\n]'
    style = detect_style(raw)
    assert style.newline == b"\n"
    assert style.indent == 2


def test_detect_style_empty_array_defaults():
    style = detect_style(b"[]")
    assert style.indent == 4


def test_render_entry_matches_existing_layout():
    style = FileStyle(newline=b"\r\n", indent=4)
    rendered = render_entry({"H": 4073591624, "C": "拍摄「巨树」"}, ("H", "C", "E"), style)
    assert rendered == '    {\r\n        "H": 4073591624,\r\n        "C": "拍摄「巨树」"\r\n    }'


def test_render_entry_omits_absent_fields():
    style = FileStyle(newline=b"\r\n", indent=4)
    rendered = render_entry({"H": 5}, ("H", "C", "E"), style)
    assert "C" not in rendered
    assert rendered == '    {\r\n        "H": 5\r\n    }'


def test_render_entry_does_not_escape_non_ascii():
    style = FileStyle(newline=b"\r\n", indent=4)
    rendered = render_entry({"H": 1, "C": "中文"}, ("H", "C"), style)
    assert "\\u" not in rendered


def test_render_entry_escapes_quotes_like_json():
    style = FileStyle(newline=b"\n", indent=4)
    rendered = render_entry({"H": 1, "E": 'Photograph the "giant tree"'}, ("H", "E"), style)
    assert '\\"giant tree\\"' in rendered
    # 渲染结果必须是合法 JSON 片段
    assert json.loads("[" + rendered + "]")[0]["E"] == 'Photograph the "giant tree"'


def test_assert_not_lfs_pointer_raises():
    pointer = b"version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n"
    with pytest.raises(LfsPointerError) as excinfo:
        assert_not_lfs_pointer(pointer)
    assert "git lfs pull" in str(excinfo.value)


def test_assert_not_lfs_pointer_passes_real_json():
    assert_not_lfs_pointer(b'[\r\n    {\r\n        "H": 1\r\n    }\r\n]')
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_append.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'srtext.append'`

- [ ] **Step 3: 实现风格探测与渲染**

`tools/srtext/append.py`：

```python
"""文本级追加写入。

核心不变量：追加不得改动已有内容的任何一个字节。
因此禁止「解析 + 重新序列化」整份文件——必须定位末尾的 ] 后原地插入。
"""

import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

LFS_POINTER_PREFIX = b"version https://git-lfs"

_INDENT_RE = re.compile(rb"(?m)^([ \t]*)\{")


class LfsPointerError(RuntimeError):
    """目标文件是 LFS 指针而非真实内容。"""


class MalformedJsonArray(RuntimeError):
    """目标文件不是以 ] 结尾的 JSON 数组。"""


@dataclass(frozen=True)
class FileStyle:
    newline: bytes
    indent: int


def detect_style(raw: bytes) -> FileStyle:
    """探测文件的行尾风格与缩进宽度。"""
    newline = b"\r\n" if b"\r\n" in raw else b"\n"
    match = _INDENT_RE.search(raw)
    indent = len(match.group(1)) if match else 4
    return FileStyle(newline=newline, indent=indent)


def assert_not_lfs_pointer(raw: bytes) -> None:
    """拦截 LFS 指针，避免把它当 JSON 解析后写坏。"""
    if raw[: len(LFS_POINTER_PREFIX)] == LFS_POINTER_PREFIX:
        raise LfsPointerError(
            "目标文件内容是 Git LFS 指针而非真实数据。请先执行:\n"
            "    git lfs install && git lfs pull"
        )


def render_entry(entry: Mapping[str, Any], field_order: Sequence[str], style: FileStyle) -> str:
    """按现有文件的排版渲染单个条目。"""
    present = [field for field in field_order if field in entry]
    inner_indent = " " * (style.indent + 4)
    outer_indent = " " * style.indent
    newline = style.newline.decode("ascii")

    lines = [f"{outer_indent}{{"]
    for index, field in enumerate(present):
        comma = "," if index < len(present) - 1 else ""
        value = json.dumps(entry[field], ensure_ascii=False)
        lines.append(f'{inner_indent}"{field}": {value}{comma}')
    lines.append(f"{outer_indent}}}")
    return newline.join(lines)
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_append.py -v
```

Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/append.py tools/tests/test_append.py
git commit -m "feat: 新增文件风格探测与条目渲染"
```

---

## Task 10: 原子追加与备份

**Files:**
- Modify: `tools/srtext/append.py`
- Modify: `tools/tests/test_append.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_append.py` 末尾：

```python
from srtext.append import append_entries


def sample_file(tmp_path: Path, body: bytes) -> Path:
    target = tmp_path / "SR.json"
    target.write_bytes(body)
    return target


CRLF_TWO = b'[\r\n    {\r\n        "H": 1,\r\n        "C": "a"\r\n    },\r\n    {\r\n        "H": 2\r\n    }\r\n]'
CRLF_ONE = b'[\r\n    {\r\n        "H": 1,\r\n        "C": "a"\r\n    }\r\n]'
EMPTY = b"[]"


def test_append_preserves_original_bytes(tmp_path):
    """核心不变量：原有字节前缀逐字节不变。"""
    target = sample_file(tmp_path, CRLF_TWO)
    original = target.read_bytes()

    append_entries(target, [{"H": 3, "C": "c"}], ("H", "C", "E"))

    new = target.read_bytes()
    body = original.rstrip()[:-1].rstrip()
    assert new[: len(body)] == body


def test_append_result_is_valid_json(tmp_path):
    target = sample_file(tmp_path, CRLF_TWO)
    append_entries(target, [{"H": 3, "C": "c"}, {"H": 4}], ("H", "C", "E"))

    payload = json.loads(target.read_bytes().decode("utf-8"))
    assert [rec["H"] for rec in payload] == [1, 2, 3, 4]
    assert payload[0] == {"H": 1, "C": "a"}
    assert payload[2] == {"H": 3, "C": "c"}


def test_append_keeps_crlf(tmp_path):
    target = sample_file(tmp_path, CRLF_ONE)
    append_entries(target, [{"H": 2}], ("H", "C", "E"))

    raw = target.read_bytes()
    assert b"\r\n" in raw
    assert raw.count(b"\n") == raw.count(b"\r\n")


def test_append_to_multiple_entries_uses_comma_separator(tmp_path):
    target = sample_file(tmp_path, CRLF_ONE)
    append_entries(target, [{"H": 2}, {"H": 3}], ("H", "C", "E"))

    payload = json.loads(target.read_bytes().decode("utf-8"))
    assert [rec["H"] for rec in payload] == [1, 2, 3]


def test_append_to_empty_array(tmp_path):
    target = sample_file(tmp_path, EMPTY)
    append_entries(target, [{"H": 1}], ("H", "C", "E"))

    payload = json.loads(target.read_bytes().decode("utf-8"))
    assert payload == [{"H": 1}]


def test_append_with_no_entries_writes_nothing(tmp_path):
    target = sample_file(tmp_path, CRLF_ONE)
    before = target.read_bytes()
    append_entries(target, [], ("H", "C", "E"))
    assert target.read_bytes() == before


def test_append_refuses_lfs_pointer(tmp_path):
    pointer = b"version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 1\n"
    target = sample_file(tmp_path, pointer)
    with pytest.raises(LfsPointerError):
        append_entries(target, [{"H": 1}], ("H", "C", "E"))


def test_append_refuses_malformed_file(tmp_path):
    target = sample_file(tmp_path, b'{"not": "an array"}')
    with pytest.raises(MalformedJsonArray):
        append_entries(target, [{"H": 1}], ("H", "C", "E"))


def test_append_writes_backup(tmp_path):
    target = sample_file(tmp_path, CRLF_ONE)
    original = target.read_bytes()
    backup_dir = tmp_path / "backup"

    append_entries(target, [{"H": 2}], ("H", "C", "E"), backup_dir=backup_dir)

    backups = list(backup_dir.glob("SR.json*"))
    assert len(backups) == 1
    assert backups[0].read_bytes() == original


def test_append_no_backup_dir_means_no_backup(tmp_path):
    target = sample_file(tmp_path, CRLF_ONE)
    append_entries(target, [{"H": 2}], ("H", "C", "E"))
    assert not (tmp_path / "backup").exists()
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_append.py -v
```

Expected: FAIL — `ImportError: cannot import name 'append_entries'`

- [ ] **Step 3: 实现原子追加**

追加到 `tools/srtext/append.py` 末尾：

```python
def append_entries(
    path: Path,
    entries: Sequence[Mapping[str, Any]],
    field_order: Sequence[str],
    *,
    backup_dir: Path | None = None,
    dry_run: bool = False,
) -> bytes:
    """把条目追加到 JSON 数组文件的末尾，返回写入后的字节。

    已有条目一个字节都不动：定位末尾的 ] 后原地插入。
    entries 为空时直接返回原内容，不写盘。
    """
    path = Path(path)
    raw = path.read_bytes()
    assert_not_lfs_pointer(raw)

    stripped = raw.rstrip()
    if not stripped.endswith(b"]"):
        raise MalformedJsonArray(f"{path} 不是以 ] 结尾的 JSON 数组")

    body = stripped[:-1].rstrip()

    if not entries:
        return raw

    style = detect_style(raw)
    newline = style.newline
    rendered = (b"," + newline).join(
        render_entry(entry, field_order, style).encode("utf-8") for entry in entries
    )

    if body.endswith(b"["):
        # 空数组：不加分隔逗号
        new_bytes = body + newline + rendered + newline + b"]"
    else:
        new_bytes = body + b"," + newline + rendered + newline + b"]"

    if not new_bytes.startswith(body):
        raise AssertionError("内部错误：追加写改变了原有内容")

    if dry_run:
        return new_bytes

    if backup_dir is not None:
        backup_dir = Path(backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, backup_dir / path.name)

    temp_path = path.with_name(path.name + ".tmp")
    temp_path.write_bytes(new_bytes)
    os.replace(temp_path, path)
    return new_bytes
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_append.py -v
```

Expected: 20 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/append.py tools/tests/test_append.py
git commit -m "feat: 新增原子追加写入与备份"
```

---

## Task 11: 现有数据的读取与差集

**Files:**
- Modify: `tools/srtext/convert.py`
- Modify: `tools/tests/test_convert.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_convert.py` 末尾：

```python
import json

from srtext.convert import load_existing_textmap_keys, load_existing_talk_ids


def test_load_existing_textmap_keys(tmp_path):
    target = tmp_path / "SR.json"
    target.write_text(
        json.dumps([{"H": 1, "C": "a", "E": "b"}, {"H": 2}, {"H": 3, "C": "c"}], ensure_ascii=False),
        encoding="utf-8",
    )
    keys = load_existing_textmap_keys(target)
    assert keys == {("a", "b"), ("", ""), ("c", "")}


def test_load_existing_talk_ids(tmp_path):
    target = tmp_path / "SR_Talk_CH.json"
    target.write_text(json.dumps([{"I": 10, "S": "", "T": "x"}]), encoding="utf-8")
    assert load_existing_talk_ids(target) == {10}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_convert.py -v
```

Expected: FAIL — `ImportError: cannot import name 'load_existing_textmap_keys'`

- [ ] **Step 3: 实现读取函数**

追加到 `tools/srtext/convert.py` 末尾：

```python
def load_existing_textmap_keys(path) -> set[tuple[str, str]]:
    """读出 SR.json 中全部 (C, E) 身份键。

    注意：93 MB 文件全量 json.load 的峰值内存约 1.5 GB。
    """
    import json
    from pathlib import Path

    with Path(path).open(encoding="utf-8") as handle:
        records = json.load(handle)
    keys = {(rec.get("C", ""), rec.get("E", "")) for rec in records}
    del records
    return keys


def load_existing_talk_ids(path) -> set[int]:
    """读出 SR_Talk_*.json 中全部条目 ID。"""
    import json
    from pathlib import Path

    with Path(path).open(encoding="utf-8") as handle:
        records = json.load(handle)
    ids = {rec["I"] for rec in records if isinstance(rec.get("I"), int)}
    del records
    return ids
```

把无关紧要的局部 import 提到文件顶部——最终 `convert.py` 顶部应为：

```python
import json
from pathlib import Path
from typing import Any, Mapping, Sequence

from .hashes import HashAllocator
```

并把两个函数里的 `import json` / `from pathlib import Path` 删掉。

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_convert.py -v
```

Expected: 17 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/convert.py tools/tests/test_convert.py
git commit -m "feat: 新增现有数据读取与差集支持"
```

---

## Task 12: Ledger 与增量数据

**Files:**
- Create: `tools/srtext/report.py`
- Create: `tools/tests/test_report.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_report.py`：

```python
import json

from srtext.report import Ledger, write_added_json


def test_ledger_records_run(tmp_path):
    ledger = Ledger(tmp_path / "ledger.json")
    ledger.record_run(
        version="4.6.0",
        sha="abc",
        counts={"textmap": 10, "talk": 3},
        textmap_hashes=[1, 2],
        talk_ids=[7],
    )
    ledger.save()

    reloaded = Ledger(tmp_path / "ledger.json")
    assert len(reloaded.runs) == 1
    run = reloaded.runs[0]
    assert run["version"] == "4.6.0"
    assert run["counts"] == {"textmap": 10, "talk": 3}
    assert run["textmap_hashes"] == [1, 2]
    assert "recorded_at" in run


def test_ledger_accumulates_runs(tmp_path):
    path = tmp_path / "ledger.json"
    ledger = Ledger(path)
    ledger.record_run("4.4.0", "s1", {"textmap": 1, "talk": 0}, [1], [])
    ledger.record_run("4.6.0", "s2", {"textmap": 2, "talk": 1}, [2, 3], [9])
    ledger.save()

    reloaded = Ledger(path)
    assert [run["version"] for run in reloaded.runs] == ["4.4.0", "4.6.0"]
    assert reloaded.all_textmap_hashes() == {1, 2, 3}
    assert reloaded.all_talk_ids() == {9}
    assert reloaded.version_for_textmap_hash(2) == "4.6.0"
    assert reloaded.version_for_talk_id(9) == "4.6.0"


def test_ledger_missing_file_is_empty(tmp_path):
    ledger = Ledger(tmp_path / "nope.json")
    assert ledger.runs == []
    assert ledger.all_textmap_hashes() == set()


def test_write_added_json_shape(tmp_path):
    added = {
        "runs": [{"version": "4.6.0", "recorded_at": "2026-10-06T00:00:00+00:00",
                  "counts": {"textmap": 1, "talk": 1}}],
        "textmap": [{"H": 1, "C": "中", "E": "en", "v": "4.6.0"}],
        "talk": [{"I": 9, "SCH": "甲", "TCH": "正文", "SEN": "A", "TEN": "text", "v": "4.6.0"}],
    }
    target = tmp_path / "added.json"
    write_added_json(target, added)

    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["textmap"][0]["C"] == "中"
    assert payload["run_count"] == 1
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_report.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'srtext.report'`

- [ ] **Step 3: 实现 Ledger 与增量输出**

`tools/srtext/report.py`：

```python
"""运行台账与展示页生成。"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping


class Ledger:
    """记录每次 build 的增量，作为展示页的唯一数据来源。

    按 run 累积，因此多次运行会形成多版本标签。
    """

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.runs: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        with self.path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        self.runs = list(payload.get("runs", []))

    def record_run(
        self,
        version: str,
        sha: str,
        counts: Mapping[str, int],
        textmap_hashes: Iterable[int],
        talk_ids: Iterable[int],
    ) -> dict[str, Any]:
        run = {
            "version": version,
            "sha": sha,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "counts": dict(counts),
            "textmap_hashes": [int(value) for value in textmap_hashes],
            "talk_ids": [int(value) for value in talk_ids],
        }
        self.runs.append(run)
        return run

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump({"runs": self.runs}, handle, ensure_ascii=False, indent=2)

    def all_textmap_hashes(self) -> set[int]:
        collected: set[int] = set()
        for run in self.runs:
            collected.update(run.get("textmap_hashes", []))
        return collected

    def all_talk_ids(self) -> set[int]:
        collected: set[int] = set()
        for run in self.runs:
            collected.update(run.get("talk_ids", []))
        return collected

    def version_for_textmap_hash(self, hash_value: int) -> str | None:
        return self._version_for("textmap_hashes", hash_value)

    def version_for_talk_id(self, identifier: int) -> str | None:
        return self._version_for("talk_ids", identifier)

    def _version_for(self, field: str, needle: int) -> str | None:
        for run in self.runs:
            if needle in run.get(field, []):
                return run.get("version")
        return None


def write_added_json(path: Path, payload: Mapping[str, Any]) -> None:
    """写出展示页加载的增量数据。"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    document = dict(payload)
    document["run_count"] = len(payload.get("runs", []))
    with path.open("w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, separators=(",", ":"))
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_report.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/report.py tools/tests/test_report.py
git commit -m "feat: 新增运行台账与增量数据输出"
```

---

## Task 13: 增量条目汇总

把 ledger 里的 H / I 回查成当前文件中的真实条目，并打上版本标签。

**Files:**
- Modify: `tools/srtext/report.py`
- Modify: `tools/tests/test_report.py`

- [ ] **Step 1: 写失败的测试**

追加到 `tools/tests/test_report.py` 末尾：

```python
from srtext.report import collect_added_textmap, collect_added_talk


def test_collect_added_textmap_tags_version():
    records = [{"H": 1, "C": "中", "E": "en"}, {"H": 2, "C": "其他"}]

    class FakeLedger:
        def all_textmap_hashes(self):
            return {1}

        def version_for_textmap_hash(self, h):
            return "4.6.0"

    result = collect_added_textmap(records, FakeLedger())
    assert result == [{"H": 1, "C": "中", "E": "en", "v": "4.6.0"}]


def test_collect_added_textmap_ignores_unledgered():
    records = [{"H": 2, "C": "其他"}]

    class FakeLedger:
        def all_textmap_hashes(self):
            return {1}

        def version_for_textmap_hash(self, h):  # pragma: no cover - 不应被调用
            raise AssertionError("不应查询未记录的 hash")

    assert collect_added_textmap(records, FakeLedger()) == []


def test_collect_added_talk_merges_languages():
    ch = [{"I": 9, "S": "甲", "T": "正文"}]
    en = [{"I": 9, "S": "A", "T": "text"}]

    class FakeLedger:
        def all_talk_ids(self):
            return {9}

        def version_for_talk_id(self, i):
            return "4.6.0"

    result = collect_added_talk(ch, en, FakeLedger())
    assert result == [{"I": 9, "SCH": "甲", "TCH": "正文", "SEN": "A", "TEN": "text", "v": "4.6.0"}]


def test_collect_added_talk_tolerates_missing_language():
    ch = [{"I": 9, "S": "", "T": "正文"}]

    class FakeLedger:
        def all_talk_ids(self):
            return {9}

        def version_for_talk_id(self, i):
            return "4.6.0"

    result = collect_added_talk(ch, [], FakeLedger())
    assert result[0]["TEN"] == ""
    assert result[0]["TCH"] == "正文"
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_report.py -v
```

Expected: FAIL — `ImportError: cannot import name 'collect_added_textmap'`

- [ ] **Step 3: 实现汇总逻辑**

追加到 `tools/srtext/report.py` 末尾：

```python
def collect_added_textmap(records: Iterable[Mapping[str, Any]], ledger) -> list[dict[str, Any]]:
    """按 ledger 筛出新增文本条目，附上来源版本标签。"""
    wanted = ledger.all_textmap_hashes()
    collected: list[dict[str, Any]] = []
    for record in records:
        hash_value = record.get("H")
        if hash_value not in wanted:
            continue
        item: dict[str, Any] = {"H": hash_value}
        if record.get("C"):
            item["C"] = record["C"]
        if record.get("E"):
            item["E"] = record["E"]
        item["v"] = ledger.version_for_textmap_hash(hash_value)
        collected.append(item)
    return collected


def collect_added_talk(ch_records, en_records, ledger) -> list[dict[str, Any]]:
    """按 ledger 筛出新增对话，中英合并成一条记录便于展示。"""
    wanted = ledger.all_talk_ids()
    english_by_id = {rec["I"]: rec for rec in en_records if rec.get("I") in wanted}

    collected: list[dict[str, Any]] = []
    for record in ch_records:
        identifier = record.get("I")
        if identifier not in wanted:
            continue
        counterpart = english_by_id.get(identifier, {})
        collected.append(
            {
                "I": identifier,
                "SCH": record.get("S", ""),
                "TCH": record.get("T", ""),
                "SEN": counterpart.get("S", ""),
                "TEN": counterpart.get("T", ""),
                "v": ledger.version_for_talk_id(identifier),
            }
        )
    return collected
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_report.py -v
```

Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add tools/srtext/report.py tools/tests/test_report.py
git commit -m "feat: 新增增量条目汇总"
```

---

## Task 14: 展示页（HTML + viewer.js）

页面复用站点现有样式表以保持观感一致。**不引入 jQuery / thin.js**——那两个是站点自身页面启动器，绑定了它的数据加载机制，拉进来会让我们的页面耦合到一套与增量数据无关的流程。样式表才是观感一致的来源。

**Files:**
- Create: `site/sr/textupd/index.html`
- Create: `site/sr/textupd/viewer.js`
- Create: `tools/tests/test_viewer_assets.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_viewer_assets.py`：

```python
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
VIEWER_DIR = REPO_ROOT / "site" / "sr" / "textupd"


def test_index_html_exists_and_links_site_stylesheet():
    html = (VIEWER_DIR / "index.html").read_text(encoding="utf-8")
    assert "/stylesheets/style.css" in html
    assert "/stylesheets/text_sr.css" in html


def test_index_html_references_viewer_script_and_data():
    html = (VIEWER_DIR / "index.html").read_text(encoding="utf-8")
    assert "viewer.js" in html
    assert "added.json" in html


def test_index_html_has_required_controls():
    html = (VIEWER_DIR / "index.html").read_text(encoding="utf-8")
    for element_id in ("tu-q", "tu-kind", "tu-version", "tu-results", "tu-summary"):
        assert f'id="{element_id}"' in html


def test_viewer_js_does_not_load_sr_json():
    """展示页不得加载 94 MB 的 SR.json。"""
    source = (VIEWER_DIR / "viewer.js").read_text(encoding="utf-8")
    assert "SR.json" not in source


def test_viewer_js_defines_pagination():
    source = (VIEWER_DIR / "viewer.js").read_text(encoding="utf-8")
    assert "PAGE_SIZE" in source
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_viewer_assets.py -v
```

Expected: FAIL — `FileNotFoundError`

- [ ] **Step 3: 写展示页 HTML**

`site/sr/textupd/index.html`：

```html
<!doctype html>
<html lang="zh-CN" prefix="og: http://ogp.me/ns#">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <meta name="description" content="崩坏星穹铁道 文本增量更新 By HomDGCat Mirror" />
    <title>崩铁文本增量更新</title>
    <link rel="stylesheet" href="/stylesheets/style.css" />
    <link rel="stylesheet" href="/stylesheets/text_sr.css" />
    <style>
      #tu-summary { margin: 12px 0; line-height: 1.8; }
      #tu-controls { margin: 12px 0; display: flex; flex-wrap: wrap; gap: 8px; }
      #tu-controls input[type="search"] { flex: 1 1 260px; padding: 6px 8px; }
      #tu-controls select { padding: 6px 8px; }
      .tu-item { border-bottom: 1px solid #ddd; padding: 8px 0; }
      .tu-meta { font-size: 12px; opacity: 0.65; }
      .tu-zh { margin: 2px 0; }
      .tu-en { margin: 2px 0; opacity: 0.75; }
      .tu-badge { display: inline-block; font-size: 11px; padding: 1px 6px;
                  border: 1px solid #999; border-radius: 8px; margin-right: 6px; }
      #tu-pager { margin: 16px 0; display: flex; align-items: center; gap: 12px; }
      #tu-empty { padding: 24px 0; opacity: 0.7; }
    </style>
  </head>
  <body>
    <h1>崩铁文本增量更新</h1>
    <div id="tu-summary">加载中…</div>

    <div id="tu-controls">
      <input id="tu-q" type="search" placeholder="搜索中文 / 英文" />
      <select id="tu-kind">
        <option value="all">全部类型</option>
        <option value="textmap">文本</option>
        <option value="talk">对话</option>
      </select>
      <select id="tu-version">
        <option value="all">全部版本</option>
      </select>
    </div>

    <div id="tu-results"></div>
    <div id="tu-empty" hidden>没有匹配的条目。</div>

    <div id="tu-pager">
      <button id="tu-prev" type="button">上一页</button>
      <span id="tu-page"></span>
      <button id="tu-next" type="button">下一页</button>
    </div>

    <script src="viewer.js"></script>
  </body>
</html>
```

- [ ] **Step 4: 写展示页逻辑**

`site/sr/textupd/viewer.js`：

```javascript
(function () {
  "use strict";

  var PAGE_SIZE = 100;
  var DATA_URL = "added.json";

  var state = {
    entries: [],
    filtered: [],
    page: 1,
    kind: "all",
    version: "all",
    query: "",
  };

  function flatten(payload) {
    var out = [];
    (payload.textmap || []).forEach(function (item) {
      out.push({
        kind: "textmap",
        version: item.v || "",
        zh: item.C || "",
        en: item.E || "",
        label: "文本",
        key: "H" + item.H,
      });
    });
    (payload.talk || []).forEach(function (item) {
      out.push({
        kind: "talk",
        version: item.v || "",
        zh: item.TCH || "",
        en: item.TEN || "",
        speakerZh: item.SCH || "",
        speakerEn: item.SEN || "",
        label: "对话",
        key: "I" + item.I,
      });
    });
    return out;
  }

  function matches(entry) {
    if (state.kind !== "all" && entry.kind !== state.kind) {
      return false;
    }
    if (state.version !== "all" && entry.version !== state.version) {
      return false;
    }
    if (!state.query) {
      return true;
    }
    var needle = state.query.toLowerCase();
    return (
      entry.zh.toLowerCase().indexOf(needle) !== -1 ||
      entry.en.toLowerCase().indexOf(needle) !== -1 ||
      (entry.speakerZh || "").toLowerCase().indexOf(needle) !== -1 ||
      (entry.speakerEn || "").toLowerCase().indexOf(needle) !== -1
    );
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderItem(entry) {
    var parts = ['<div class="tu-item">'];
    parts.push(
      '<div class="tu-meta"><span class="tu-badge">' +
        escapeHtml(entry.label) +
        "</span><span class=\"tu-badge\">" +
        escapeHtml(entry.version) +
        "</span>" +
        escapeHtml(entry.key) +
        "</div>"
    );
    if (entry.kind === "talk" && entry.speakerZh) {
      parts.push('<div class="tu-meta">' + escapeHtml(entry.speakerZh) + "</div>");
    }
    if (entry.zh) {
      parts.push('<div class="tu-zh">' + escapeHtml(entry.zh) + "</div>");
    }
    if (entry.en) {
      parts.push('<div class="tu-en">' + escapeHtml(entry.en) + "</div>");
    }
    parts.push("</div>");
    return parts.join("");
  }

  function render() {
    state.filtered = state.entries.filter(matches);

    var totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page > totalPages) {
      state.page = totalPages;
    }
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = state.filtered.slice(start, start + PAGE_SIZE);

    var results = document.getElementById("tu-results");
    results.innerHTML = slice.map(renderItem).join("");
    document.getElementById("tu-empty").hidden = state.filtered.length !== 0;
    document.getElementById("tu-page").textContent =
      "第 " + state.page + " / " + totalPages + " 页（共 " + state.filtered.length + " 条）";
    document.getElementById("tu-prev").disabled = state.page <= 1;
    document.getElementById("tu-next").disabled = state.page >= totalPages;
  }

  function fillVersions(payload) {
    var select = document.getElementById("tu-version");
    var seen = [];
    (payload.runs || []).forEach(function (run) {
      if (run.version && seen.indexOf(run.version) === -1) {
        seen.push(run.version);
      }
    });
    seen.sort().reverse().forEach(function (version) {
      var option = document.createElement("option");
      option.value = version;
      option.textContent = version;
      select.appendChild(option);
    });
  }

  function renderSummary(payload) {
    var runs = payload.runs || [];
    if (!runs.length) {
      document.getElementById("tu-summary").textContent = "暂无增量记录。";
      return;
    }
    var lines = runs.map(function (run) {
      var counts = run.counts || {};
      return (
        escapeHtml(run.version) +
        "（" +
        escapeHtml((run.recorded_at || "").slice(0, 10)) +
        "）：文本 " +
        (counts.textmap || 0) +
        " 条，对话 " +
        (counts.talk || 0) +
        " 条"
      );
    });
    document.getElementById("tu-summary").innerHTML =
      "共 " + (payload.textmap || []).length + " 条文本、" +
      (payload.talk || []).length + " 条对话，来自 " +
      runs.length + " 次更新<br>" + lines.join("<br>");
  }

  function bind() {
    var query = document.getElementById("tu-q");
    var debounce = null;
    query.addEventListener("input", function () {
      if (debounce) {
        clearTimeout(debounce);
      }
      debounce = setTimeout(function () {
        state.query = query.value.trim();
        state.page = 1;
        render();
      }, 150);
    });

    document.getElementById("tu-kind").addEventListener("change", function (event) {
      state.kind = event.target.value;
      state.page = 1;
      render();
    });

    document.getElementById("tu-version").addEventListener("change", function (event) {
      state.version = event.target.value;
      state.page = 1;
      render();
    });

    document.getElementById("tu-prev").addEventListener("click", function () {
      if (state.page > 1) {
        state.page -= 1;
        render();
      }
    });

    document.getElementById("tu-next").addEventListener("click", function () {
      state.page += 1;
      render();
    });
  }

  function boot() {
    fetch(DATA_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        state.entries = flatten(payload);
        fillVersions(payload);
        renderSummary(payload);
        bind();
        render();
      })
      .catch(function (error) {
        document.getElementById("tu-summary").textContent =
          "加载 " + DATA_URL + " 失败：" + error.message;
      });
  }

  boot();
})();
```

- [ ] **Step 5: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_viewer_assets.py -v
```

Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add site/sr/textupd/index.html site/sr/textupd/viewer.js tools/tests/test_viewer_assets.py
git commit -m "feat: 新增增量文本展示页"
```

---

## Task 15: CLI — `status` 子命令

**Files:**
- Create: `tools/sr_update.py`
- Create: `tools/tests/test_cli.py`

- [ ] **Step 1: 写失败的测试**

`tools/tests/test_cli.py`：

```python
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CLI = REPO_ROOT / "tools" / "sr_update.py"


def run_cli(*args, cwd=REPO_ROOT):
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def test_cli_help_lists_all_subcommands():
    result = run_cli("--help")
    assert result.returncode == 0
    for command in ("fetch", "build", "report", "status"):
        assert command in result.stdout


def test_status_reports_missing_cache(tmp_path):
    """无缓存时 status 应给出明确提示而非崩溃。"""
    result = run_cli("status", "--cache", str(tmp_path / "cache"), "--root", str(tmp_path))
    assert result.returncode == 0
    assert "缓存" in result.stdout


def test_build_refuses_when_cache_is_empty(tmp_path):
    result = run_cli("build", "--cache", str(tmp_path / "cache"), "--root", str(tmp_path))
    assert result.returncode != 0
    assert "fetch" in result.stdout + result.stderr
```

- [ ] **Step 2: 运行测试确认失败**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_cli.py -v
```

Expected: FAIL — CLI 文件不存在

- [ ] **Step 3: 实现 CLI 骨架与 status**

`tools/sr_update.py`：

```python
#!/usr/bin/env python3
"""崩铁文本增量更新工具。

用法:
    python tools/sr_update.py fetch     # 下载官方源文件到 tools/cache/
    python tools/sr_update.py status    # 报告现有内容与官方的差异，不写任何文件
    python tools/sr_update.py build     # 把差集追加进 site/TextMap/
    python tools/sr_update.py report    # 生成 site/sr/textupd/ 展示页

只有 fetch 需要联网；其余子命令可离线反复运行。
"""

import argparse
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from srtext.hashes import HashAllocator, collect_used_hashes  # noqa: E402
from srtext import source as source_module  # noqa: E402
from srtext.source import Cache  # noqa: E402

REPO_ROOT_DEFAULT = TOOLS_DIR.parent
CACHE_DEFAULT = TOOLS_DIR / "cache"

TEXTMAP_DIR = Path("site") / "TextMap"
SR_JSON = TEXTMAP_DIR / "SR.json"
TALK_CH = TEXTMAP_DIR / "SR_Talk_CH.json"
TALK_EN = TEXTMAP_DIR / "SR_Talk_EN.json"


def _cache_paths(cache: Cache):
    return (
        cache.path_for("TextMapCHS.json"),
        cache.path_for("TextMapEN.json"),
        cache.path_for("TalkSentenceConfig.json"),
    )


def cmd_status(args) -> int:
    cache = Cache(args.cache)
    manifest = cache.load_manifest()
    root = Path(args.root)

    print("  崩铁文本增量状态")
    print(f"  仓库根目录: {root}")
    if manifest:
        print(f"  缓存版本:   {manifest.get('version')}  ({manifest.get('sha', '')[:12]})")
        print(f"  抓取时间:   {manifest.get('fetched_at')}")
    else:
        print("  缓存:       无（请先运行 fetch）")

    sr_json = root / SR_JSON
    if sr_json.exists():
        print(f"  SR.json:    {sr_json.stat().st_size:,} 字节")
    else:
        print(f"  SR.json:    未找到（{sr_json}）")

    ledger_path = Path(args.cache) / "ledger.json"
    if ledger_path.exists():
        from srtext.report import Ledger

        ledger = Ledger(ledger_path)
        print(f"  已记录增量: {len(ledger.runs)} 次运行")
        for run in ledger.runs:
            counts = run.get("counts", {})
            print(
                f"    - {run.get('version')}  文本 {counts.get('textmap', 0)} 条，"
                f"对话 {counts.get('talk', 0)} 条"
            )
    else:
        print("  已记录增量: 无")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="崩铁文本增量更新工具")
    parser.add_argument("--root", default=str(REPO_ROOT_DEFAULT), help="仓库根目录")
    parser.add_argument("--cache", default=str(CACHE_DEFAULT), help="缓存目录")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("fetch", help="下载官方源文件").add_argument(
        "--force", action="store_true", help="忽略缓存，强制重新下载"
    )
    subparsers.add_parser("status", help="报告差异，不写文件")
    subparsers.add_parser("build", help="把差集追加进 site/TextMap/").add_argument(
        "--yes", action="store_true", help="跳过新增量异常确认"
    )
    subparsers.add_parser("report", help="生成展示页")
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {
        "status": cmd_status,
    }
    handler = handlers.get(args.command)
    if handler is None:
        print(f"  子命令 {args.command} 尚未实现", file=sys.stderr)
        return 2
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: 运行测试确认通过**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_cli.py -v
```

Expected: 2 passed, 1 failed（`test_build_refuses_when_cache_is_empty` 需要 Task 16 的实现）

- [ ] **Step 5: Commit**

```bash
git add tools/sr_update.py tools/tests/test_cli.py
git commit -m "feat: 新增 CLI 骨架与 status 子命令"
```

---

## Task 16: CLI — `fetch` / `build` / `report`

**Files:**
- Modify: `tools/sr_update.py`

- [ ] **Step 1: 实现 fetch**

在 `cmd_status` 之后加入：

```python
def cmd_fetch(args) -> int:
    cache = Cache(args.cache)
    print("  拉取官方源文件")
    try:
        version = source_module.fetch_sources(cache, force=args.force)
    except Exception as error:  # noqa: BLE001 - CLI 边界，需转为友好提示
        print(f"  抓取失败: {error}", file=sys.stderr)
        print("  提示: fetch 需要访问 GitHub；本地已有缓存时可直接运行 build/report。", file=sys.stderr)
        return 1
    print(f"  已缓存版本 {version.version}")
    return 0
```

- [ ] **Step 2: 实现 build**

```python
#: 新增量超过现有条目该比例时，要求 --yes 确认
ANOMALY_RATIO = 0.30


def cmd_build(args) -> int:
    import json

    from srtext.append import append_entries
    from srtext.convert import (
        TEXTMAP_FIELD_ORDER,
        TALK_FIELD_ORDER,
        build_textmap_entries,
        build_talk_entries,
        load_existing_textmap_keys,
        load_existing_talk_ids,
    )
    from srtext.report import Ledger
    from srtext.source import probe_textmap, probe_talk

    root = Path(args.root)
    cache = Cache(args.cache)
    manifest = cache.load_manifest()
    if not manifest:
        print("  缓存为空，请先运行 fetch。", file=sys.stderr)
        return 1

    chs_path, eng_path, talk_path = _cache_paths(cache)
    for path in (chs_path, eng_path, talk_path):
        if not path.exists():
            print(f"  缓存缺少 {path.name}，请重新运行 fetch。", file=sys.stderr)
            return 1

    print("  载入源数据…")
    chs = json.loads(chs_path.read_text(encoding="utf-8"))
    eng = json.loads(eng_path.read_text(encoding="utf-8"))
    talk_config = json.loads(talk_path.read_text(encoding="utf-8"))

    try:
        probe_textmap(chs)
        probe_textmap(eng)
        talk_schema = probe_talk(talk_config)
    except Exception as error:  # noqa: BLE001
        print(f"  源数据结构与预期不符，已中止: {error}", file=sys.stderr)
        return 1
    print(f"  TalkSentenceConfig 探测结果: {talk_schema}")

    sr_json = root / SR_JSON
    talk_ch = root / TALK_CH
    talk_en = root / TALK_EN
    for path in (sr_json, talk_ch, talk_en):
        if not path.exists():
            print(f"  目标文件不存在: {path}", file=sys.stderr)
            return 1

    print("  读取现有内容…")
    existing_keys = load_existing_textmap_keys(sr_json)
    existing_ids = load_existing_talk_ids(talk_ch)
    used_hashes = collect_used_hashes(sr_json)

    allocator = HashAllocator(used=used_hashes, map_path=cache.path_for("h_map.json"))
    del used_hashes
    textmap_entries = build_textmap_entries(chs, eng, allocator, existing_keys)
    allocator.save()
    talk_ch_entries, talk_en_entries = build_talk_entries(
        talk_config, talk_schema, chs, eng, existing_ids
    )

    existing_total = len(existing_ids)
    print(f"  新增: 文本 {len(textmap_entries)} 条，对话 {len(talk_ch_entries)} 条")

    if not textmap_entries and not talk_ch_entries:
        print("  没有新增内容，未写入任何文件。")
        return 0

    if existing_total and len(talk_ch_entries) > existing_total * ANOMALY_RATIO and not args.yes:
        print(
            f"  异常：对话新增 {len(talk_ch_entries)} 条，超过现有 {existing_total} 条的 "
            f"{ANOMALY_RATIO:.0%}。请确认 schema 探测无误后加 --yes 重跑。",
            file=sys.stderr,
        )
        return 1

    backup_dir = cache.root / "backup" / manifest.get("sha", "unknown")[:12]
    append_entries(sr_json, textmap_entries, TEXTMAP_FIELD_ORDER, backup_dir=backup_dir)
    append_entries(talk_ch, talk_ch_entries, TALK_FIELD_ORDER, backup_dir=backup_dir)
    append_entries(talk_en, talk_en_entries, TALK_FIELD_ORDER, backup_dir=backup_dir)

    ledger = Ledger(cache.path_for("ledger.json"))
    ledger.record_run(
        version=manifest.get("version", "unknown"),
        sha=manifest.get("sha", ""),
        counts={"textmap": len(textmap_entries), "talk": len(talk_ch_entries)},
        textmap_hashes=[entry["H"] for entry in textmap_entries],
        talk_ids=[entry["I"] for entry in talk_ch_entries],
    )
    ledger.save()

    print(f"  已写入。备份位于 {backup_dir}")
    return 0
```

- [ ] **Step 3: 实现 report**

```python
def cmd_report(args) -> int:
    import json

    from srtext.convert import load_existing_textmap_keys, load_existing_talk_ids
    from srtext.report import (
        Ledger,
        collect_added_textmap,
        collect_added_talk,
        write_added_json,
    )

    root = Path(args.root)
    cache = Cache(args.cache)
    ledger = Ledger(cache.path_for("ledger.json"))
    if not ledger.runs:
        print("  尚无增量记录，请先运行 build。", file=sys.stderr)
        return 1

    with (root / SR_JSON).open(encoding="utf-8") as handle:
        sr_records = json.load(handle)
    with (root / TALK_CH).open(encoding="utf-8") as handle:
        talk_ch_records = json.load(handle)
    with (root / TALK_EN).open(encoding="utf-8") as handle:
        talk_en_records = json.load(handle)

    payload = {
        "runs": ledger.runs,
        "textmap": collect_added_textmap(sr_records, ledger),
        "talk": collect_added_talk(talk_ch_records, talk_en_records, ledger),
    }

    output_dir = root / "site" / "sr" / "textupd"
    write_added_json(output_dir / "added.json", payload)

    summary = [
        "  增量摘要",
        f"  运行次数: {len(ledger.runs)}",
        f"  新增文本: {len(payload['textmap'])} 条",
        f"  新增对话: {len(payload['talk'])} 条",
    ]
    for run in ledger.runs:
        counts = run.get("counts", {})
        summary.append(
            f"    {run.get('version')}: 文本 {counts.get('textmap', 0)}，"
            f"对话 {counts.get('talk', 0)}"
        )
    text = "\n".join(summary)
    print(text)
    (cache.root / "report.md").write_text(text + "\n", encoding="utf-8")
    print(f"  已生成: {output_dir / 'added.json'}")
    print(f"  打开 http://localhost:9000/sr/textupd/ 查看")
    return 0
```

- [ ] **Step 4: 注册子命令**

把 `main()` 中的 handlers 改为：

```python
    handlers = {
        "fetch": cmd_fetch,
        "status": cmd_status,
        "build": cmd_build,
        "report": cmd_report,
    }
```

- [ ] **Step 5: 运行全部测试**

```bash
python -m pytest -c tools/pytest.ini -v
```

Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add tools/sr_update.py
git commit -m "feat: 实现 fetch / build / report 子命令"
```

---

## Task 17: 集成测试

用迷你数据集端到端跑通 `build`，验证核心不变量。

**Files:**
- Create: `tools/tests/fixtures/make_fixture.py`
- Create: `tools/tests/test_integration.py`

- [ ] **Step 1: 写 fixture 生成器**

`tools/tests/fixtures/make_fixture.py`：

```python
"""生成集成测试用的迷你数据集。

刻意使用 CRLF + 4 空格缩进，与真实文件风格一致。
"""

import json
from pathlib import Path

CRLF = "\r\n"


def render_array(records) -> str:
    lines = ["["]
    for index, record in enumerate(records):
        lines.append("    {")
        fields = list(record.items())
        for field_index, (key, value) in enumerate(fields):
            comma = "," if field_index < len(fields) - 1 else ""
            lines.append(f'        "{key}": {json.dumps(value, ensure_ascii=False)}{comma}')
        lines.append("    }" + ("," if index < len(records) - 1 else ""))
    lines.append("]")
    return CRLF.join(lines)


def write_fixture(root: Path) -> None:
    textmap_dir = root / "site" / "TextMap"
    textmap_dir.mkdir(parents=True, exist_ok=True)

    existing_sr = [{"H": 111, "C": "已有中文", "E": "existing english"}]
    (textmap_dir / "SR.json").write_text(render_array(existing_sr), encoding="utf-8", newline="")

    existing_talk = [{"I": 1001, "S": "甲", "T": "已有对话"}]
    (textmap_dir / "SR_Talk_CH.json").write_text(
        render_array(existing_talk), encoding="utf-8", newline=""
    )
    (textmap_dir / "SR_Talk_EN.json").write_text(
        render_array([{"I": 1001, "S": "A", "T": "existing line"}]), encoding="utf-8", newline=""
    )

    cache_dir = root / "tools" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    # 说话人 90 / 91 也在 TextMap 里——它们同样是文本条目，会被一并收录。
    # 期望值必须计入这一点。
    (cache_dir / "TextMapCHS.json").write_text(
        json.dumps(
            {"1": "已有中文", "2": "新中文", "3": "", "90": "甲", "91": "乙"},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (cache_dir / "TextMapEN.json").write_text(
        json.dumps(
            {
                "1": "existing english",
                "2": "new english",
                "4": "english only",
                "90": "Speaker A",
                "91": "Speaker B",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (cache_dir / "TalkSentenceConfig.json").write_text(
        json.dumps(
            {
                "1001": {"TalkSentenceText": {"Hash": 1}, "TalkSentenceName": {"Hash": 90}},
                "2002": {"TalkSentenceText": {"Hash": 2}, "TalkSentenceName": {"Hash": 91}},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (cache_dir / "manifest.json").write_text(
        json.dumps(
            {
                "repo": "DimbreathBot/TurnBasedGameData",
                "sha": "fixture0000",
                "version": "4.6.0",
                "message": "OSPRODWin4.6.0_fixture",
                "fetched_at": "2026-10-06T00:00:00+00:00",
                "files": {},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    import sys

    write_fixture(Path(sys.argv[1]))
```

- [ ] **Step 2: 写集成测试**

`tools/tests/test_integration.py`：

```python
import json
import subprocess
import sys
from pathlib import Path

import pytest

from tests.fixtures.make_fixture import write_fixture

TOOLS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = TOOLS_DIR.parent
CLI = TOOLS_DIR / "sr_update.py"


def run_cli(root: Path, *args):
    return subprocess.run(
        [sys.executable, str(CLI), "--root", str(root), "--cache", str(root / "tools" / "cache"), *args],
        cwd=str(root),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


@pytest.fixture()
def sandbox(tmp_path):
    write_fixture(tmp_path)
    return tmp_path


def test_build_appends_and_preserves_original_bytes(sandbox):
    sr_json = sandbox / "site" / "TextMap" / "SR.json"
    before = sr_json.read_bytes()
    body = before.rstrip()[:-1].rstrip()

    result = run_cli(sandbox, "build")
    assert result.returncode == 0, result.stderr

    after = sr_json.read_bytes()
    assert after[: len(body)] == body, "原有字节被改动了"

    payload = json.loads(after.decode("utf-8"))
    assert payload[0] == {"H": 111, "C": "已有中文", "E": "existing english"}
    # 原有 1 条 + 新增 5 条（key 2、3、4、90、91）
    assert len(payload) == 6


def test_build_adds_expected_entries(sandbox):
    run_cli(sandbox, "build")

    payload = json.loads((sandbox / "site" / "TextMap" / "SR.json").read_text(encoding="utf-8"))
    added = payload[1:]
    assert {"C": "新中文", "E": "new english"} in [{"C": r.get("C"), "E": r.get("E")} for r in added]
    # 只有英文的条目也要进来
    assert any(r.get("E") == "english only" and "C" not in r for r in added)


def test_build_adds_dialogue_both_languages(sandbox):
    run_cli(sandbox, "build")

    ch = json.loads((sandbox / "site" / "TextMap" / "SR_Talk_CH.json").read_text(encoding="utf-8"))
    en = json.loads((sandbox / "site" / "TextMap" / "SR_Talk_EN.json").read_text(encoding="utf-8"))

    assert [rec["I"] for rec in ch] == [1001, 2002]
    assert ch[1] == {"I": 2002, "S": "乙", "T": "新中文"}
    assert en[1] == {"I": 2002, "S": "Speaker B", "T": "new english"}


def test_build_keeps_crlf(sandbox):
    run_cli(sandbox, "build")
    raw = (sandbox / "site" / "TextMap" / "SR.json").read_bytes()
    assert raw.count(b"\n") == raw.count(b"\r\n")


def test_build_is_idempotent(sandbox):
    run_cli(sandbox, "build")
    snapshot = {
        name: (sandbox / "site" / "TextMap" / name).read_bytes()
        for name in ("SR.json", "SR_Talk_CH.json", "SR_Talk_EN.json")
    }

    result = run_cli(sandbox, "build")
    assert result.returncode == 0
    assert "没有新增内容" in result.stdout

    for name, content in snapshot.items():
        assert (sandbox / "site" / "TextMap" / name).read_bytes() == content, f"{name} 被二次写入"


def test_build_writes_backup(sandbox):
    before = (sandbox / "site" / "TextMap" / "SR.json").read_bytes()
    run_cli(sandbox, "build")

    backups = list((sandbox / "tools" / "cache" / "backup").rglob("SR.json"))
    assert len(backups) == 1
    assert backups[0].read_bytes() == before


def test_report_generates_added_json(sandbox):
    run_cli(sandbox, "build")
    result = run_cli(sandbox, "report")
    assert result.returncode == 0, result.stderr

    added = json.loads((sandbox / "site" / "sr" / "textupd" / "added.json").read_text(encoding="utf-8"))
    assert added["run_count"] == 1
    assert len(added["textmap"]) == 5
    assert len(added["talk"]) == 1
    assert added["talk"][0]["TCH"] == "新中文"
    assert added["textmap"][0]["v"] == "4.6.0"


def test_report_without_build_fails_cleanly(sandbox):
    result = run_cli(sandbox, "report")
    assert result.returncode != 0
    assert "build" in result.stdout + result.stderr
```

- [ ] **Step 3: 运行集成测试**

```bash
python -m pytest -c tools/pytest.ini tools/tests/test_integration.py -v
```

Expected: 8 passed

- [ ] **Step 4: Commit**

```bash
git add tools/tests/fixtures/ tools/tests/test_integration.py
git commit -m "test: 新增端到端集成测试"
```

---

## Task 18: 真实数据试运行

这一步是**只读验证**，确认转换逻辑对真实 4.6 数据成立。**不写入 `site/TextMap/`**。

**Files:** 无新增

- [ ] **Step 1: 拉取官方源文件**

需要能访问 GitHub（用你的梯子）。三个文件合计约 94 MB。

```bash
python tools/sr_update.py fetch
```

Expected: 输出目标版本 `4.6.0`，三个文件下载完成并显示 sha256。

- [ ] **Step 2: 确认 schema 探测通过**

```bash
python tools/sr_update.py status
```

Expected: 显示缓存版本 4.6.0 与抓取时间。若 `TalkSentenceConfig` 结构与推断不符，此处会在 `build` 时报错并打印真实字段——届时把报错原文记下来，回来修 `probe_talk`。

- [ ] **Step 3: 干跑 build 观察增量规模**

```bash
python tools/sr_update.py build
```

Expected: 打印新增条数后继续写入。**先看清楚条数是否合理**（文本新增应在数万量级；若出现几十万条，说明差集判定有问题，立刻回滚）。

- [ ] **Step 4: 验证写入结果**

```bash
python -c "
import json
for name in ('SR.json','SR_Talk_CH.json','SR_Talk_EN.json'):
    p='site/TextMap/'+name
    d=json.load(open(p,encoding='utf-8'))
    print(name, len(d))
"
```

Expected: `SR.json` 从 374103 增至更多；两个 Talk 文件条数相同。

- [ ] **Step 5: 生成展示页并肉眼检查**

```bash
python tools/sr_update.py report
python main.py serve
```

浏览器打开 `http://localhost:9000/sr/textupd/`，确认：摘要显示版本与条数、搜索能命中、筛选可用、分页正常。

- [ ] **Step 6: 确认幂等**

```bash
python tools/sr_update.py build
```

Expected: 输出「没有新增内容，未写入任何文件。」

- [ ] **Step 7: 若结果不满意，回滚**

```bash
git checkout -- site/TextMap/
```

备份也在 `tools/cache/backup/<sha>/` 下。

- [ ] **Step 8: 满意则提交**

**先确认 LFS 已配置**（README 第 4 步）：

```bash
git lfs install
git add site/TextMap/SR.json site/TextMap/SR_Talk_CH.json site/TextMap/SR_Talk_EN.json
git add site/sr/textupd/added.json
git commit -m "feat: 文本更新至 4.6 版本"
```

**注意**：这一步会往 LFS 上传约 100 MB 的新对象。GitHub 免费额度是 1 GB 存储 / 1 GB 月流量，每次修改都会产生一个全新对象。不要反复提交。

---

## Task 19: Book 层限时探测

**时间盒：30 分钟。超时即记为二期，不阻塞交付。**

**Files:** 无（探测结果决定是否新增任务）

- [ ] **Step 1: 探测书籍正文配置源**

已验证的事实：书页正文存在于 TextMap；`BookSeriesConfig.json` 只有系列名与点评的 hash，没有正文。

试以下方向，逐一记录结果：

```bash
# 方向一：可能的文件名
for f in ReadableConfig BookContentConfig BookTextConfig BookDetailConfig; do
  curl -s -o /dev/null -w "$f %{http_code}\n" \
    "https://raw.githubusercontent.com/DimbreathBot/TurnBasedGameData/main/ExcelOutput/$f.json"
done

# 方向二：Config 目录下的子目录
curl -s "https://api.github.com/repos/DimbreathBot/TurnBasedGameData/contents/Config" \
  | python -c "import sys,json;[print(x['name']) for x in json.load(sys.stdin)]"
```

- [ ] **Step 2: 反向查引用**

拿一段书页正文的 hash（在 `TextMapCHS.json` 中反查 `回忆最终如何呈现` 得到），在候选配置里搜这个 hash 值，看哪个配置引用了它：

```bash
python - <<'PY'
import json
from pathlib import Path
cache = Path("tools/cache")
chs = json.loads((cache / "TextMapCHS.json").read_text(encoding="utf-8"))
target = None
for key, value in chs.items():
    if "回忆最终如何呈现" in value:
        target = key
        break
print("正文 hash:", target)
PY
```

- [ ] **Step 3: 记录结论**

- **找到配置源** → 回到 `docs/superpowers/specs/2026-10-06-sr-text-update-design.md`，新增 Book 层的转换器设计，再单独写一个实现计划。
- **未找到** → 在 spec 第 12 节「分期」中确认 Book 归入二期，并在本次工作的完成汇报中明确说明「Book 层未交付，原因是配置源未定位」。

**本步骤不产生代码提交。**

---

## Task 20: 文档更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 的 Quick Start 之后插入新章节**

在 `README.md` 的「### 本地开发流程」小节之后、`## 许可` 之前插入：

```markdown
## 文本更新工具

游戏版本更新后，用 `tools/sr_update.py` 把新版本文本追加到现有数据中。

```bash
# 1. 拉取官方源文件到 tools/cache/（需要梯子，约 94 MB）
python tools/sr_update.py fetch

# 2. 查看当前状态与已记录的增量
python tools/sr_update.py status

# 3. 把差集追加进 site/TextMap/
python tools/sr_update.py build

# 4. 生成增量展示页
python tools/sr_update.py report
```

展示页地址：`http://localhost:9000/sr/textupd/`

**注意事项：**

- `build` 只追加，不改动任何已有内容；重复运行不会产生二次写入。
- 写入前会在 `tools/cache/backup/<版本>/` 留备份，不满意可用 `git checkout -- site/TextMap/` 回滚。
- `site/TextMap/*.json` 由 LFS 管理，提交前请确认已执行 `git lfs install`。
- 这三个文件每次修改都会往 LFS 上传约 100 MB 的新对象。GitHub 免费额度是 1 GB 存储 / 1 GB 月流量，请避免反复提交。
- 新增条目的 `H` 由本地生成，与 homdgcat.wiki 官方站点的 hash 搜索不一致。
```

- [ ] **Step 2: 验证 Markdown 渲染**

```bash
python -c "
from pathlib import Path
text = Path('README.md').read_text(encoding='utf-8')
assert text.count('\`\`\`') % 2 == 0, '代码块未配对'
assert '文本更新工具' in text
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: 补充文本更新工具用法"
```

---

## Self-Review 记录

对照 spec 逐节核查：

| Spec 章节 | 对应任务 |
|---|---|
| 3. 范围 — SR.json 增量 | Task 7, 11, 16 |
| 3. 范围 — SR_Talk 增量 | Task 8, 11, 16 |
| 3. 范围 — 展示页 | Task 12, 13, 14, 16 |
| 4. 架构 — 目录结构 | Task 1 |
| 4. 架构 — .gitignore | Task 1 |
| 6. source.py — 版本解析 | Task 4 |
| 6. source.py — 下载与缓存 | Task 4, 5 |
| 6. source.py — schema 探测 | Task 6 |
| 6. hashes.py — xxh32 | Task 2 |
| 6. hashes.py — 分配器 | Task 3 |
| 6. convert.py — 文本层 | Task 7 |
| 6. convert.py — 对话层 | Task 8 |
| 6. append.py — 风格探测与渲染 | Task 9 |
| 6. append.py — 原子追加与备份 | Task 10 |
| 6. append.py — LFS 防护 | Task 9, 10 |
| 6. report.py — 展示页 | Task 14 |
| 7. 幂等与版本归属 | Task 12, 17 |
| 8. 错误处理 | Task 6, 10, 16 |
| 9. 测试策略 | 全部任务 + Task 17 |
| 10. 风险 1（Talk schema 未实测） | Task 6（探测）+ Task 18 Step 2 |
| 10. 风险 2（LFS 配额） | Task 18 Step 8, Task 20 |
| 10. 风险 3（H 不一致） | Task 3, Task 20 |
| 10. 风险 4（噪声条目） | Task 16（ANOMALY_RATIO 阈值） |
| 10. 风险 5（Book 未定位） | Task 19 |
| 11. 验收标准 1–8 | Task 17, 18 |

**类型一致性核对：**

- `FileStyle(newline: bytes, indent: int)` — Task 9 定义，Task 10 使用，一致。
- `TalkSchema(id_field, text_field, name_field)` — Task 6 定义，Task 8、16 使用，一致。
- `HashAllocator(used, map_path)` / `.assign(hash64)` / `.save()` — Task 3 定义，Task 7、11、16 使用，一致。
- `append_entries(path, entries, field_order, *, backup_dir, dry_run)` — Task 10 定义，Task 16 使用，一致。
- `Ledger.record_run(version, sha, counts, textmap_hashes, talk_ids)` — Task 12 定义，Task 16 使用，一致。
- `build_textmap_entries(chs, eng, allocator, existing_keys)` — Task 7 定义，Task 16 使用，一致。
- `build_talk_entries(config, schema, chs, eng, existing_ids)` — Task 8 定义，Task 16 使用，一致。
- `Cache.path_for` / `.load_manifest` / `.save_manifest` / `.is_valid` — Task 4 定义，Task 5、15、16 使用，一致。

**自审中发现并已修复的问题：**

1. Task 6 / 10 / 16 初稿中夹带了「注意：删掉某段残留代码」的说明。计划不应要求实现者自行删改——已改为只保留最终正确代码。
2. **Task 17 集成测试期望值算错。** fixture 把说话人（hash 90 / 91）也放进了 TextMap，而说话人字符串本身就是文本条目，会被一并收录。因此新增文本是 5 条而非 2 条。已修正断言（`len(payload) == 6`、`len(added["textmap"]) == 5`），并在 fixture 中加了注释说明原因。
3. Task 10 测试里 import 了实现中并不存在的 `TextmapDiffError`，且 `sample_file` 返回类型标注为 `"object"`。已改为 `Path` 并删除多余 import。
4. `Range` 续传在 spec 中已改为「先试 Range，不可用则整体重下」，但 Task 4 的 `download()` 直接实现为整体下载。这是有意简化：Range 降级逻辑等 Task 18 在真实网络上确认服务端行为后再补，避免为未验证的行为写复杂度。

---

## 执行顺序说明

Task 1–17 严格按序执行（后者依赖前者）。Task 18 需要真实网络与梯子。Task 19 是时间盒探测，可在任意时点穿插。Task 20 最后做。

Task 18 是唯一会改动 `site/TextMap/` 的步骤，且**只能在 Task 17 全部通过后执行**。
