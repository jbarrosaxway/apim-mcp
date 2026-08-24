#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <FedPath> <OutDir>" >&2
  exit 1
}

[[ $# -eq 2 ]] || usage

FedPath="$1"
OutDir="$2"

if [[ ! -f "$FedPath" ]]; then
  echo "FED not found: $FedPath" >&2
  exit 1
fi

mkdir -p "$OutDir"

zipPath="$FedPath"
tmpZip=""

if [[ ! "$FedPath" =~ \.zip$ ]]; then
  tmpZip="$(mktemp "${TMPDIR:-/tmp}/fed-XXXXXX.zip")"
  cp "$FedPath" "$tmpZip"
  zipPath="$tmpZip"
fi

cleanup() {
  if [[ -n "$tmpZip" && -f "$tmpZip" ]]; then
    rm -f "$tmpZip"
  fi
}
trap cleanup EXIT

unzip -o -q "$zipPath" -d "$OutDir"

echo "Extracted FED to $OutDir"
find "$OutDir" -name '*.xml' -type f
