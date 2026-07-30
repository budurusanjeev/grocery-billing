import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { isWeb, cardShadow, colors, pressedDim, radius, ripple } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { showMessage } from '../lib/ui';
import { useAuth } from '../state/auth';

// Supabase's recovery link carries the session as a URL fragment, e.g.
// "...#access_token=...&refresh_token=...&type=recovery". detectSessionInUrl
// is off (see src/lib/supabase.ts), so that fragment is parsed by hand here
// and turned into an active session via setSession.
function parseFragment(url: string | null): Record<string, string> {
  if (!url) return {};
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};
  const fragment = url.slice(hashIndex + 1);
  const params: Record<string, string> = {};
  for (const pair of fragment.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }
  return params;
}

export default function ResetPinScreen() {
  const router = useRouter();
  const { updatePin } = useAuth();
  const incomingUrl = Linking.useURL();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const rawUrl = incomingUrl ?? (isWeb ? window.location.href : null);
    const params = parseFragment(rawUrl);

    if (!params.access_token || !params.refresh_token) {
      setChecking(false);
      return;
    }

    supabase.auth
      .setSession({ access_token: params.access_token, refresh_token: params.refresh_token })
      .then(({ error }) => {
        if (error) {
          showMessage('Link expired', 'This reset link is invalid or has expired. Request a new one.');
        } else {
          setReady(true);
        }
        setChecking(false);
      });
  }, [incomingUrl]);

  const onSubmit = async () => {
    if (pin.length < 4) {
      showMessage('PIN too short', 'Choose at least a 4-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      showMessage("PINs don't match", 'Enter the same PIN in both fields.');
      return;
    }
    setSubmitting(true);
    const { error } = await updatePin(pin);
    setSubmitting(false);
    if (error) {
      showMessage('Could not update PIN', error);
      return;
    }
    showMessage('PIN updated', 'Log in with your new PIN.');
    router.replace('/login');
  };

  return (
    <ScreenContainer>
      <View style={styles.screen}>
        <View style={styles.form}>
          {checking && <Text style={styles.subtitle}>Checking your reset link…</Text>}

          {!checking && !ready && (
            <>
              <Text style={styles.title}>Link expired</Text>
              <Text style={styles.subtitle}>
                This reset link is invalid or has expired. Request a new one from the login screen.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && pressedDim]}
                android_ripple={ripple.onDark}
                onPress={() => router.replace('/login')}
              >
                <Text style={styles.submitBtnText}>Back to log in</Text>
              </Pressable>
            </>
          )}

          {!checking && ready && (
            <>
              <Text style={styles.title}>Set a new PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="New 6-digit PIN"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new PIN"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, ''))}
              />
              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && pressedDim]}
                android_ripple={ripple.onDark}
                onPress={onSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : 'Save New PIN'}</Text>
              </Pressable>
            </>
          )}
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
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
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
});
