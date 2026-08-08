import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { requireInternet } from '../lib/network';
import { cardShadow, colors, pressedDim, radius, ripple } from '../lib/theme';
import { showMessage } from '../lib/ui';
import { useAuth } from '../state/auth';

export default function ForgotPinScreen() {
  const router = useRouter();
  const { sendPinResetEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      showMessage('Missing email', 'Enter the email you log in with.');
      return;
    }
    if (!(await requireInternet())) return;
    setSubmitting(true);
    const { error } = await sendPinResetEmail(email.trim());
    setSubmitting(false);
    if (error) {
      showMessage('Could not send reset link', error);
      return;
    }
    showMessage('Check your email', 'Follow the link we sent to set a new PIN.');
    router.back();
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.form}>
          <Text style={styles.title}>Reset your PIN</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send a link to set a new PIN.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && pressedDim]}
            android_ripple={ripple.onDark}
            onPress={onSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Sending…' : 'Send Reset Link'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.backLink, pressed && pressedDim]}
            android_ripple={ripple.onLight}
            onPress={() => router.back()}
          >
            <Text style={styles.backLinkText}>Back to log in</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: 'center' },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    gap: 10,
    ...cardShadow,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.brandDark },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 6 },
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
    marginTop: 8,
    overflow: 'hidden',
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  backLink: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, overflow: 'hidden' },
  backLinkText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
});
