import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { requireInternet } from '../lib/network';
import { cardShadow, colors, pressedDim, radius, ripple } from '../lib/theme';
import { showMessage } from '../lib/ui';
import { useAuth } from '../state/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPin } = useAuth();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || pin.length < 4) {
      showMessage('Missing details', 'Enter your email and PIN.');
      return;
    }
    if (!(await requireInternet())) return;
    setSubmitting(true);
    const { error } = await signInWithPin(email.trim(), pin);
    setSubmitting(false);
    if (error) {
      showMessage('Could not log in', error);
    }
    // On success, AuthGate reacts to the new session and navigates away.
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <Text style={styles.title}>Groci</Text>
          <Text style={styles.tagline}>Say it. Snap it. Done.</Text>
          <Text style={styles.subtitle}>Log in to your shop</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit PIN"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
          />

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Logging in…' : 'Log In'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.forgotLink, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={() => router.push('/forgot-pin')}
          >
            <Text style={styles.forgotLinkText}>Forgot PIN?</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 72, height: 72, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.brandDark },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 10 },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    gap: 6,
    ...cardShadow,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    overflow: 'hidden',
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  forgotLink: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, overflow: 'hidden' },
  forgotLinkText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
});
