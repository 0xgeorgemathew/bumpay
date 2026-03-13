#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
APP_ID="com.bump.wallet"
DEVICES=$("$ROOT_DIR/scripts/adb-device-list.sh")
DEVICE_COUNT=$(echo "$DEVICES" | grep -c . || echo 0)

if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "No devices found!"
  exit 1
fi

echo "Reloading app on all devices..."
for serial in $DEVICES; do
  [ -n "$serial" ] || continue
  echo "[ $serial ] Reloading $APP_ID..."
  adb -s "$serial" shell am broadcast -a expo.modules.devlauncher.expo.RELOAD >/dev/null 2>&1
done
echo "Done."
