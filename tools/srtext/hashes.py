"""32 位 xxhash 实现与 H 值分配器。

官方 TextMap 的 key 是 64 位 xxhash；SR.json 的 H 是其自有的 32 位内部 ID，
无法从官方数据复现，因此新增条目的 H 由本模块按确定性规则生成。
"""

import json
import struct
from pathlib import Path
from typing import Iterable

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


def collect_used_hashes(sr_json_path: Path) -> set[int]:
    """读出 SR.json 中全部已占用的 H 值。

    注意：93 MB 文件全量 json.load 的峰值内存约 1.5 GB。
    """
    with sr_json_path.open(encoding="utf-8") as handle:
        records = json.load(handle)
    used = {rec["H"] for rec in records if isinstance(rec.get("H"), int)}
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
        try:
            with self._map_path.open(encoding="utf-8") as handle:
                raw = json.load(handle)
        except (json.JSONDecodeError, OSError) as exc:
            raise ValueError(f"H 分配表损坏，无法解析: {self._map_path}") from exc
        if not isinstance(raw, dict):
            raise ValueError(f"H 分配表格式错误（应为对象）: {self._map_path}")
        mapping: dict[str, int] = {}
        for key, value in raw.items():
            if not (isinstance(key, str) and key.isdigit()):
                raise ValueError(f"H 分配表键非法: {key!r} in {self._map_path}")
            if not (isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= UINT32_MASK):
                raise ValueError(f"H 分配表值非法（需 uint32）: {key!r} -> {value!r} in {self._map_path}")
            mapping[key] = value
        self._mapping = mapping
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
        if not self._dirty:
            return
        self._map_path.parent.mkdir(parents=True, exist_ok=True)
        with self._map_path.open("w", encoding="utf-8") as handle:
            json.dump(self._mapping, handle, ensure_ascii=False, indent=2, sort_keys=True)
        self._dirty = False
