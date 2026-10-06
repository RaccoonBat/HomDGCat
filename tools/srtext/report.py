"""运行台账与展示页数据生成。"""

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
        try:
            with self.path.open(encoding="utf-8") as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError) as exc:
            raise ValueError(f"增量台账损坏，无法解析: {self.path}") from exc
        if not isinstance(payload, dict):
            raise ValueError(f"增量台账格式错误（应为对象）: {self.path}")
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
        temp_path = self.path.with_name(self.path.name + ".tmp")
        with temp_path.open("w", encoding="utf-8") as handle:
            json.dump({"runs": self.runs}, handle, ensure_ascii=False, indent=2)
        temp_path.replace(self.path)

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
    temp_path = path.with_name(path.name + ".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, separators=(",", ":"))
    temp_path.replace(path)


def collect_added_textmap(records: Iterable[Mapping[str, Any]], ledger: Ledger) -> list[dict[str, Any]]:
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


def collect_added_talk(ch_records, en_records, ledger: Ledger) -> list[dict[str, Any]]:
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
