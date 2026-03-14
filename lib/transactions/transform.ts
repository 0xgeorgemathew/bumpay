import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const ICON_COLORS = [
  COLORS.pink400,
  COLORS.cyan400,
  COLORS.decorativeOrange,
  COLORS.green400,
  COLORS.red500,
];

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `Today, ${displayHours}:${displayMinutes} ${ampm}`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    // Show day name for recent days
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  } else {
    // Show date for older entries
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
}

export function getRandomIconColor(): string {
  const index = Math.floor(Math.random() * ICON_COLORS.length);
  return ICON_COLORS[index];
}

export function getDisplayName(
  role: "payer" | "receiver",
  from: string,
  to: string,
  fromLabel: string | null,
  toLabel: string | null,
  userAddress: string,
): string {
  const normalizedUser = userAddress.toLowerCase();
  const fallbackName = "Unknown ENS";

  if (role === "payer") {
    // User sent money - show receiver info
    if (to.toLowerCase() === normalizedUser) {
      // Edge case: payer and receiver are same (shouldn't happen)
      return fromLabel ?? fallbackName;
    }
    return toLabel ?? fallbackName;
  } else {
    // User received money - show payer info
    if (from.toLowerCase() === normalizedUser) {
      // Edge case: receiver and payer are same (shouldn't happen)
      return toLabel ?? fallbackName;
    }
    return fromLabel ?? fallbackName;
  }
}

export function getTransactionIcon(
  role: "payer" | "receiver",
): keyof typeof Ionicons.glyphMap {
  // When user is payer, they sent money
  // When user is receiver, they received money
  return role === "payer" ? "arrow-up" : "arrow-down";
}
