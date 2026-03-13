#!/bin/bash

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
APP_ID="com.bump.wallet"
EXPO_PORT="${EXPO_PORT:-8081}"
DEVICES=$("$ROOT_DIR/scripts/adb-device-list.sh")
DEVICE_COUNT=$(echo "$DEVICES" | grep -c . || echo 0)

if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "No devices found!"
  exit 1
fi

LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
METRO_URL="http://${LOCAL_IP}:${EXPO_PORT}"

echo "Restarting app on all devices..."
for serial in $DEVICES; do
  [ -n "$serial" ] || continue
  echo "[ $serial ] Restarting $APP_ID..."
  adb -s "$serial" shell am force-stop "$APP_ID" </dev/null
  adb -s "$serial" shell am start -a android.intent.action.VIEW -d "exp+bump://expo-development-client/?url=${METRO_URL}" </dev/null >/dev/null 2>&1
done
echo "Done."
