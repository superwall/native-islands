# Shared by the simulator scripts. Prints the udid of the newest available
# simulator called $1, slimmed with simslim when it is installed, booted, and
# with a fixed status bar so screenshots stay comparable.
prepare_simulator() {
  local name="$1" udid
  udid="$(xcrun simctl list devices available -j | python3 -I -c '
import json, sys
name = sys.argv[1]
devices = json.load(sys.stdin)["devices"]
runtimes = sorted((r for r in devices if "iOS" in r), key=lambda r: [int(p) for p in r.split("iOS-")[-1].split("-") if p.isdigit()])
for runtime in reversed(runtimes):
    for device in devices[runtime]:
        if device["name"] == name:
            print(device["udid"]); sys.exit()
sys.exit(1)
' "$name")" || { echo "No available simulator named $name" >&2; return 1; }
  if command -v simslim >/dev/null; then simslim on "$udid" >/dev/null 2>&1 || true; fi
  xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl ui "$udid" appearance light >/dev/null 2>&1 || true
  xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3 --dataNetwork wifi >/dev/null 2>&1 || true
  echo "$udid"
}
