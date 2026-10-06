"""阅读物（书页）层：从官方配置重新生成 SR_Book_*.js。

与 SR.json / SR_Talk 的「追加」语义不同，书页层是**整文件重新生成**——
官方的书系列顺序与现有文件不同，逐条比对的成本高于直接重建。

数据链路（已实测 1121/1121 全部命中）：
    BookSeriesWorld.json   -> _series（世界/系列列表）
    BookSeriesConfig.json  -> _books 的 Name / Desc / World
    LocalbookConfig.json   -> 每本书的正文（按 BookSeriesID 归集）
    BookContent.Hash       -> TextMapCHS/EN 取正文
"""

import json
from pathlib import Path
from typing import Any, Mapping, Sequence

#: TextMap 正文里的换行是**字面的两字符 \\n**（反斜杠 + n），不是真换行。
#: HomDGCat 的转换就是把它替换成 <br>。用真换行去做替换会静默匹配不到。
LITERAL_NEWLINE = "\\n"
LINE_BREAK = "<br>"

BOOKS_VAR = "var _books = "
SERIES_VAR = "var _series = "
HEADER = "// Auto Generated"


def render(value: Any, indent: int, newline: str) -> str:
    """复刻 HomDGCat 生成的 JS 排版：4 空格递进、裸 UTF-8。

    已用现有 SR_Book_CH.js 的全部 613 条做逐字节往返验证，输出完全一致。
    """
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = list(value.items())
        lines = ["{"]
        for index, (key, item) in enumerate(items):
            comma = "," if index < len(items) - 1 else ""
            lines.append(f'{" " * (indent + 4)}"{key}": {render(item, indent + 4, newline)}{comma}')
        lines.append(" " * indent + "}")
        return newline.join(lines)

    if isinstance(value, list):
        if not value:
            return "[]"
        lines = ["["]
        for index, item in enumerate(value):
            comma = "," if index < len(value) - 1 else ""
            lines.append(f'{" " * (indent + 4)}{render(item, indent + 4, newline)}{comma}')
        lines.append(" " * indent + "]")
        return newline.join(lines)

    return json.dumps(value, ensure_ascii=False)


def resolve(textmap: Mapping[str, str], ref: Any) -> str:
    """把 {"Hash": N} 解析成文本。缺失时返回空字符串。"""
    if not isinstance(ref, Mapping):
        return ""
    value = ref.get("Hash")
    if value is None:
        return ""
    return textmap.get(str(value), "")


def to_line_breaks(text: str) -> str:
    """把字面 \\n 换成 <br>，保持与现有文件一致。"""
    return text.replace(LITERAL_NEWLINE, LINE_BREAK)


def build_series(world_config: Sequence[Mapping[str, Any]], textmap: Mapping[str, str]) -> list[dict[str, Any]]:
    """构造 _series：世界列表。"""
    series = [
        {"_id": entry["BookSeriesWorld"], "Name": resolve(textmap, entry["BookSeriesWorldTextmapID"])}
        for entry in world_config
    ]
    series.sort(key=lambda item: item["_id"])
    return series


def build_books(
    series_config: Sequence[Mapping[str, Any]],
    localbook_config: Sequence[Mapping[str, Any]],
    textmap: Mapping[str, str],
) -> list[dict[str, Any]]:
    """构造 _books：每个书系列一条，正文按 BookSeriesID 归集。"""
    by_series: dict[Any, list[Mapping[str, Any]]] = {}
    for book in localbook_config:
        by_series.setdefault(book["BookSeriesID"], []).append(book)

    entries: list[dict[str, Any]] = []
    for series in series_config:
        entry: dict[str, Any] = {
            "Name": resolve(textmap, series["BookSeries"]),
            "Desc": to_line_breaks(resolve(textmap, series.get("BookSeriesComments"))),
            "World": series["BookSeriesWorld"],
            "Books": [
                {"Desc": to_line_breaks(resolve(textmap, book["BookContent"]))}
                for book in by_series.get(series["BookSeriesID"], [])
            ],
        }
        if not series.get("IsShowInBookshelf", False):
            entry["Hidden"] = True
        entries.append(entry)
    return entries


def render_book_js(series: Sequence[Mapping[str, Any]], books: Sequence[Mapping[str, Any]], newline: str) -> str:
    """生成完整的 SR_Book_*.js 内容。"""
    return newline.join(
        [
            HEADER,
            "",
            SERIES_VAR + render(list(series), 0, newline),
            "",
            BOOKS_VAR + render(list(books), 0, newline),
        ]
    )


def load_json(path: Path) -> Any:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)
