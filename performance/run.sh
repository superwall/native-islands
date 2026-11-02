#!/usr/bin/env bash
# Measures the example app with 10, 50 and 100 islands on one simulator and
# fails when a number rose past its baseline in performance/baseline.json.
#
#   performance/run.sh                          # iPhone 17
#   performance/run.sh --device "iPhone Air"
#   performance/run.sh --record                 # write this device's baseline
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVICE="iPhone 17"
RECORD=""
OUT="$ROOT/build/performance"

while [ $# -gt 0 ]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --record) RECORD="--record"; shift ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

source "$ROOT/scripts/simulators.sh"

rm -rf "$OUT"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
DERIVED="$ROOT/build/DerivedData"
(cd "$ROOT/examples/ios" && xcodegen -q)
udid="$(prepare_simulator "$DEVICE")"

xcodebuild build-for-testing \
  -project "$ROOT/examples/ios/Example.xcodeproj" -scheme Example \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED" -quiet

TEST_RUNNER_PERF_OUTPUT="$OUT/result.json" \
xcodebuild test-without-building \
  -project "$ROOT/examples/ios/Example.xcodeproj" -scheme Example \
  -destination "id=$udid" \
  -derivedDataPath "$DERIVED" \
  -only-testing:ExampleUITests/PerformanceUITests \
  -resultBundlePath "$OUT/results.xcresult" \
  -quiet

bun "$ROOT/performance/check.ts" "$OUT/result.json" $RECORD
