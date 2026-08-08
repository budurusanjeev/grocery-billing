import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Supabase reads the stored session immediately on construction (not
// lazily), and AsyncStorage's web implementation touches window.localStorage
// — which doesn't exist during `expo export -p web`'s static server-side
// prerendering (Node.js has no `window`). This wrapper no-ops during SSR
// and defers to real AsyncStorage once actually running in a browser/native.
const ssrSafeStorage = {
  getItem: (key: string) =>
    typeof window === 'undefined' ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.removeItem(key),
};

// The anon/public key is designed to be exposed client-side — Row Level
// Security on the Supabase tables is what actually protects the data.
// (In this app, data reads/writes for items go through the server proxy,
// not this client directly — this client is used for Auth only.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ssrSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Automatic URL-based session detection isn't reliable in React Native;
    // the reset-PIN link is parsed and handled manually instead (see
    // src/app/reset-pin.tsx).
    detectSessionInUrl: false,
  },
});
