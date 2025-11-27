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

// Select an auth storage adapter depending on platform.
// - Web: use `localStorage` so session persists in the browser and
//   `supabase-js` can automatically detect the session from URL fragments
//   when `detectSessionInUrl` is enabled.
// - Native: use Expo SecureStore adapter so tokens are kept in secure storage.
const authStorage: any = typeof window !== 'undefined' && Platform.OS === 'web' ? (globalThis as any).localStorage : ExpoSecureStoreAdapter;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Let web clients detect and persist session from the URL fragment
    // automatically (this is how Supabase's hosted magic-link flow works).
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Convenience wrappers for common auth and storage operations used by the app.
export const supabaseAuth = {
  async signInWithEmail(email: string) {
    // Use a deep link redirect if available so the magic link can open the app.
    const _c = Constants as any;
    const extras = _c.expoConfig?.extra ?? _c.manifest?.extra ?? {};
    const scheme = extras.EXPO_APP_SCHEME ?? 'vaultfit';
    // On web we want the user to land on the web callback route so the
    // Supabase client can pick up and persist the session automatically.
    // Prefer a configured public `WEB_URL` (Netlify) when available so
    // magic links sent during local development don't point at `localhost`.
    const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    let webUrl = extras.WEB_URL ?? runtimeOrigin;
    // If we're running locally but a public WEB_URL exists in config, prefer it
    if (runtimeOrigin && runtimeOrigin.includes('localhost') && extras.WEB_URL) {
      webUrl = extras.WEB_URL;
    }
    const redirectTo = Platform.OS === 'web' ? `${webUrl ?? ''}/auth-callback` : `${scheme}://auth/callback`;
    // Helpful runtime debug when testing links
    // eslint-disable-next-line no-console
    console.debug('[VaultFit] signInWithEmail redirectTo=', redirectTo, 'runtimeOrigin=', runtimeOrigin, 'extras.WEB_URL=', extras.WEB_URL);

    try {
      // Use a runtime call to avoid typing mismatches between supabase versions.
      // Pass `redirectTo` so the magic link opens the correct target.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (supabase.auth as any).signInWithOtp({email}, {redirectTo});
    } catch (e) {
      // Fallback to default behavior without redirect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (supabase.auth as any).signInWithOtp({email} as any);
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
  async setSessionFromFragment(fragment: string) {
    // fragment is expected like "#access_token=...&refresh_token=..."
    const cleaned = fragment?.startsWith('#') ? fragment.slice(1) : fragment;
    const params = new URLSearchParams(cleaned);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token) {
      throw new Error('No access_token found in fragment');
    }
    // supabase.auth.setSession expects {access_token, refresh_token}
    // use any to avoid tight typings depending on installed supabase version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase.auth as any).setSession({access_token, refresh_token} as any);
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
