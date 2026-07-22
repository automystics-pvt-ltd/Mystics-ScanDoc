/**
 * Design tokens synced from the sibling DocScan web artifact (index.css).
 * Deep Navy-Indigo primary with Amber accent — shared visual identity.
 */

const colors = {
  light: {
    text: '#0E192A',
    tint: '#FF8800',

    background: '#F3F5FA',
    foreground: '#0E192A',

    card: '#FFFFFF',
    cardForeground: '#0E192A',

    primary: '#0E192A',
    primaryForeground: '#F6F9FC',

    secondary: '#F1F3F7',
    secondaryForeground: '#0E192A',

    muted: '#F1F3F7',
    mutedForeground: '#6E7780',

    accent: '#FF8800',
    accentForeground: '#0E192A',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    border: '#E1E4EC',
    input: '#E1E4EC',

    navBackground: '#0E192A',
    success: '#22C55E',
  },
  dark: {
    text: '#F6F9FC',
    tint: '#FF8800',

    background: '#0E192A',
    foreground: '#F6F9FC',

    card: '#141F35',
    cardForeground: '#F6F9FC',

    primary: '#FF8800',
    primaryForeground: '#0E192A',

    secondary: '#192840',
    secondaryForeground: '#F6F9FC',

    muted: '#192840',
    mutedForeground: '#8FA3BD',

    accent: '#FF8800',
    accentForeground: '#0E192A',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    border: '#192840',
    input: '#192840',

    navBackground: '#0A1220',
    success: '#22C55E',
  },

  // Border radius in px (from web: --radius: 0.375rem = 6px)
  radius: 6,
};

export default colors;
