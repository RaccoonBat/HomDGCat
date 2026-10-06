"""官方数据源解析、下载、缓存与 schema 探测。

数据源：DimbreathBot/TurnBasedGameData（Dimbreath/StarRailData 的继任者）。
该仓库只有 main 一个分支，数据按版本就地更新，因此按 commit SHA 固定下载
以保证同一版本可复现、可校验。
"""

import hashlib
import http.client
import json
import os
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
        try:
            with manifest_path.open(encoding="utf-8") as handle:
                raw = json.load(handle)
        except (json.JSONDecodeError, OSError) as exc:
            raise ValueError(f"缓存 manifest 损坏，无法解析: {manifest_path}") from exc
        if not isinstance(raw, dict):
            raise ValueError(f"缓存 manifest 格式错误（应为对象）: {manifest_path}")
        return raw

    def save_manifest(self, version: SourceVersion, files: Mapping[str, Mapping[str, Any]]) -> None:
        payload = {
            "repo": REPO,
            "sha": version.sha,
            "version": version.version,
            "message": version.message,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "files": {name: dict(meta) for name, meta in files.items()},
        }
        manifest_path = self.root / self.MANIFEST_NAME
        temp_path = manifest_path.with_name(manifest_path.name + ".tmp")
        with temp_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        os.replace(temp_path, manifest_path)


def _request_with_length(url: str, *, timeout: int = 60, retries: int = 3) -> tuple[bytes, int | None]:
    """同 _request，但额外返回 Content-Length（缺失时为 None）。"""
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                declared = response.headers.get("Content-Length")
                return response.read(), (int(declared) if declared else None)
        except urllib.error.HTTPError as error:
            detail = ""
            try:
                detail = error.read(512).decode("utf-8", "replace")
            except OSError:
                pass
            if 400 <= error.code < 500:
                hint = ""
                if error.code == 403 and "rate limit" in detail.lower():
                    hint = "（GitHub 未认证 API 限额为 60 次/小时，请稍后再试）"
                raise RuntimeError(
                    f"请求失败: HTTP {error.code} {error.reason}: {url}{hint}\n{detail}"
                ) from error
            last_error = error
        except (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError) as error:
            last_error = error
        if attempt < retries - 1:
            time.sleep(2**attempt)
    raise RuntimeError(f"请求失败: {url} ({last_error!r})") from last_error


def _request(url: str, *, timeout: int = 60, retries: int = 3) -> bytes:
    """带指数退避的 GET。

    4xx 属于客户端错误（路径不存在、触发限额），重试没有意义，直接失败并
    带上响应体片段，便于在梯子环境下定位问题。
    """
    body, _ = _request_with_length(url, timeout=timeout, retries=retries)
    return body


def resolve_latest_version(path: str, *, retries: int = 3) -> SourceVersion:
    """查询指定路径的最新 commit，返回 SHA 与版本号。"""
    url = f"{API_ROOT}/commits?sha={BRANCH}&path={path}&per_page=1"
    try:
        payload = json.loads(_request(url, retries=retries).decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"GitHub API 返回非 JSON 内容: {url}") from exc
    if not isinstance(payload, list) or not payload:
        raise RuntimeError(f"GitHub API 返回了非预期的结构: {url} -> {str(payload)[:300]}")
    commit = payload[0]
    message = commit["commit"]["message"].strip()
    return SourceVersion(sha=commit["sha"], version=parse_version(message), message=message)


def download(url: str, dest: Path, *, timeout: int = 300, retries: int = 3, log=print) -> int:
    """流式下载到 dest，返回字节数。

    边下边写并打印进度——这几个文件合计约 94 MB，整体读进内存既不必要，
    也让用户在整个下载期间看不到任何反馈。失败或长度不符时清理半成品。
    """
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest.with_name(dest.name + ".part")

    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                declared_raw = response.headers.get("Content-Length")
                declared = int(declared_raw) if declared_raw else None
                received = 0
                with temp_path.open("wb") as handle:
                    while True:
                        chunk = response.read(1 << 20)
                        if not chunk:
                            break
                        handle.write(chunk)
                        received += len(chunk)
                        if declared:
                            percent = received * 100 // declared
                            log(
                                f"\r  {dest.name}: {received:,}/{declared:,} 字节 ({percent}%)",
                                end="",
                                flush=True,
                            )
                        else:
                            log(f"\r  {dest.name}: {received:,} 字节", end="", flush=True)
            if declared is not None and declared != received:
                raise RuntimeError(
                    f"下载不完整: 声明 {declared} 字节，实际收到 {received} 字节 ({url})"
                )
            log("")
            os.replace(temp_path, dest)
            return received
        except urllib.error.HTTPError as error:
            detail = ""
            try:
                detail = error.read(512).decode("utf-8", "replace")
            except OSError:
                pass
            if 400 <= error.code < 500:
                hint = ""
                if error.code == 403 and "rate limit" in detail.lower():
                    hint = "（GitHub 未认证 API 限额为 60 次/小时，请稍后再试）"
                _cleanup(temp_path)
                log("")
                raise RuntimeError(
                    f"请求失败: HTTP {error.code} {error.reason}: {url}{hint}\n{detail}"
                ) from error
            last_error = error
        except (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError) as error:
            last_error = error
        _cleanup(temp_path)
        log("")
        if attempt < retries - 1:
            log(f"  重试 {attempt + 1}/{retries - 1}…")
            time.sleep(2**attempt)
    raise RuntimeError(f"请求失败: {url} ({last_error!r})") from last_error


