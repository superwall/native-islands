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
  prepare_simulator_udid "$udid"
}

# Prints the udid of one iPhone simulator for each iOS version in $1
# (comma-separated, "18" or "18.6"): the first of the names in $2 that runtime
# has, or else its first iPhone. A version with no runtime installed fails.
simulators_for_runtimes() {
  xcrun simctl list -j runtimes devices available | python3 -I -c '
import json, sys
wanted = [v for v in sys.argv[1].split(",") if v]
names = [n for n in sys.argv[2].split(",") if n]
data = json.load(sys.stdin)
runtimes = sorted(
    (r for r in data["runtimes"] if r.get("platform") == "iOS" and r.get("isAvailable")),
    key=lambda r: [int(p) for p in r["version"].split(".")],
)
missing = []
for version in wanted:
    matching = [r for r in runtimes if r["version"] == version or r["version"].startswith(version + ".")]
    phones = [d for r in reversed(matching) for d in data["devices"].get(r["identifier"], []) if d["name"].startswith("iPhone")]
    pick = next((d for n in names for d in phones if d["name"] == n), phones[0] if phones else None)
    if pick is None:
        missing.append(version)
    else:
        print(pick["udid"])
if missing:
    print("No iPhone simulator for iOS " + ", ".join(missing), file=sys.stderr)
    sys.exit(1)
' "$1" "$2"
}

# Boots the simulator $1 the way prepare_simulator does and prints its udid.
prepare_simulator_udid() {
  local udid="$1"
  if command -v simslim >/dev/null; then simslim on "$udid" >/dev/null 2>&1 || true; fi
  xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl ui "$udid" appearance light >/dev/null 2>&1 || true
  xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3 --dataNetwork wifi >/dev/null 2>&1 || true
  echo "$udid"
}
