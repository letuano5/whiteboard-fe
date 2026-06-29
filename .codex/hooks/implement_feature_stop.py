#!/usr/bin/env python3
"""Codex Stop hook for the implement-feature skill.

State is scoped by CODEX_THREAD_ID so parallel Codex threads in the same repo do not
accidentally continue one another's workflow.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STATE_TTL_HOURS = 24


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def thread_id() -> str | None:
    value = os.environ.get("CODEX_THREAD_ID", "").strip()
    return value or None


def state_dir() -> Path:
    return repo_root().parent / ".implement-feature-state"


def state_path(tid: str) -> Path:
    safe_tid = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in tid)
    return state_dir() / f"{safe_tid}.json"


def read_state(tid: str) -> dict[str, Any] | None:
    path = state_path(tid)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_state(tid: str, data: dict[str, Any]) -> None:
    state_dir().mkdir(parents=True, exist_ok=True)
    data["thread_id"] = tid
    data["updated_at"] = now_iso()
    path = state_path(tid)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_stale(data: dict[str, Any]) -> bool:
    started = parse_time(data.get("started_at"))
    if started is None:
        return False
    age = datetime.now(timezone.utc) - started
    return age.total_seconds() > STATE_TTL_HOURS * 3600


def command_start(args: argparse.Namespace) -> int:
    tid = thread_id()
    if tid is None:
        print("implement-feature hook: CODEX_THREAD_ID is missing; not activating state.", file=sys.stderr)
        return 1
    data: dict[str, Any] = {
        "active": True,
        "awaiting_user": False,
        "feature": args.feature or "",
        "phase": args.phase or "bootstrap",
        "started_at": now_iso(),
        "stop_count": 0,
    }
    write_state(tid, data)
    print(f"implement-feature state active for thread {tid}")
    return 0


def command_finish(_: argparse.Namespace) -> int:
    tid = thread_id()
    if tid is None:
        return 0
    data = read_state(tid) or {}
    data.update({"active": False, "awaiting_user": False, "finished_at": now_iso()})
    write_state(tid, data)
    print(f"implement-feature state inactive for thread {tid}")
    return 0


def command_phase(args: argparse.Namespace) -> int:
    tid = thread_id()
    if tid is None:
        return 1
    data = read_state(tid) or {"active": True, "started_at": now_iso(), "stop_count": 0}
    data["phase"] = args.phase
    data["awaiting_user"] = False
    write_state(tid, data)
    return 0


def command_awaiting_user(args: argparse.Namespace) -> int:
    tid = thread_id()
    if tid is None:
        return 1
    data = read_state(tid) or {"active": True, "started_at": now_iso(), "stop_count": 0}
    data["awaiting_user"] = True
    data["awaiting_reason"] = args.reason or ""
    write_state(tid, data)
    return 0


def command_resume(_: argparse.Namespace) -> int:
    tid = thread_id()
    if tid is None:
        return 1
    data = read_state(tid) or {"active": True, "started_at": now_iso(), "stop_count": 0}
    data["awaiting_user"] = False
    data.pop("awaiting_reason", None)
    write_state(tid, data)
    return 0


def command_status(_: argparse.Namespace) -> int:
    tid = thread_id()
    if tid is None:
        print("No CODEX_THREAD_ID.")
        return 0
    data = read_state(tid)
    if data is None:
        print(f"No implement-feature state for thread {tid}.")
    else:
        print(json.dumps(data, indent=2, sort_keys=True))
    return 0


def stop_hook() -> int:
    tid = thread_id()
    if tid is None:
        return 0

    data = read_state(tid)
    if not data or not data.get("active") or data.get("awaiting_user"):
        return 0

    if is_stale(data):
        return 0

    data["stop_count"] = int(data.get("stop_count", 0)) + 1
    write_state(tid, data)

    feature = data.get("feature") or "the active feature"
    phase = data.get("phase") or "the next pending phase"
    print(
        "\nIMPLEMENT-FEATURE CONTINUATION\n"
        f"This Codex thread has active $implement-feature state for: {feature}\n"
        f"Current phase hint: {phase}\n\n"
        "Do not end the workflow just because the turn reached a stopping point. "
        "Continue with the next pending phase from AGENTS.md, docs/SPECS.md, and "
        "the active specs/<feature>/ artifacts.\n\n"
        "If you genuinely need user input, ask the user directly and run:\n"
        "  .codex/hooks/implement_feature_stop.py --awaiting-user \"<reason>\"\n\n"
        "When the final Vietnamese handoff is complete, run:\n"
        "  .codex/hooks/implement_feature_stop.py --finish\n",
        file=sys.stdout,
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", action="store_true")
    parser.add_argument("--finish", action="store_true")
    parser.add_argument("--phase")
    parser.add_argument("--awaiting-user", dest="awaiting_user")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("feature", nargs="?")
    args = parser.parse_args()

    if args.start:
        return command_start(args)
    if args.finish:
        return command_finish(args)
    if args.phase:
        return command_phase(args)
    if args.awaiting_user is not None:
        args.reason = args.awaiting_user
        return command_awaiting_user(args)
    if args.resume:
        return command_resume(args)
    if args.status:
        return command_status(args)
    return stop_hook()


if __name__ == "__main__":
    raise SystemExit(main())
