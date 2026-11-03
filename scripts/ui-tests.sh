#!/usr/bin/env bash
# Runs the example app's UI tests on several simulators at once: islands
# within 0.5 pt of their web elements on every page, and screenshots against
# tests/ios/Baselines.
#
#   scripts/ui-tests.sh                       # iPhone 17 and iPhone Air
#   scripts/ui-tests.sh --devices "iPhone 17,iPhone 17e,iPhone Air"
#   scripts/ui-tests.sh --record              # rewrite the screenshot baselines
#   scripts/ui-tests.sh --only AlignmentUITests
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVICES="iPhone 17,iPhone Air"
RECORD=0
ONLY=(-only-testing:TestHostUITests/AlignmentUITests -only-testing:TestHostUITests/ScreenshotUITests)
OUT="$ROOT/build/ui-tests"

while [ $# -gt 0 ]; do
  case "$1" in
    --devices) DEVICES="$2"; shift 2 ;;
    --record) RECORD=1; shift ;;
    --only) ONLY=(-only-testing:"TestHostUITests/$2"); shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

source "$ROOT/scripts/simulators.sh"

rm -rf "$OUT"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
DERIVED="$ROOT/build/DerivedData"

(cd "$ROOT/tests/ios" && xcodegen -q)
destinations=()
IFS=',' read -ra names <<< "$DEVICES"
for name in "${names[@]}"; do
  udid="$(prepare_simulator "$name")"
  destinations+=(-destination "id=$udid")
done

xcodebuild build-for-testing \
  -project "$ROOT/tests/ios/TestHost.xcodeproj" -scheme TestHost \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED" -quiet

TEST_RUNNER_BASELINES_DIR="$ROOT/tests/ios/Baselines" \
TEST_RUNNER_RECORD_BASELINES="$RECORD" \
TEST_RUNNER_OUTPUT_DIR="$OUT/failures" \
xcodebuild test-without-building \
  -project "$ROOT/tests/ios/TestHost.xcodeproj" -scheme TestHost \
  "${destinations[@]}" \
  -maximum-concurrent-test-simulator-destinations "${#names[@]}" \
  -derivedDataPath "$DERIVED" \
  "${ONLY[@]}" \
  -resultBundlePath "$OUT/results.xcresult" \
  -quiet

echo "UI tests passed on: $DEVICES"
