import {StatusBar} from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {useEffect, useState} from 'react';
import {getStorageAdapter} from './src/services/storage/factory';
import {Activity} from './src/services/storage';
import {KeyManager} from './src/services/crypto/KeyManager';
import HealthCollector from './modules/health-collector';

export default function App() {
  const [status, setStatus] = useState('Initializing...');
  const [activities, setActivities] = useState<Activity[]>([]);

  const refreshActivities = async () => {
    const storage = getStorageAdapter();
    const acts = await storage.getActivities();
    setActivities(acts);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const storage = getStorageAdapter();
        await storage.initialize();
        setStatus('Storage Initialized');
        refreshActivities();
      } catch (e) {
        setStatus(`Error: ${e}`);
      }
    };
    init();
  }, []);

  const handleGenerateKey = async () => {
    const key = await KeyManager.generateMasterKey();
    console.log('Generated Key (Mock)', key);
    alert('Master Key Generated (Mock)');
  };

  const handleStartWorkout = async () => {
    await HealthCollector.requestPermissions();
    await HealthCollector.startTracking('run');
    setStatus('Tracking started...');
  };

  const handleStopWorkout = async () => {
    const data = await HealthCollector.stopTracking();
    const storage = getStorageAdapter();
    await storage.saveActivity({
      id: Date.now().toString(),
      type: 'run',
      data: JSON.stringify(data), // In real app, this would be encrypted
      timestamp: Date.now(),
    });
    setStatus('Workout saved (Encrypted)');
    refreshActivities();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>VaultFit</Text>
        <Text style={styles.subtitle}>Zero-Knowledge Fitness</Text>

        <View style={styles.statusContainer}>
          <Text>Status: {status}</Text>
        </View>

        <View style={styles.buttonGroup}>
          <Button title="Generate Master Key" onPress={handleGenerateKey} />
          <Button title="Start Workout" onPress={handleStartWorkout} />
          <Button title="Stop & Save" onPress={handleStopWorkout} />
        </View>

        <Text style={styles.sectionTitle}>
          Recent Activities (Decrypted Local Cache)
        </Text>
        {activities.map(act => (
          <View key={act.id} style={styles.activityItem}>
            <Text>
              {act.type} - {new Date(act.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const colors = {
  white: '#fff',
  lightGray: '#eee',
  gray: '#f0f0f0',
  darkGray: '#666',
};

const styles = StyleSheet.create({
  activityItem: {
    borderBottomColor: colors.lightGray,
    borderBottomWidth: 1,
    padding: 15,
  },
  buttonGroup: {
    gap: 10,
    marginBottom: 30,
  },
  container: {
    backgroundColor: colors.white,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  statusContainer: {
    backgroundColor: colors.gray,
    borderRadius: 8,
    marginBottom: 20,
    padding: 10,
  },
  subtitle: {
    color: colors.darkGray,
    fontSize: 18,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
