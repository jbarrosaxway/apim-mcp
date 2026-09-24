#!/usr/bin/env python3
"""Find .class entries in Gateway JARs matching a regex on path or bytecode strings."""

import argparse
import re
import sys
import zipfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Search Axway Gateway JARs for classes")
    parser.add_argument("-JarDir", required=True, help="Directory containing *.jar files")
    parser.add_argument("-Pattern", required=True, help="Regex for class name or string in bytecode")
    args = parser.parse_args()

    jar_dir = Path(args.JarDir)
    if not jar_dir.is_dir():
        print(f"Not a directory: {jar_dir}", file=sys.stderr)
        return 1

    pattern = re.compile(args.Pattern)
    jars = sorted(jar_dir.glob("*.jar"))
    if not jars:
        print(f"No JARs in {jar_dir}", file=sys.stderr)
        return 1

    hits = 0
    for jar_path in jars:
        try:
            with zipfile.ZipFile(jar_path) as zf:
                for name in zf.namelist():
                    if not name.endswith(".class"):
                        continue
                    if pattern.search(name):
                        print(f"{jar_path.name}\t{name}")
                        hits += 1
                        continue
                    try:
                        data = zf.read(name)
                    except KeyError:
                        continue
                    if pattern.search(data.decode("latin-1", errors="ignore")):
                        print(f"{jar_path.name}\t{name}\t(string match)")
                        hits += 1
        except zipfile.BadZipFile:
            print(f"Skipping bad zip: {jar_path}", file=sys.stderr)

    print(f"\n{hits} match(es)", file=sys.stderr)
    return 0 if hits else 2


if __name__ == "__main__":
    raise SystemExit(main())
