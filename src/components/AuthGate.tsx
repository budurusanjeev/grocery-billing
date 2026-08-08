import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';
import { useAuth } from '../state/auth';

const PUBLIC_ROUTES = new Set(['login', 'forgot-pin', 'reset-pin']);

// Redirects to /login whenever there's no active session, unless the
// current screen is already one of the public auth screens — and the
// reverse: redirects away from those public screens to the main app once
// a session exists (otherwise a successful login just silently leaves you
// sitting on the login screen with nothing telling the router to move).
//
// `children` (the Stack navigator) is ALWAYS rendered, even while
// redirecting — router.replace() has nowhere to navigate to if the Stack
// itself isn't mounted. The only thing gated behind `loading` is a full-
// screen spinner overlay, which covers the cold-start AsyncStorage session
// restore; a brief one-frame flash of a protected screen before the
// redirect effect fires is the standard, accepted tradeoff for this pattern
// (same as Supabase's own official Expo auth guide).
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const currentRoute = segments[0] ?? '';
  const onPublicRoute = PUBLIC_ROUTES.has(currentRoute);

  useEffect(() => {
    if (loading) return;
    if (!session && !onPublicRoute) {
      router.replace('/login');
    } else if (session && onPublicRoute) {
      router.replace('/');
    }
  }, [loading, session, onPublicRoute, router]);

  return (
    <>
      {children}
      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
