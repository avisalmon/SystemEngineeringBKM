"""Command line: python -m sebkm render course [--check]"""

from __future__ import annotations

import argparse
import sys

from . import book


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m sebkm", description="SystemEngineeringBKM tools")
    commands = parser.add_subparsers(dest="command", required=True)
    render = commands.add_parser("render", help="render Markdown sources to HTML pages")
    render.add_argument("what", choices=["course"], help="course: the course book and its slide decks")
    render.add_argument("--check", action="store_true", help="only check that the pages on disk are up to date")
    args = parser.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    try:
        if args.check:
            stale = book.check()
            if stale:
                print("Out of date; run `python -m sebkm render course`:")
                for path in stale:
                    print(f"  {path}")
                return 1
            print("The course pages are up to date.")
            return 0
        for line in book.write():
            print(line)
        return 0
    except book.BookError as err:
        print(f"error: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
