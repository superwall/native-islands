#!/usr/bin/env bash
# Fails unless every published version in the repository matches the release tag.
# Usage: scripts/release-check.sh v0.1.0
set -euo pipefail

cd "$(dirname "$0")/.."

tag="${1:-}"
if [[ ! "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?)$ ]]; then
  echo "error: give a release tag like v0.1.0, not '$tag'" >&2
  exit 1
fi
version="${BASH_REMATCH[1]}"
failed=0

check() {
  local file="$1" found="$2"
  if [[ "$found" == "$version" ]]; then
    echo "ok: $file is $version"
  else
    echo "error: $file is '${found:-no version}', the tag wants $version" >&2
    failed=1
  fi
}

check packages/web/package.json \
  "$(sed -n 's/^  "version": "\([^"]*\)",*$/\1/p' packages/web/package.json)"

for pod in NativeIslands NativeIslandsComponents NativeIslandsMaps NativeIslandsCharts; do
  check "$pod.podspec" \
    "$(sed -n "s/^ *s\.version *= *'\([^']*\)'.*$/\1/p" "$pod.podspec")"
done

exit "$failed"
