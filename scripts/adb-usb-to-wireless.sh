#!/bin/sh

set -eu

# Convert a USB-connected Android device to wireless ADB connection
# Usage: adb-usb-to-wireless.sh [PORT]

PORT="${1:-5555}"

print_usage() {
  cat <<'EOF'
Usage:
  adb-usb-to-wireless.sh [PORT]

Description:
  Convert a USB-connected Android device to wireless ADB connection.
  Defaults to port 5555 if not specified.

Requirements:
  - Exactly one USB-connected Android device
  - Device must be on the same WiFi network as this machine
EOF
}

# Handle help flag
case "${1:-}" in
  -h|--help|help)
    print_usage
    exit 0
    ;;
esac

# Find USB-connected device
SERIAL=$(adb devices -l 2>/dev/null | grep "usb:" | head -1 | awk '{print $1}')

if [ -z "$SERIAL" ]; then
  echo "Error: No USB-connected device found" >&2
  echo "Make sure your device is connected via USB and USB debugging is enabled" >&2
  exit 1
fi

echo "Found USB device: $SERIAL"

# Get the device's IP address
IP=$(adb -s "$SERIAL" shell ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)

if [ -z "$IP" ]; then
  echo "Error: Could not determine device IP address" >&2
  echo "Make sure the device is connected to WiFi" >&2
  exit 1
fi

echo "Device IP address: $IP"

# Enable TCP/IP mode on the device
echo "Enabling TCP/IP mode on port $PORT..."
adb -s "$SERIAL" tcpip "$PORT"

# Wait for the device to be ready
sleep 2

# Connect to the device wirelessly
echo "Connecting to $IP:$PORT..."
if adb connect "$IP:$PORT"; then
  echo ""
  echo "Successfully connected to: $IP:$PORT"
  echo "You can now disconnect the USB cable"
else
  echo "Error: Failed to connect to $IP:$PORT" >&2
  exit 1
fi
