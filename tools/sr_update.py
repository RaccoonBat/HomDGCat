#!/usr/bin/env python3
"""崩铁文本增量更新工具。

用法:
    python tools/sr_update.py fetch     # 下载官方源文件到 tools/cache/
    python tools/sr_update.py status    # 报告现状，不写任何文件
    python tools/sr_update.py build     # 把差集追加进 site/TextMap/
    python tools/sr_update.py report    # 生成 site/sr/textupd/ 展示页

只有 fetch 需要联网；其余子命令可离线反复运行。
"""

import argparse
import json
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

# Windows 控制台默认 GBK，输出中文会变成乱码；这里强制 UTF-8。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, OSError):
        pass

from srtext.append import append_entries
from srtext.convert import (
    TALK_FIELD_ORDER,
    TEXTMAP_FIELD_ORDER,
    build_talk_entries,
    build_textmap_entries,
    load_existing_talk_ids,
    load_existing_textmap_keys,
)
from srtext.hashes import HashAllocator, collect_used_hashes
from srtext.report import (
    Ledger,
    collect_added_talk,
    collect_added_textmap,
    write_added_json,
)
from srtext.source import Cache, probe_textmap, probe_talk
from srtext import source as source_module

REPO_ROOT_DEFAULT = TOOLS_DIR.parent
CACHE_DEFAULT = TOOLS_DIR / "cache"

TEXTMAP_DIR = Path("site") / "TextMap"
SR_JSON = TEXTMAP_DIR / "SR.json"
TALK_CH = TEXTMAP_DIR / "SR_Talk_CH.json"
TALK_EN = TEXTMAP_DIR / "SR_Talk_EN.json"

#: 新增量超过现有条目该比例时，要求 --yes 确认
ANOMALY_RATIO = 0.30


def _cache_paths(cache: Cache):
    return (
        cache.path_for("TextMapCHS.json"),
        cache.path_for("TextMapEN.json"),
        cache.path_for("TalkSentenceConfig.json"),
    )


def cmd_fetch(args) -> int:
    cache = Cache(args.cache)
    print("  拉取官方源文件")
    try:
        version = source_module.fetch_sources(cache, force=args.force)
    except Exception as error:  # noqa: BLE001 - CLI 边界，转为友好提示
        print(f"  抓取失败: {error}", file=sys.stderr)
        print(
            "  提示: fetch 需要访问 GitHub（请确认梯子可用）；"
            "本地已有缓存时可直接运行 build/report。",
            file=sys.stderr,
        )
        return 1
    print(f"  已缓存版本 {version.version}")
    return 0


def cmd_status(args) -> int:
    cache = Cache(args.cache)
    root = Path(args.root)
    manifest = cache.load_manifest()

    print("  崩铁文本增量状态")
    print(f"  仓库根目录: {root}")
    if manifest:
        print(f"  缓存版本:   {manifest.get('version')}  ({str(manifest.get('sha', ''))[:12]})")
        print(f"  抓取时间:   {manifest.get('fetched_at')}")
    else:
        print("  缓存:       无（请先运行 fetch）")

    for label, rel in (("SR.json", SR_JSON), ("SR_Talk_CH.json", TALK_CH), ("SR_Talk_EN.json", TALK_EN)):
        target = root / rel
        if target.exists():
            size = target.stat().st_size
            print(f"  {label:<16}{size:,} 字节")
        else:
            print(f"  {label:<16}未找到 ({target})")

    ledger_path = cache.path_for("ledger.json")
    if ledger_path.exists():
        ledger = Ledger(ledger_path)
        print(f"  已记录增量: {len(ledger.runs)} 次运行")
        for run in ledger.runs:
            counts = run.get("counts", {})
            print(
                f"    - {run.get('version')}: 文本 {counts.get('textmap', 0)} 条，"
                f"对话 {counts.get('talk', 0)} 条"
            )
    else:
        print("  已记录增量: 无")
    return 0


def cmd_build(args) -> int:
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

    sr_json = root / SR_JSON
    talk_ch = root / TALK_CH
    talk_en = root / TALK_EN
    for path in (sr_json, talk_ch, talk_en):
        if not path.exists():
            print(f"  目标文件不存在: {path}", file=sys.stderr)
            return 1

    print("  载入源数据…")
    with chs_path.open(encoding="utf-8") as handle:
        chs = json.load(handle)
    with eng_path.open(encoding="utf-8") as handle:
        eng = json.load(handle)
    with talk_path.open(encoding="utf-8") as handle:
        talk_config = json.load(handle)

    try:
        probe_textmap(chs)
        probe_textmap(eng)
        talk_schema = probe_talk(talk_config)
    except Exception as error:  # noqa: BLE001
        print(f"  源数据结构与预期不符，已中止: {error}", file=sys.stderr)
        return 1
    print(f"  TalkSentenceConfig 探测结果: {talk_schema}")

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

    print(f"  新增: 文本 {len(textmap_entries)} 条，对话 {len(talk_ch_entries)} 条")

    if not textmap_entries and not talk_ch_entries:
        print("  没有新增内容，未写入任何文件。")
        return 0

    if existing_ids and len(talk_ch_entries) > len(existing_ids) * ANOMALY_RATIO and not args.yes:
        print(
            f"  异常：对话新增 {len(talk_ch_entries)} 条，超过现有 {len(existing_ids)} 条的 "
            f"{ANOMALY_RATIO:.0%}。请确认 schema 探测无误后加 --yes 重跑。",
            file=sys.stderr,
        )
        return 1

    backup_dir = cache.root / "backup" / str(manifest.get("sha", "unknown"))[:12]
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


def cmd_report(args) -> int:
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
    print("  打开 http://localhost:9000/sr/textupd/ 查看")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="崩铁文本增量更新工具")
    parser.add_argument("--root", default=str(REPO_ROOT_DEFAULT), help="仓库根目录")
    parser.add_argument("--cache", default=str(CACHE_DEFAULT), help="缓存目录")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_parser = subparsers.add_parser("fetch", help="下载官方源文件")
    fetch_parser.add_argument("--force", action="store_true", help="忽略缓存，强制重新下载")

    subparsers.add_parser("status", help="报告现状，不写文件")

    build_parser_ = subparsers.add_parser("build", help="把差集追加进 site/TextMap/")
    build_parser_.add_argument("--yes", action="store_true", help="跳过新增量异常确认")

    subparsers.add_parser("report", help="生成展示页")
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {
        "fetch": cmd_fetch,
        "status": cmd_status,
        "build": cmd_build,
        "report": cmd_report,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
