import {StatusBar} from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import {File, Paths} from 'expo-file-system';
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import HealthCollector, {HealthCollectorPayload} from './modules/health-collector';
import {KeyManager} from './src/services/crypto/KeyManager';
import type {Activity} from './src/services/storage';
import {getStorageAdapter} from './src/services/storage/factory';
import DashboardScreen, {SnapshotHistoryItem} from './src/screens/DashboardScreen';
import SetupVaultScreen from './src/screens/SetupVaultScreen';

const ONBOARDING_FLAG = 'vaultfit_onboarded';
const INSTALL_MARKER = 'vaultfit_install_marker';
const DEFAULT_ACTIVITY_TYPE = 'health_snapshot';

const App: React.FC = () => {
  const [appReady, setAppReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
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

      await storage.saveActivity({
        id: recordTime.toString(),
        type: DEFAULT_ACTIVITY_TYPE,
        data: serialized,
        timestamp: recordTime,
      });
    },
    [sessionKey],
  );

  useEffect(() => {
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
      } catch (err) {
        console.error('[VaultFit] bootstrap failure', err);
        setError('Unable to initialize secure storage. Please restart the app.');
      } finally {
        setAppReady(true);
      }
    };

    bootstrap();
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {onboarded ? (
          <DashboardScreen
            snapshot={snapshot}
            history={history}
            refreshing={syncing}
            onRefresh={handleRefresh}
            error={error}
          />
        ) : (
          <SetupVaultScreen onVaultCreated={handleVaultCreated} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
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
