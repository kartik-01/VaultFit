import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Share,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import HealthCollector from '../../../modules/health-collector';
import {KeyManager} from '../../services/crypto/KeyManager';

interface SetupVaultScreenProps {
  onVaultCreated: (sessionKey: string) => void;
}

type Step = 'welcome' | 'permissions' | 'mnemonic' | 'creating';

const SetupVaultScreen: React.FC<SetupVaultScreenProps> = ({
  onVaultCreated,
}) => {
  const [step, setStep] = useState<Step>('welcome');
  const [mnemonic, setMnemonic] = useState<string>('');
  // PIN removed per user preference; onboarding no longer collects a PIN
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const generate = async () => {
      if (step === 'mnemonic' && !mnemonic) {
        const newMnemonic = await KeyManager.generateMnemonic();
        setMnemonic(newMnemonic);
      }
    };
    generate();
  }, [step, mnemonic]);

  const requestPermissions = async () => {
    setIsProcessing(true);
    try {
      // Request HealthKit permissions
      // The module returns true/false or rejects
      const granted = await HealthCollector.requestPermissions();
      if (granted) {
        setStep('mnemonic');
      } else {
        Alert.alert(
          'Permission Required',
          'VaultFit needs access to Health data to function. Please grant permissions.',
        );
      }
    } catch (error) {
      console.error('Permission error:', error);
      Alert.alert('Error', 'Failed to request permissions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const createVault = async (finalPin?: string) => {
    setStep('creating');
    try {
      const sessionKey = await KeyManager.initializeVault(mnemonic, finalPin);
      onVaultCreated(sessionKey);
    } catch (error) {
      Alert.alert('Error', 'Failed to create vault. Please try again.');
      // If we failed, fall back to mnemonic step to let user retry saving
      setStep('mnemonic');
      setPin('');
    }
  };

    const renderWelcomeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.icon}>🚀</Text>
      <Text style={styles.title}>Welcome to VaultFit</Text>
      <Text style={styles.subtitle}>
        Private Apple Health insights stored locally using libsodium + SQLCipher.
      </Text>
      <View style={styles.highlightsRow}>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightTitle}>Zero-Knowledge</Text>
          <Text style={styles.highlightCopy}>
            Master keys derived on-device with Argon2.
          </Text>
        </View>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightTitle}>Instant Sync</Text>
          <Text style={styles.highlightCopy}>
            Health metrics stay encrypted on your phone.
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => setStep('permissions')}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissionsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.icon}>❤️</Text>
      <Text style={styles.title}>Health Access</Text>
      <Text style={styles.subtitle}>
        VaultFit needs access to your Health data to encrypt and analyze it
        locally on your device. Your data never leaves your phone unencrypted.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={requestPermissions}
        disabled={isProcessing}>
        {isProcessing ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Grant Permissions</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderMnemonicStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.icon}>🔐</Text>
      <Text style={styles.title}>Recovery Phrase</Text>
      <Text style={styles.subtitle}>
        Write down these 12 words. This is the ONLY way to recover your vault if
        you lose access to this device. You can copy or save them now.
      </Text>

      <View style={styles.mnemonicContainer}>
        {mnemonic.split(' ').map((word, index) => (
          <View key={index} style={styles.wordBadge}>
            <Text style={styles.wordIndex}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <View style={{width: '100%', gap: 12}}>
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            // Copy to clipboard
            try {
              await Clipboard.setStringAsync(mnemonic);
              Alert.alert('Copied', 'Recovery phrase copied to clipboard.');
            } catch (err) {
              console.warn('[SetupVault] copy failed', err);
              Alert.alert('Copy failed', 'Unable to copy to clipboard.');
            }
          }}>
          <Text style={styles.buttonText}>Copy Recovery Phrase</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, {backgroundColor: '#60a5fa'}]}
          onPress={async () => {
            // Try to save via share/export
            try {
              const filename = `vaultfit-recovery-${Date.now()}.txt`;
              const content = mnemonic;
              // Write to temp file - prefer expo-sharing shareAsync; fall back to RN Share
              let path = '';
              try {
                const fs = require('expo-file-system');
                const uri = fs.cacheDirectory + filename;
                await fs.writeAsStringAsync(uri, content, {encoding: fs.EncodingType.UTF8});
                path = uri;
              } catch (fsErr) {
                console.warn('[SetupVault] write file failed', fsErr);
              }

              if (path && (await Sharing.isAvailableAsync())) {
                await Sharing.shareAsync(path);
              } else {
                // Fallback to RN Share
                try {
                  await Share.share({message: content});
                } catch (shareErr) {
                  Alert.alert('Saved', 'Recovery phrase ready.');
                }
              }
            } catch (err) {
              console.warn('[SetupVault] share failed', err);
              Alert.alert('Save failed', 'Unable to save recovery phrase.');
            }
          }}>
          <Text style={styles.buttonText}>Save / Export Recovery Phrase</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, {backgroundColor: '#10b981'}]}
          onPress={() => createVault(undefined)}>
          <Text style={styles.buttonText}>I Have Saved It — Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );


  const renderCreatingStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color="#38bdf8" />
      <Text style={[styles.title, {marginTop: 24}]}>Creating Vault...</Text>
      <Text style={styles.subtitle}>
        Encrypting your master key with Argon2...
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 'welcome' && renderWelcomeStep()}
        {step === 'permissions' && renderPermissionsStep()}
        {step === 'mnemonic' && renderMnemonicStep()}
        {/* PIN step removed; onboarding proceeds from mnemonic -> creating */}
        {step === 'creating' && renderCreatingStep()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stepContainer: {
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#38bdf8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  highlightCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  highlightTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  highlightCopy: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  mnemonicContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  wordBadge: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  wordIndex: {
    color: '#64748b',
    marginRight: 8,
    fontSize: 14,
  },
  wordText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    width: '100%',
    maxWidth: 240,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: 'bold',
    padding: 16,
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
});

export default SetupVaultScreen;
