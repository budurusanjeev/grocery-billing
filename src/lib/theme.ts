import { Platform } from 'react-native';

export const colors = {
  brand: '#166534',
  brandDark: '#0f4c2a',
  brandLight: '#dcfce7',
  accentPurple: '#7c3aed',
  accentBlue: '#0ea5e9',
  accentAmber: '#f59e0b',
  accentRed: '#dc2626',
  bg: '#eef2f0',
  card: '#ffffff',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
};

export const radius = { sm: 8, md: 10, lg: 14, xl: 20 };

// Extra breathing room at the bottom of scrollable lists so the last
// row/card isn't flush against the screen edge or home-bar area.
export const spacing = { listBottom: 28 };

// react-native-web doesn't support the `elevation` prop; both are set so
// cards get a real shadow on native and on web.
export const cardShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 2,
};

export const raisedShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 10,
  elevation: 4,
};

// Wide desktop browsers left the app stretched edge-to-edge with nothing
// to anchor the eye — cap content width and center it like a receipt.
export const webMaxWidth = 520;
export const isWeb = Platform.OS === 'web';
