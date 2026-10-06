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
