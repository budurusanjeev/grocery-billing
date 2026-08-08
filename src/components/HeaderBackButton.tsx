import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { pressedDim, ripple } from '../lib/theme';

// expo-router's web Stack sometimes lands on a route with no in-app
// navigation history (deep link, browser refresh) — in that case there is
// nothing to go "back" to, so fall back to the billing home screen.
export default function HeaderBackButton() {
  const router = useRouter();
  return (
    <Pressable
      hitSlop={12}
      style={({ pressed }) => [styles.btn, pressed && pressedDim]}
      android_ripple={ripple.onDark}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      <Text style={styles.text}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
});