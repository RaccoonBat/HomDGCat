"""把官方数据转换成 SR.json / SR_Talk_*.json 的条目形态。"""

import json
from pathlib import Path
from typing import Any, Mapping, Sequence

from .hashes import HashAllocator
from .source import TalkSchema

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


def _iter_talk_pairs(config: Any, schema: TalkSchema) -> list[tuple[int, Mapping[str, Any]]]:
    """把两种配置形态归一成 (id, entry) 列表。"""
    if isinstance(config, Mapping):
        pairs: list[tuple[int, Mapping[str, Any]]] = []
        for key, value in config.items():
            if not isinstance(value, Mapping):
                continue
            try:
                pairs.append((int(key), value))
            except (TypeError, ValueError):
                continue
        return pairs
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
    schema: TalkSchema,
    chs: Mapping[str, str],
    eng: Mapping[str, str],
    existing_ids: set[int],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """构造待追加的 SR_Talk_CH.json / SR_Talk_EN.json 条目。

    返回 (中文条目, 英文条目)。两份列表的 ID 顺序一致，与现有文件的组织方式相同。
    正文 hash 解析不到文本的条目整条跳过——避免产出没有内容的空对话。
    说话人为空是合法数据（现有文件中有 55227 条），照常输出空字符串。
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


def load_existing_textmap_keys(path: Path) -> set[tuple[str, str]]:
    """读出 SR.json 中全部 (C, E) 身份键。

    注意：93 MB 文件全量 json.load 的峰值内存约 1.5 GB。
    """
    with Path(path).open(encoding="utf-8") as handle:
        records = json.load(handle)
    return {(rec.get("C", ""), rec.get("E", "")) for rec in records}


def load_existing_talk_ids(path: Path) -> set[int]:
    """读出 SR_Talk_*.json 中全部条目 ID。"""
    with Path(path).open(encoding="utf-8") as handle:
        records = json.load(handle)
    return {rec["I"] for rec in records if isinstance(rec.get("I"), int)}
