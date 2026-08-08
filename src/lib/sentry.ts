import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// No DSN configured (e.g. a fresh clone before it's been set up) — every
// Sentry.* call below silently no-ops rather than throwing, so the app
// behaves exactly as before crash reporting existed.
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    // Helpful in Render/EAS build logs without spamming the shopkeeper's
    // own device console in normal use.
    debug: false,
  });
}

export { Sentry };
