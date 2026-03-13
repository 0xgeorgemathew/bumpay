#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
ANDROID_DIR="$ROOT_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APP_ID="com.bump.wallet"

# Build once
cd "$ANDROID_DIR"
echo "Building debug APK..."
./gradlew app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=arm64-v8a

# Get device list into array
DEVICES=$("$ROOT_DIR/scripts/adb-device-list.sh")
DEVICE_COUNT=$(echo "$DEVICES" | grep -c . || echo 0)

if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "No devices found!"
  exit 1
fi

echo "Found $DEVICE_COUNT device(s):"
echo "$DEVICES" | while read -r d; do echo "  - $d"; done

# Install on all devices in parallel
echo "Installing on all devices..."
PIDS=""
while IFS= read -r serial; do
  [ -n "$serial" ] || continue
  (
    echo "[ $serial ] Installing..."
    adb -s "$serial" install -r "$APK_PATH" </dev/null && {
      echo "[ $serial ] Launching app..."
      adb -s "$serial" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 </dev/null >/dev/null 2>&1 || true
      echo "[ $serial ] Done!"
    }
  ) &
  PIDS="$PIDS $!"
done <<EOF
$DEVICES
EOF

# Wait for all installations to complete
wait $PIDS
echo "All devices updated!"
