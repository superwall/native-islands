#!/usr/bin/env bash
# Runs the package's checks on one iPhone simulator of every installed iOS
# runtime, one runtime after another, and prints a pass/fail table. The WebKit
# probe (WebKitLayoutTests) writes each runtime's view tree to $OUT/trees, and
# scripts/webkit-tree-diff.ts compares them with the newest.
#
#   scripts/compat-matrix.sh                      # the WebKit probe everywhere
#   scripts/compat-matrix.sh --steps probe,swift  # and the whole Swift suite
#   scripts/compat-matrix.sh --steps probe,swift,ui  # and islands on their web elements in TestHost
#
# The ui step runs AlignmentUITests on each runtime's simulator. Screenshots
# are compared per iOS major on the simulators that have baselines:
# scripts/ui-tests.sh --runtimes 17.5,18.6,26.5,27.2.
#   scripts/compat-matrix.sh --runtimes 17.5,18.6,27.2
#   scripts/compat-matrix.sh --list               # the runtimes and simulators it would use
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STEPS="probe"
RUNTIMES=""
OUT="$ROOT/build/compat"
LIST=0

while [ $# -gt 0 ]; do
  case "$1" in
    --steps) STEPS="$2"; shift 2 ;;
    --runtimes) RUNTIMES="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --list) LIST=1; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

# One line per runtime: "<runtime> <version> <udid> <device name>". A runtime
# without an iPhone simulator gets one made from the newest iPhone it supports.
runtimes() {
  xcrun simctl list -j runtimes devicetypes devices available | python3 -I -c '
import json, subprocess, sys
wanted = [v for v in sys.argv[1].split(",") if v]
data = json.load(sys.stdin)
phones = [t for t in data["devicetypes"] if t.get("productFamily") == "iPhone"]
seen = set()
installed = {r["version"] for r in data["runtimes"] if r.get("platform") == "iOS" and r.get("isAvailable")}
for runtime in sorted(data["runtimes"], key=lambda r: [int(p) for p in r["version"].split(".")]):
    if runtime.get("platform") != "iOS" or not runtime.get("isAvailable"):
        continue
    version = runtime["version"]
    key = runtime["identifier"].rsplit(".", 1)[-1]
    # "26.4" takes 26.4 itself when it is installed and 26.4.x only when not,
    # so a job asking for one patch release never probes a second.
    if wanted and not any(version == w or (w not in installed and version.startswith(w + ".")) for w in wanted):
        continue
    if runtime["identifier"] in seen:
        continue
    seen.add(runtime["identifier"])
    devices = [d for d in data["devices"].get(runtime["identifier"], []) if d["name"].startswith("iPhone")]
    if devices:
        device = sorted(devices, key=lambda d: (d["state"] != "Booted", d["name"]))[0]
        print(key, version, device["udid"], device["name"])
        continue
    supported = {t["identifier"] for t in runtime.get("supportedDeviceTypes", [])}
    types = [t for t in phones if t["identifier"] in supported]
    if not types:
        print(f"skip {version}: no iPhone simulator supports it", file=sys.stderr)
        continue
    name = types[-1]["name"]
    udid = subprocess.check_output(["xcrun", "simctl", "create", f"{name} ({version})", types[-1]["identifier"], runtime["identifier"]], text=True).strip()
    print(key, version, udid, name)
' "$RUNTIMES"
}

matrix="$(runtimes)"
if [ -z "$matrix" ]; then
  echo "No installed iOS runtime matches ${RUNTIMES:-anything}." >&2
  exit 1
fi
if [ "$LIST" = 1 ]; then
  echo "$matrix"
  exit 0
fi

rm -rf "$OUT"
mkdir -p "$OUT/trees" "$OUT/logs"
OUT="$(cd "$OUT" && pwd)"
DERIVED="$ROOT/build/DerivedData"

xcodebuild build-for-testing -scheme NativeIslands-Package \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED" -quiet

results=()
failed=0
while read -r key version udid name; do
  row="iOS $version ($key) on $name:"
  IFS=',' read -ra steps <<< "$STEPS"
  for step in "${steps[@]}"; do
    case "$step" in
      probe) only=(-only-testing:NativeIslandsTests/NativeBridgeTests/WebKitLayoutTests) ;;
      swift) only=() ;;
      ui) ;;
      *) echo "unknown step $step" >&2; exit 2 ;;
    esac
    log="$OUT/logs/$key-$step.log"
    if [ "$step" = ui ]; then
      if "$ROOT/scripts/ui-tests.sh" --udids "$udid" --only AlignmentUITests --out "$OUT/ui/$key" >"$log" 2>&1; then
        row="$row $step pass"
      else
        row="$row $step FAIL"
        failed=1
        grep -E "error:|differs from its baseline|No baseline" "$log" | head -20 >&2 || true
      fi
      continue
    fi
    if TEST_RUNNER_WEBKIT_TREE_DIR="$OUT/trees" xcodebuild test-without-building \
      -scheme NativeIslands-Package -destination "id=$udid" -derivedDataPath "$DERIVED" \
      ${only[@]+"${only[@]}"} -resultBundlePath "$OUT/$key-$step.xcresult" \
      >"$log" 2>&1; then
      row="$row $step pass"
    else
      row="$row $step FAIL"
      failed=1
      grep -E "✘|error:" "$log" | head -20 >&2 || true
    fi
  done
  results+=("$row")
done <<< "$matrix"

printf '%s\n' "${results[@]}"
if ls "$OUT/trees"/*.json >/dev/null 2>&1; then
  bun "$ROOT/scripts/webkit-tree-diff.ts" "$OUT/trees" || failed=1
fi
exit "$failed"
