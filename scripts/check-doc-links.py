#!/usr/bin/env python3
"""Check relative Markdown links in project documentation without dependencies."""

from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    files = subprocess.check_output(
        ["git", "ls-files", "-c", "-o", "--exclude-standard", "-z"], cwd=ROOT
    ).decode().split("\0")
    checked = 0
    failures = []
    for name in sorted(set(files)):
        path = ROOT / name
        if (
            not name.endswith(".md")
            or not path.is_file()
            or name.startswith((".hermes/", "assets/"))
        ):
            continue
        for match in re.finditer(r"!?\[[^\]\n]*\]\(([^)\n]+)\)", path.read_text()):
            target = match.group(1).strip()
            if target.startswith("<"):
                target = target[1 : target.index(">")]
            else:
                target = target.split(' "', 1)[0]
            url = urlsplit(target)
            if url.scheme or url.netloc or not url.path or target.startswith("/"):
                continue
            checked += 1
            if not (path.parent / unquote(url.path)).exists():
                line = path.read_text().count("\n", 0, match.start()) + 1
                failures.append(f"{name}:{line}: {target}")
    if failures:
        print("FALHA: links locais sem destino:", file=sys.stderr)
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"OK: {checked} links locais em Markdown. Âncoras e URLs externas não verificadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
