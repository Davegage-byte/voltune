"""AVEX NEXUS Collector for Windows.

Small one-shot runner intended to be called every five minutes by Windows Task Scheduler.
It reuses the repository's update_avex.py, keeps a local rotating log, and pushes fresh
AVEX data to main. The clone is dedicated to the collector; local changes are discarded.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional, Tuple

VERSION = "0.1.0-test"
TASK_INTERVAL_MINUTES = 5
LOCK_STALE_SECONDS = 20 * 60

LOCALAPPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home()))
STATE_DIR = LOCALAPPDATA / "AVEX-NEXUS"
DEFAULT_REPO = STATE_DIR / "voltune"
LOG_DIR = STATE_DIR / "logs"
HEALTH_FILE = STATE_DIR / "health.json"
LOCK_FILE = STATE_DIR / "collector.lock"


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def setup_logging() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("avex-nexus")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    file_handler = RotatingFileHandler(
        LOG_DIR / "avex-watcher.log",
        maxBytes=2_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    if sys.stdout is not None:
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

    return logger


LOGGER = setup_logging()


def write_health(**values) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    old = {}
    try:
        old = json.loads(HEALTH_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    old.update(values)
    tmp = HEALTH_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(old, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(HEALTH_FILE)


def acquire_lock() -> bool:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if LOCK_FILE.exists():
        try:
            age = time.time() - LOCK_FILE.stat().st_mtime
            if age < LOCK_STALE_SECONDS:
                LOGGER.info("Ein anderer AVEX-Lauf ist noch aktiv. Dieser Lauf wird beendet.")
                return False
            LOGGER.warning("Veraltete Sperrdatei gefunden und entfernt.")
            LOCK_FILE.unlink(missing_ok=True)
        except OSError:
            return False

    try:
        fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(f"pid={os.getpid()}\nstarted={now_iso()}\n")
        return True
    except FileExistsError:
        return False


def release_lock() -> None:
    try:
        LOCK_FILE.unlink(missing_ok=True)
    except OSError:
        pass


def run_command(
    args: list[str],
    cwd: Path,
    check: bool = True,
    timeout: int = 120,
) -> subprocess.CompletedProcess[str]:
    LOGGER.info("> %s", " ".join(args))
    proc = subprocess.run(
        args,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    output = (proc.stdout or "").strip()
    if output:
        for line in output.splitlines()[-30:]:
            LOGGER.info("  %s", line)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Befehl fehlgeschlagen ({proc.returncode}): {' '.join(args)}")
    return proc


def git(repo: Path, *args: str, check: bool = True, timeout: int = 120):
    return run_command(["git", *args], cwd=repo, check=check, timeout=timeout)


def ensure_clean_and_current(repo: Path, allow_push: bool) -> None:
    git(repo, "config", "user.name", "AVEX NEXUS")
    git(repo, "config", "user.email", "avex-nexus@localhost")
    git(repo, "fetch", "origin", "main", timeout=90)

    status = git(repo, "status", "--porcelain", check=False).stdout.strip()
    if status:
        LOGGER.warning("Lokale Reständerungen gefunden. Dedicated Collector-Clone wird bereinigt.")
        git(repo, "reset", "--hard", "HEAD", check=False)
        git(repo, "clean", "-fd", "avex-observations", "avex-schedules", check=False)

    counts = git(
        repo,
        "rev-list",
        "--left-right",
        "--count",
        "origin/main...HEAD",
        check=False,
    ).stdout.strip().split()

    if len(counts) == 2:
        behind, ahead = int(counts[0]), int(counts[1])
        if ahead and allow_push:
            LOGGER.warning("%s lokaler Commit(s) noch nicht auf GitHub. Push wird erneut versucht.", ahead)
            git(repo, "push", "origin", "HEAD:main", check=False, timeout=90)
            git(repo, "fetch", "origin", "main", timeout=90)
        elif ahead:
            LOGGER.warning("Lokale ungesendete Commits werden im Testmodus verworfen.")

    # Dedicated clone: remote main is authoritative for code. Generated data will be rebuilt.
    git(repo, "reset", "--hard", "origin/main")


def run_scraper(repo: Path) -> bool:
    python = Path(sys.executable)
    for attempt in range(1, 4):
        LOGGER.info("AVEX Abruf Versuch %s/3", attempt)
        proc = run_command(
            [str(python), "update_avex.py"],
            cwd=repo,
            check=False,
            timeout=90,
        )
        if proc.returncode == 0:
            return True
        if attempt < 3:
            LOGGER.warning("Abruf nicht frisch/fehlgeschlagen. Neuer Versuch in 15 Sekunden.")
            time.sleep(15)
    return False


def stage_generated(repo: Path) -> bool:
    for path in ("avex-data.json", "avex-history.json"):
        git(repo, "add", path, check=False)
    for directory in ("avex-observations", "avex-schedules"):
        if (repo / directory).exists():
            git(repo, "add", directory, check=False)

    diff = git(repo, "diff", "--cached", "--quiet", check=False)
    return diff.returncode != 0


def commit_generated(repo: Path) -> Optional[str]:
    if not stage_generated(repo):
        LOGGER.info("Keine geänderten AVEX-Dateien.")
        return None

    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    git(repo, "commit", "-m", f"Update AVEX (NEXUS) {stamp}")
    sha = git(repo, "rev-parse", "HEAD").stdout.strip()
    return sha


def push_with_one_recovery(repo: Path, scraper_ok: bool) -> Tuple[bool, Optional[str]]:
    sha = commit_generated(repo)
    if sha is None:
        return True, None

    push = git(repo, "push", "origin", "HEAD:main", check=False, timeout=90)
    if push.returncode == 0:
        return True, sha

    LOGGER.warning("Push kollidierte oder schlug fehl. Remote wird neu geladen und AVEX einmal neu erzeugt.")
    git(repo, "fetch", "origin", "main", check=False, timeout=90)
    git(repo, "rebase", "--abort", check=False)
    git(repo, "reset", "--hard", "origin/main", check=False)

    second_scrape_ok = run_scraper(repo)
    scraper_ok = scraper_ok or second_scrape_ok
    sha = commit_generated(repo)
    if sha is None:
        return True, None

    second_push = git(repo, "push", "origin", "HEAD:main", check=False, timeout=90)
    return second_push.returncode == 0, sha


def execute_once(repo: Path, no_push: bool) -> int:
    started = now_iso()
    write_health(
        version=VERSION,
        last_run_started=started,
        last_run_finished=None,
        running=True,
        ok=False,
        repo=str(repo),
    )

    try:
        if not (repo / ".git").exists():
            raise RuntimeError(f"Git-Repository nicht gefunden: {repo}")
        if not (repo / "update_avex.py").exists():
            raise RuntimeError("update_avex.py fehlt im Collector-Repository")

        ensure_clean_and_current(repo, allow_push=not no_push)
        scraper_ok = run_scraper(repo)

        push_ok = True
        commit_sha = None
        if no_push:
            LOGGER.info("Testmodus: Daten werden nicht committed oder gepusht.")
        else:
            push_ok, commit_sha = push_with_one_recovery(repo, scraper_ok)

        ok = bool(scraper_ok and push_ok)
        write_health(
            last_run_finished=now_iso(),
            running=False,
            ok=ok,
            scraper_ok=bool(scraper_ok),
            push_ok=bool(push_ok),
            commit=commit_sha,
            error=None if ok else "Scrape oder Push war nicht erfolgreich",
        )
        LOGGER.info(
            "Lauf beendet | Scraper=%s | Push=%s | Commit=%s",
            "OK" if scraper_ok else "WARN",
            "OK" if push_ok else "FEHLER",
            commit_sha or "-",
        )
        return 0 if ok else 1

    except Exception as exc:
        LOGGER.exception("AVEX NEXUS Lauf fehlgeschlagen: %s", exc)
        write_health(
            last_run_finished=now_iso(),
            running=False,
            ok=False,
            error=str(exc),
        )
        return 2


def parse_args():
    parser = argparse.ArgumentParser(description="AVEX NEXUS Collector")
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO)
    parser.add_argument("--once", action="store_true", help="Genau einen Abruf durchführen")
    parser.add_argument("--no-push", action="store_true", help="Nur lokal testen, nichts zu GitHub pushen")
    parser.add_argument("--version", action="version", version=VERSION)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not acquire_lock():
        return 0
    try:
        return execute_once(args.repo.resolve(), args.no_push)
    finally:
        release_lock()


if __name__ == "__main__":
    sys.exit(main())
