#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <JarPath> <ClassFilter> <OutDir> <CfrJar> <JavaExe>" >&2
  exit 1
}

[[ $# -eq 5 ]] || usage

JarPath="$1"
ClassFilter="$2"
OutDir="$3"
CfrJar="$4"
JavaExe="$5"

for p in "$JarPath" "$CfrJar" "$JavaExe"; do
  if [[ ! -e "$p" ]]; then
    echo "Path not found: $p" >&2
    exit 1
  fi
done

mkdir -p "$OutDir"

"$JavaExe" -jar "$CfrJar" "$JarPath" --outputdir "$OutDir" --jarfilter "$ClassFilter"

echo "Decompiled matching classes to $OutDir"
