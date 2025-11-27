import {createClient} from '@supabase/supabase-js';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';

// Read Supabase config from environment. Do NOT embed service_role keys
// in client code. Use the public/anon key for client-side usage.
// Some dev setups inject env vars at build-time (process.env), while
// Expo apps commonly expose them via `app.config.js` into
// `Constants.expoConfig.extra`. Support both so local `.env.local` works
// in most dev flows.
const _c = Constants as any;
const extras = _c.expoConfig?.extra ?? _c.manifest?.extra ?? {};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extras.EXPO_PUBLIC_SUPABASE_URL;
// Prefer explicit anon key; some projects may also expose a `PUBLISHABLE` key
// — prefer the anon key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`).
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY ?? extras.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extras.EXPO_PUBLIC_SUPABASE_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL environment variable. Add it to .env.local');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_KEY) environment variable. Add it to .env.local');
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? localStorage : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Convenience wrappers for common auth and storage operations used by the app.
export const supabaseAuth = {
  async signInWithEmail(email: string) {
    // Use a deep link redirect if available so the magic link can open the app.
    const _c = Constants as any;
    const extras = _c.expoConfig?.extra ?? _c.manifest?.extra ?? {};
    const scheme = extras.EXPO_APP_SCHEME ?? 'vaultfit';
    const redirectTo = extras.EXPO_PUBLIC_SUPABASE_DEEP_LINK ?? `${scheme}://auth/callback`;
    try {
      return supabase.auth.signInWithOtp({email} as any);
    } catch (e) {
      // Fallback to default behavior
      return supabase.auth.signInWithOtp({email} as any);
    }
  },
  // Note: password-based sign-in removed — app uses magic-link only.
  async signInWithPhone(phone: string) {
    return supabase.auth.signInWithOtp({phone});
  },
  async signOut() {
    return supabase.auth.signOut();
  },
  async getUser() {
    const {data} = await supabase.auth.getUser();
    return data.user;
  },
};

export const supabaseDb = {
  // Upload an encrypted activity row to Supabase table `remote_activities`.
  // Table schema expected: id text primary key, user_id text, type text, data text, timestamp bigint
  async uploadActivity(activity: {id: string; type: string; data: string; timestamp: number}) {
    const {data: userData} = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const payload = {
      id: activity.id,
      user_id: userId,
      type: activity.type,
      data: activity.data,
      timestamp: activity.timestamp,
    };

    // use upsert to replace existing row with same id
    const {error} = await supabase.from('remote_activities').upsert(payload);
    if (error) throw error;
    return true;
  },
};