def _cleanup(path: Path) -> None:
    if path.exists():
        path.unlink()


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
        download(url, cache.path_for(name), log=log)
        size = cache.path_for(name).stat().st_size
        digest = sha256_file(cache.path_for(name))
        results[name] = {"sha256": digest, "bytes": size}
        log(f"  完成: {name}  {size:,} 字节  sha256={digest[:12]}")

    cache.save_manifest(version, results)
    return version


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


def _pick_field(candidates: Mapping[str, Any] | set[str], keyword: str) -> str | None:
    keyword = keyword.lower()
    for key in sorted(candidates):
        if keyword in key.lower():
            return key
    return None


def probe_textmap(payload: Any) -> None:
    """校验 TextMap 结构：字典，键为数字字符串，值为字符串。

    这里只抽查前 200 条：完整扫描一个 52 MB 的映射并不划算，
    真正的结构校验其实由 json.loads 本身完成。
    """
    if not isinstance(payload, Mapping):
        raise SchemaMismatch(f"TextMap 期望是字典，实际为 {type(payload).__name__}")
    for key, value in list(payload.items())[:200]:
        if not isinstance(key, str) or not isinstance(value, str):
            raise SchemaMismatch(
                "TextMap 期望 {数字字符串: 字符串}，实际样本: "
                f"{key!r} -> {type(value).__name__}. 前 3 条: {list(payload.items())[:3]!r}"
            )


def probe_talk(payload: Any) -> TalkSchema:
    """探测 TalkSentenceConfig 的实际字段布局。

    要求候选引用字段在所有样本中都存在——只依据单个样本推断，可能把
    某个特例条目的字段当成通用结构，进而静默产出错数据。
    """
    samples = _sample_entries(payload, size=200)
    if not samples:
        raise SchemaMismatch(
            f"TalkSentenceConfig 结构不可识别：期望字典或列表，实际为 {type(payload).__name__}"
        )

    # text_field 是必需字段：必须在所有样本中都出现，否则可能选错字段而写坏数据。
    common: set[str] | None = None
    # name_field 是可选字段：说话人可以为空，因此只要出现过就要认得出来，
    # 用并集而非交集——否则一个无说话人的样本就会让它被整体忽略。
    union: set[str] = set()
    for _, entry in samples:
        keys = set(_hash_ref_fields(entry))
        common = keys if common is None else (common & keys)
        union |= keys
    common = common or set()

    if not common:
        raise SchemaMismatch(
            "TalkSentenceConfig 中未找到形如 {\"Hash\": <int>} 的引用字段，"
            "或各样本间字段不一致。\n"
            f"各样本字段: {[sorted(entry.keys()) for _, entry in samples[:5]]}\n"
            f"第一个条目样本: {samples[0][1]!r}"
        )

    text_field = _pick_field(common, "text")
    if text_field is None:
        raise SchemaMismatch(
            "TalkSentenceConfig 中未找到正文引用字段（字段名应含 'text'）。\n"
            f"候选引用字段: {sorted(common)}\n"
            f"第一个条目样本: {samples[0][1]!r}"
        )

    id_field: str | None = None
    if isinstance(payload, list):
        first_entry = samples[0][1]
        id_field = _pick_field(first_entry, "id")
        if id_field is None:
            raise SchemaMismatch(
                "TalkSentenceConfig 是列表，但条目中未找到含 'id' 的字段。\n"
                f"第一个条目的实际字段: {sorted(first_entry.keys())}"
            )

    return TalkSchema(id_field=id_field, text_field=text_field, name_field=_pick_field(union, "name"))
