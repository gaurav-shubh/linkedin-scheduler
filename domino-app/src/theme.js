import { Platform } from 'react-native';

// Atoms-style language: deep navy ink on warm cream, one coral action color,
// big rounded shapes, chunky geometric type, oversized numerals.
export const colors = {
  background: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EAE0',
  ink: '#0B2239',
  primary: '#0B2239',
  primaryDark: '#061627',
  primarySoft: '#E7EDF3',
  accent: '#F4633A',
  accentSoft: '#FDE8E0',
  text: '#0B2239',
  textMuted: '#6E7B89',
  textOnInk: '#FFFFFF',
  mutedOnInk: '#9FB3C8',
  border: '#E8E1D5',
  success: '#1F7A53',
  successSoft: '#DEF0E6',
  danger: '#C2452D',
  overlayDone: '#DEF0E6',
  overlayMissed: '#F8DFD5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
};

// Figtree is the closest open face to Circular — geometric, rounded, friendly-bold.
export const fonts = {
  display: 'Figtree_800ExtraBold',
  displayItalic: 'Figtree_700Bold',
  bold: 'Figtree_700Bold',
  medium: 'Figtree_500Medium',
};

export const elevation = {
  card: Platform.select({
    web: { boxShadow: '0 2px 4px rgba(11, 34, 57, 0.04), 0 6px 20px rgba(11, 34, 57, 0.06)' },
    default: {
      shadowColor: '#0B2239',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
  }),
  raised: Platform.select({
    web: { boxShadow: '0 4px 8px rgba(11, 34, 57, 0.10), 0 12px 28px rgba(11, 34, 57, 0.12)' },
    default: {
      shadowColor: '#0B2239',
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }),
};

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, color: colors.text },
  numeral: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.text },
  quote: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 16, color: colors.text, lineHeight: 23 },
  muted: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
};
