import {StatusBar} from 'expo-status-bar';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import {File, Paths} from 'expo-file-system';
import React, {useCallback, useEffect, useState} from 'react';
import {Linking, Platform} from 'react-native';
import {ActivityIndicator, StyleSheet, Text} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import HealthCollector, {HealthCollectorPayload} from './modules/health-collector';
import {KeyManager} from './src/services/crypto/KeyManager';
import type {Activity} from './src/services/storage';
import {getStorageAdapter} from './src/services/storage/factory';
import DashboardScreen, {SnapshotHistoryItem} from './src/platform/mobile/DashboardScreen';
import WelcomeScreen from './src/platform/mobile/WelcomeScreen';
import SetupVaultScreen from './src/platform/mobile/SetupVaultScreen';
import SignInScreen from './src/platform/mobile/SignInScreen';
import {supabase, supabaseDb, supabaseAuth} from './src/services/supabase';
import AuthCallbackWeb from './src/platform/web/AuthCallback';

const ONBOARDING_FLAG = 'vaultfit_onboarded';
const INSTALL_MARKER = 'vaultfit_install_marker';
const DEFAULT_ACTIVITY_TYPE = 'health_snapshot';

const App: React.FC = () => {
  const [appReady, setAppReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [history, setHistory] = useState<SnapshotHistoryItem[]>([]);
  const [snapshot, setSnapshot] = useState<HealthCollectorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  const parseActivity = useCallback(
    async (activity: Activity, keyOverride?: string): Promise<SnapshotHistoryItem> => {
      const keyToUse = keyOverride ?? sessionKey;
      let rawPayload = activity.data;

      if (keyToUse) {
        try {
          rawPayload = await KeyManager.decryptPayload(keyToUse, activity.data);
        } catch (decryptErr) {
          console.warn('[VaultFit] Unable to decrypt payload, falling back to raw data', decryptErr);
        }
      }

      let payload: HealthCollectorPayload | null = null;
      try {
        payload = JSON.parse(rawPayload);
      } catch (parseErr) {
        console.warn('[VaultFit] Unable to parse activity payload', parseErr);
      }

      return {
        id: activity.id,
        timestamp: activity.timestamp,
        type: activity.type,
        payload,
      };
    },
    [sessionKey],
  );

  const loadHistory = useCallback(
    async (keyOverride?: string) => {
      const storage = getStorageAdapter();
      const activities = await storage.getActivities();
      const parsed = await Promise.all(activities.map(activity => parseActivity(activity, keyOverride)));
      setHistory(parsed);
      return parsed;
    },
    [parseActivity],
  );

  const persistSnapshot = useCallback(
    async (payload: HealthCollectorPayload, keyOverride?: string) => {
      const storage = getStorageAdapter();
      // Use a replace-in-place strategy for regular health snapshots to
      // avoid unbounded DB growth. If an existing activity with the
      // DEFAULT_ACTIVITY_TYPE exists, reuse its id so `INSERT OR REPLACE`
      // will overwrite the previous row. Otherwise, create a new record.
      const recordTime = payload.lastSync ?? Date.now();
      let serialized = JSON.stringify({...payload, lastSync: recordTime});
      const keyToUse = keyOverride ?? sessionKey;

      if (keyToUse) {
        try {
          serialized = await KeyManager.encryptPayload(keyToUse, serialized);
        } catch (encryptErr) {
          console.error('[VaultFit] Encryption error', encryptErr);
          throw encryptErr;
        }
      }

      // Check storage for an existing latest snapshot entry and reuse its id
      // so we update-in-place instead of appending.
      let idToUse = recordTime.toString();
      try {
        const activities = await storage.getActivities();
        const existing = activities.find(a => a.type === DEFAULT_ACTIVITY_TYPE);
        if (existing) {
          idToUse = existing.id;
        }
      } catch (err) {
        // If reading activities fails for any reason, fall back to using a new id
        console.warn('[VaultFit] Unable to read existing activities, will insert new record', err);
      }

      await storage.saveActivity({
        id: idToUse,
        type: DEFAULT_ACTIVITY_TYPE,
        data: serialized,
        timestamp: recordTime,
      });

      // After local persistence, attempt a non-blocking upload to Supabase
      // so the server has a matching encrypted copy. Do not fail local
      // persistence if the remote upload fails.
      try {
        const user = await supabaseAuth.getUser();
        if (user) {
          await supabaseDb.uploadActivity({
            id: idToUse,
            type: DEFAULT_ACTIVITY_TYPE,
            data: serialized,
            timestamp: recordTime,
          });
        }
      } catch (err) {
        console.warn('[VaultFit] Supabase upload failed', err);
      }
    },
    [sessionKey],
  );

  useEffect(() => {
    // If we're running on web, check for an auth fragment on the current
    // URL (some magic-links land at root `/#access_token=...`). If found,
    // apply the session so the app becomes authenticated even when the
    // redirect didn't include the `/auth-callback` path.
    (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash || '';
          if (hash.includes('access_token')) {
            try {
              // Apply session from fragment and remove the hash from URL
              await supabaseAuth.setSessionFromFragment(hash);
              // Remove token fragment from the URL for cleanliness
              try {
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
              } catch (e) {
                // ignore replaceState errors
              }
              setAuthenticated(true);
              // Continue bootstrapping the app UI below
            } catch (err) {
              console.warn('[VaultFit] Failed to apply web auth fragment', err);
            }
          }
        }
      } catch (e) {
        // ignore
      }
    })();

    // Deep link handler: Supabase magic links may redirect with tokens in the
    // URL fragment (e.g. vaultfit://auth/callback#access_token=...&refresh_token=...)
    const handleUrl = async (event: {url: string}) => {
      try {
        const {url} = event;
        if (!url) return;
        // parse fragment
        const parsed = new URL(url);
        const fragment = parsed.hash ? parsed.hash.replace('#', '') : '';
        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token) {
          // Set session directly in Supabase client
          await supabase.auth.setSession({access_token, refresh_token} as any);
          setAuthenticated(true);
        }
      } catch (err) {
        console.warn('[VaultFit] deep link handling error', err);
      }
    };

    // initial URL (cold start)
    (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (initial) {
          await handleUrl({url: initial});
        }
      } catch (err) {
        console.warn('[VaultFit] error getting initial URL', err);
      }
    })();

    const sub = Linking.addEventListener('url', handleUrl as any);
    const bootstrap = async () => {
      try {
        const markerFile = new File(Paths.document, INSTALL_MARKER);
        if (!markerFile.exists) {
          console.log('[VaultFit] Fresh install detected, resetting onboarding flag');
          await SecureStore.deleteItemAsync(ONBOARDING_FLAG);
          markerFile.create({overwrite: true});
          markerFile.write('installed');
        }

        const cachedKey = await KeyManager.getSessionKey();
        if (cachedKey) {
          setSessionKey(cachedKey);
        }

        const storage = getStorageAdapter();
        await storage.initialize();
        const parsedHistory = await loadHistory(cachedKey ?? undefined);
        if (parsedHistory[0]?.payload) {
          setSnapshot(parsedHistory[0].payload);
        }

        const flag = await SecureStore.getItemAsync(ONBOARDING_FLAG);
        setOnboarded(flag === 'true');

        // Check Supabase session state
        try {
          const user = await supabaseAuth.getUser();
          setAuthenticated(!!user);
        } catch (err) {
          console.warn('[VaultFit] Supabase session check failed', err);
          setAuthenticated(false);
        }
      } catch (err) {
        console.error('[VaultFit] bootstrap failure', err);
        setError('Unable to initialize secure storage. Please restart the app.');
      } finally {
        setAppReady(true);
      }
    };

    bootstrap();
    return () => {
      try {
        sub.remove();
      } catch (e) {
        // ignore
      }
    };
  }, [loadHistory]);

  const handleVaultCreated = useCallback(
    async (derivedSessionKey: string) => {
      setSessionKey(derivedSessionKey);
      try {
        const payload = await HealthCollector.fetchLatestMetrics();
        if (!payload.lastSync) {
          payload.lastSync = Date.now();
        }

        await persistSnapshot(payload, derivedSessionKey);
        setSnapshot(payload);
        await loadHistory(derivedSessionKey);

        await SecureStore.setItemAsync(ONBOARDING_FLAG, 'true');
        setOnboarded(true);
      } catch (err) {
        console.error('[VaultFit] Vault creation error', err);
        setError('Unable to create secure vault.');
      }
    },
    [loadHistory, persistSnapshot],
  );

  const handleRefresh = useCallback(async () => {
    setError(null);
    setSyncing(true);
    try {
      const payload = await HealthCollector.fetchLatestMetrics();
      if (!payload.lastSync) {
        payload.lastSync = Date.now();
      }

      await persistSnapshot(payload);
      setSnapshot(payload);
      await loadHistory();
    } catch (err) {
      console.error('[VaultFit] Sync error', err);
      setError('Unable to sync Health data.');
    } finally {
      setSyncing(false);
    }
  }, [loadHistory, persistSnapshot]);

  if (!appReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Preparing your secure vault…</Text>
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    // If web and on /auth-callback, show the callback screen directly
    (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname === '/auth-callback') ? (
      <AuthCallbackWeb />
    ) : (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {!onboarded ? (
          // Onboarding flow: show welcome -> sign-in -> vault setup
          showWelcome ? (
            <WelcomeScreen
              syncing={syncing}
              onConnect={() => setShowWelcome(false)}
              error={error}
            />
          ) : authenticated ? (
            <SetupVaultScreen onVaultCreated={handleVaultCreated} />
          ) : (
            <SignInScreen onAuthSuccess={() => setAuthenticated(true)} />
          )
        ) : (
          <DashboardScreen
            snapshot={snapshot}
            history={history}
            refreshing={syncing}
            onRefresh={handleRefresh}
            error={error}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  ));
};

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#020617',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#cbd5f5',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  safeArea: {
    backgroundColor: '#020617',
    flex: 1,
  },
});

export default App;
