import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, isWeb, raisedShadow, webMaxWidth } from '../lib/theme';

// On native this is just a plain full-bleed screen. On web, wide browser
// windows left the app stretched edge-to-edge with nothing to anchor the
// eye — this centers a phone-width "receipt" card over a softly tinted
// backdrop instead.
export default function ScreenContainer({ children }: { children: React.ReactNode }) {
  if (!isWeb) {
    return <View style={styles.nativeScreen}>{children}</View>;
  }
  return (
    <View style={styles.webBackdrop}>
      <View style={styles.blobTopLeft} />
      <View style={styles.blobBottomRight} />
      <View style={styles.webCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeScreen: { flex: 1, backgroundColor: colors.bg },
  webBackdrop: {
    flex: 1,
    // No minHeight here — this sits below the nav header, so forcing a
    // full 100vh on top of the header pushed the page taller than the
    // viewport and shoved the bottom row past the fold. flex: 1 alone
    // fills exactly the remaining space beneath the header.
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingVertical: 28,
    overflow: 'hidden',
  },
  blobTopLeft: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: colors.brandLight,
    opacity: 0.55,
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -140,
    width: 360,
    height: 360,
    borderRadius: 360,
    backgroundColor: '#fef3c7',
    opacity: 0.5,
  },
  webCard: {
    width: '100%',
    maxWidth: webMaxWidth,
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    ...raisedShadow,
  },
});
