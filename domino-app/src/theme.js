import { Platform } from 'react-native';

// Warm editorial palette: deep ink green on cream, with a brass accent used
// sparingly for actions and emphasis — never for large surfaces.
export const colors = {
  background: '#F7F3EB',
  surface: '#FFFFFF',
  surfaceAlt: '#EFE9DD',
  primary: '#22432B',
  primaryDark: '#16301E',
  primarySoft: '#E3EBE2',
  accent: '#B07A32',
  accentSoft: '#F4E8D4',
  text: '#1E241F',
  textMuted: '#70756C',
  border: '#E4DDCE',
  success: '#22432B',
  danger: '#A94B32',
  overlayDone: '#DCE7DB',
  overlayMissed: '#EFD9CE',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

// Fraunces carries the display voice; body text stays on the system stack for
// legibility at small sizes. Fonts are loaded once in the root layout.
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
};

// Soft, low-spread shadows — depth without the "floating card" look.
export const elevation = {
  card: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(30, 36, 31, 0.05), 0 4px 16px rgba(30, 36, 31, 0.06)' },
    default: {
      shadowColor: '#1E241F',
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  }),
  raised: Platform.select({
    web: { boxShadow: '0 2px 4px rgba(30, 36, 31, 0.08), 0 8px 24px rgba(30, 36, 31, 0.10)' },
    default: {
      shadowColor: '#1E241F',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
};

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, color: colors.text },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.text },
  quote: { fontFamily: fonts.displayItalic, fontSize: 18, lineHeight: 27, color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
};
