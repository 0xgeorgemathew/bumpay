export const COLORS = {
  background: "#FFE500", // Vibrant Yellow
  surface: "#FFFFFF", // Pure White
  surfaceInverted: "#000000", // Pure Black
  primaryAction: "#000000", // Pure Black
  secondaryAction: "#00FF00", // Lime Green
  border: "#000000", // Pure Black
  textPrimary: "#000000", // Pure Black
  textInverted: "#FFFFFF", // Pure White
  error: "#FF0000", // Pure Red
  success: "#00CC44", // Pure Green
  warning: "#FF8800", // Pure Orange

  // Splash screen colors
  primaryBlue: "#0d59f2",
  decorativeYellow: "#facc15", // yellow-400
  decorativeGreen: "#4ade80", // green-400
  decorativePink: "#f472b6", // pink-400
  decorativeOrange: "#f97316", // orange-500
  progressYellow: "#fde047", // yellow-300

  // Kept temporarily to avoid breaking components midway through refactor
  white: "#FFFFFF",
  black: "#000000",

  // Home redesign colors
  backgroundLight: "#f5f6f8",
  green400: "#4ade80",
  yellow400: "#facc15",
  pink400: "#f472b6",
  cyan400: "#22d3ee",
  red500: "#ef4444",
  textMuted: "#64748b",
};

export const SHADOW = {
  sm: {
    offset: { width: 4, height: 4 },
    opacity: 1,
    radius: 0,
    elevation: 4,
  },
  md: {
    offset: { width: 8, height: 8 },
    opacity: 1,
    radius: 0,
    elevation: 8,
  },
  lg: {
    offset: { width: 12, height: 12 },
    opacity: 1,
    radius: 0,
    elevation: 12,
  },
};

// Legacy exports to prevent immediate breaking
export const SHADOW_SM = SHADOW.sm;
export const SHADOW_LG = SHADOW.lg;

export const BORDER = {
  width: 4,
  radius: 0,
};

export const BORDER_THIN = {
  width: 2,
  radius: 0,
};

export const BORDER_THICK = {
  width: 4,
  radius: 0,
};

export const BORDER_EXTRA_THICK = {
  width: 4,
  radius: 0,
};

export const TYPOGRAPHY = {
  hero: {
    fontSize: 64,
    fontWeight: "900" as const,
    letterSpacing: 2,
  },
  title: {
    fontSize: 40,
    fontWeight: "900" as const,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
};
