#!/bin/bash

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
APP_ID="com.bump.wallet"
EXPO_HOST="${EXPO_HOST:-localhost}"
EXPO_PORT="${EXPO_PORT:-8081}"
EXPO_LAN_IP="${EXPO_LAN_IP:-}"
DEVICES=$("$ROOT_DIR/scripts/adb-device-list.sh")
DEVICE_COUNT=$(echo "$DEVICES" | grep -c . || echo 0)

if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "No devices found!"
  exit 1
fi

if [ "$EXPO_HOST" = "localhost" ]; then
  echo "Using localhost mode. Setting up adb reverse on $DEVICE_COUNT device(s)..."
  for serial in $DEVICES; do
    [ -n "$serial" ] || continue
    echo "[ $serial ] Setting up reverse tcp:$EXPO_PORT..."
    adb -s "$serial" reverse "tcp:$EXPO_PORT" "tcp:$EXPO_PORT" </dev/null
  done
  METRO_URL="http://localhost:${EXPO_PORT}"
else
  LOCAL_IP="$EXPO_LAN_IP"
  if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
  fi
  METRO_URL="http://${LOCAL_IP}:${EXPO_PORT}"
fi

echo "Metro URL: ${METRO_URL}"

echo "Restarting app on all devices..."
for serial in $DEVICES; do
  [ -n "$serial" ] || continue
  echo "[ $serial ] Restarting $APP_ID..."
  adb -s "$serial" shell am force-stop "$APP_ID" </dev/null
  adb -s "$serial" shell am start -a android.intent.action.VIEW -d "exp+bump://expo-development-client/?url=${METRO_URL}" </dev/null >/dev/null 2>&1
done
echo "Done."
