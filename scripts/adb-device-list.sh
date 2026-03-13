#!/bin/sh

set -eu

MODE="${1:-list}"

list_transports() {
  adb devices -l 2>/dev/null | sed '1d' | while IFS= read -r line; do
    case "$line" in
      *" device "*)
        transport=$(printf '%s\n' "$line" | sed 's/[[:space:]]device[[:space:]].*$//' | sed 's/[[:space:]]*$//')
        ;;
      *)
        continue
        ;;
    esac

    case "$transport" in
      ""|emulator-*)
        continue
        ;;
    esac

    printf '%s\n' "$transport"
  done
}

transport_kind() {
  case "$1" in
    [0-9]*.[0-9]*.[0-9]*.[0-9]*:*)
      printf '%s\n' "ip"
      ;;
    *._adb-tls-connect._tcp)
      printf '%s\n' "mdns"
      ;;
    *)
      printf '%s\n' "serial"
      ;;
  esac
}

transport_priority() {
  case "$1" in
    ip)
      printf '%s\n' "1"
      ;;
    serial)
      printf '%s\n' "2"
      ;;
    *)
      printf '%s\n' "3"
      ;;
  esac
}

collect_rows() {
  list_transports | while IFS= read -r transport; do
    kind=$(transport_kind "$transport")
    hardware_serial=$(adb -s "$transport" shell getprop ro.serialno </dev/null 2>/dev/null | tr -d '\r' | sed 's/[[:space:]]*$//')
    model=$(adb -s "$transport" shell getprop ro.product.model </dev/null 2>/dev/null | tr -d '\r' | sed 's/[[:space:]]*$//')

    if [ -z "$hardware_serial" ]; then
      hardware_serial="$transport"
    fi

    if [ -z "$model" ]; then
      model="unknown"
    fi

    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$hardware_serial" \
      "$(transport_priority "$kind")" \
      "$kind" \
      "$model" \
      "$transport"
  done
}

print_usage() {
  cat <<'EOF'
Usage:
  adb-device-list.sh [list|all|report]

Modes:
  list    Print one canonical ADB transport per physical device. This prefers
          wireless ip:port transports, then raw serials, then mDNS aliases.
  all     Print every online transport exactly as ADB reports it.
  report  Show all online transports grouped by physical device and mark which
          transport "list" will use.
EOF
}

ROWS=$(collect_rows || true)

if [ -z "$ROWS" ]; then
  exit 0
fi

case "$MODE" in
  list)
    printf '%s\n' "$ROWS" \
      | sort -t '	' -k1,1 -k2,2n -k5,5 \
      | awk -F '	' '!seen[$1]++ { print $5 }'
    ;;
  all)
    printf '%s\n' "$ROWS" \
      | sort -t '	' -k1,1 -k2,2n -k5,5 \
      | awk -F '	' '{ print $5 }'
    ;;
  report)
    printf '%s\n' "$ROWS" \
      | sort -t '	' -k1,1 -k2,2n -k5,5 \
      | awk -F '	' '
        !seen[$1]++ {
          printf "* %s | %s | %s | %s\n", $1, $4, $3, $5
          next
        }
        {
          printf "  %s | %s | %s | %s\n", $1, $4, $3, $5
        }
      '
    ;;
  -h|--help|help)
    print_usage
    ;;
  *)
    print_usage >&2
    exit 1
    ;;
esac
