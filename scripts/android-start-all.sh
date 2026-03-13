#!/bin/bash

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
APP_ID="com.bump.wallet"
EXPO_HOST="${EXPO_HOST:-localhost}"
EXPO_PORT="${EXPO_PORT:-8081}"
EXPO_LAN_IP="${EXPO_LAN_IP:-}"
EXPO_REUSE_METRO="${EXPO_REUSE_METRO:-0}"
DEVICES=$("$ROOT_DIR/scripts/adb-device-list.sh")
DEVICE_COUNT=$(echo "$DEVICES" | grep -c . || echo 0)

case "$EXPO_HOST" in
  lan|tunnel|localhost)
    ;;
  *)
    echo "Unsupported EXPO_HOST value: $EXPO_HOST"
    echo "Use one of: lan, tunnel, localhost"
    exit 1
    ;;
esac

if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "No devices found!"
  exit 1
fi

is_metro_ready() {
  curl -fsS "http://localhost:$EXPO_PORT/status" >/dev/null 2>&1
}

metro_pids() {
  lsof -tiTCP:"$EXPO_PORT" -sTCP:LISTEN 2>/dev/null || true
}

stop_existing_metro() {
  PIDS=$(metro_pids)

  if [ -z "$PIDS" ]; then
    return 0
  fi

  echo "Stopping existing Metro on port $EXPO_PORT: $PIDS"
  kill $PIDS 2>/dev/null || true

  for _ in $(seq 1 20); do
    if ! lsof -nP -iTCP:"$EXPO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo "Failed to stop existing Metro on port $EXPO_PORT." >&2
  exit 1
}

if [ "$EXPO_HOST" = "localhost" ]; then
  echo "Using localhost mode. Setting up adb reverse on $DEVICE_COUNT device(s)..."
  for serial in $DEVICES; do
    [ -n "$serial" ] || continue
    echo "[ $serial ] Setting up reverse tcp:$EXPO_PORT..."
    adb -s "$serial" reverse "tcp:$EXPO_PORT" "tcp:$EXPO_PORT" </dev/null
  done
else
  echo "Using Expo host mode: $EXPO_HOST"
fi

# Get local IP for lan mode
if [ "$EXPO_HOST" = "lan" ]; then
  LOCAL_IP="$EXPO_LAN_IP"
  if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
  fi
  METRO_URL="http://${LOCAL_IP}:${EXPO_PORT}"
elif [ "$EXPO_HOST" = "localhost" ]; then
  METRO_URL="http://localhost:${EXPO_PORT}"
else
  METRO_URL="http://localhost:${EXPO_PORT}"
fi

echo "Metro URL: ${METRO_URL}"

# If Metro is already running, either reuse it or restart so this session can
# stay attached to Metro logs.
if is_metro_ready; then
  if [ "$EXPO_REUSE_METRO" = "1" ]; then
    echo "Reusing existing Expo dev server on port $EXPO_PORT."
    echo "Launching app on all devices..."
    for serial in $DEVICES; do
      [ -n "$serial" ] || continue
      echo "[ $serial ] Launching $APP_ID..."
      adb -s "$serial" shell am force-stop "$APP_ID" </dev/null
      adb -s "$serial" shell am start -a android.intent.action.VIEW -d "exp+bump://expo-development-client/?url=${METRO_URL}" </dev/null >/dev/null 2>&1
    done
    exit 0
  fi

  echo "Metro is already running on port $EXPO_PORT."
  echo "Restarting it so this session stays attached to Metro logs."
  stop_existing_metro
fi

if lsof -nP -iTCP:"$EXPO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $EXPO_PORT is already in use, but it is not responding like Metro."
  echo "Stop the process using that port or rerun with EXPO_PORT=<port>."
  exit 1
fi

# Background task to launch apps once Metro is ready
launch_apps_when_ready() {
  for i in $(seq 1 60); do
    if is_metro_ready; then
      sleep 1  # Give Metro a moment to fully initialize
      echo ""
      echo "Launching app on all devices..."
      for serial in $DEVICES; do
        [ -n "$serial" ] || continue
        echo "[ $serial ] Launching $APP_ID..."
        adb -s "$serial" shell am force-stop "$APP_ID" </dev/null
        adb -s "$serial" shell am start -a android.intent.action.VIEW -d "exp+bump://expo-development-client/?url=${METRO_URL}" </dev/null >/dev/null 2>&1
      done
      break
    fi
    sleep 1
  done
}

# Start app launcher in background
launch_apps_when_ready &
echo ""
echo "Starting Metro in the foreground. Use Expo's interactive controls for reloads."
echo ""
exec npx expo start --dev-client --host "$EXPO_HOST" --port "$EXPO_PORT" -c
