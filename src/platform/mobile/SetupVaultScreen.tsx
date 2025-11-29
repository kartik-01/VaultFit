import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import HealthCollector from '../../../modules/health-collector';
import {KeyManager} from '../../services/crypto/KeyManager';
import {File, Paths} from 'expo-file-system';

interface SetupVaultScreenProps {
  onVaultCreated: (sessionKey: string) => void;
}

type Step = 'welcome' | 'permissions' | 'mnemonic' | 'pin' | 'creating';

const SetupVaultScreen: React.FC<SetupVaultScreenProps> = ({
  onVaultCreated,
}) => {
  const [step, setStep] = useState<Step>('welcome');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [pin, setPin] = useState('');
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

  const handlePinChange = async (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setPin(cleaned);
    if (cleaned.length === 6) {
      await createVault(cleaned);
    }
  };

  const createVault = async (finalPin: string) => {
    setStep('creating');
    const start = Date.now();
    try {
      const sessionKey = await KeyManager.initializeVault(mnemonic, finalPin);
      const elapsed = Date.now() - start;
      if (elapsed < 3000) {
        await new Promise(resolve => setTimeout(resolve, 3000 - elapsed));
      }
      onVaultCreated(sessionKey);
    } catch (error) {
      Alert.alert('Error', 'Failed to create vault. Please try again.');
      setStep('pin');
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
        you forget your PIN.
      </Text>

      <View style={styles.actionsRowCentered}>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={async () => {
            try {
              // Try Expo Clipboard first
              try {
                const ExpoClipboard = require('expo-clipboard');
                if (ExpoClipboard && typeof ExpoClipboard.setStringAsync === 'function') {
                  await ExpoClipboard.setStringAsync(mnemonic);
                  Alert.alert('Copied', 'Recovery phrase copied to clipboard');
                  return;
                }
              } catch (e) {
                // ignore
              }

              // Fallback to React Native Clipboard
              try {
                const RN = require('react-native');
                if (RN && RN.Clipboard && typeof RN.Clipboard.setString === 'function') {
                  RN.Clipboard.setString(mnemonic);
                  Alert.alert('Copied', 'Recovery phrase copied to clipboard, please paste it somewhere safe.');
                  return;
                }
              } catch (e) {
                // ignore
              }

              Alert.alert('Copy failed', 'Clipboard API not available');
            } catch (err: any) {
              Alert.alert('Copy failed', String(err));
            }
          }}>
          <Text style={styles.smallButtonText}>Copy</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR</Text>

        <TouchableOpacity
          style={styles.smallButton}
          onPress={async () => {
            try {
              const filename = `vaultfit-recovery-${Date.now()}.txt`;
              const outFile = new File(Paths.document, filename);
              await outFile.create({overwrite: true});
              await outFile.write(mnemonic);
              const outPath = outFile.uri ?? `${Paths.document}/${filename}`;

              try {
                let SharingModule: any = null;
                try {
                  SharingModule = require('expo-sharing');
                } catch (reqErr) {
                  SharingModule = null;
                }

                if (SharingModule && typeof SharingModule.isAvailableAsync === 'function') {
                  const available = await SharingModule.isAvailableAsync();
                  if (available && typeof SharingModule.shareAsync === 'function') {
                    await SharingModule.shareAsync(outPath);
                    return;
                  }
                }

                // Fallback to React Native Share
                try {
                  const {Share} = require('react-native');
                  await Share.share({url: outPath});
                  return;
                } catch (rnShareErr) {
                  // final fallback: show path
                }

                Alert.alert('Saved', outPath);
              } catch (shareErr) {
                Alert.alert('Saved', outPath);
              }
            } catch (err: any) {
              console.error('[SetupVault] export failed', err);
              Alert.alert('Export failed', String(err));
            }
          }}>
          <Text style={styles.smallButtonText}>Download</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mnemonicContainer}>
        {mnemonic.split(' ').map((word, index) => (
          <View key={index} style={styles.wordBadge}>
            <Text style={styles.wordIndex}>{index + 1}</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, {marginTop: 12}]}
        onPress={() => setStep('pin')}>
        <Text style={styles.buttonText}>I Have Saved It</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPinStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.icon}>🛡️</Text>
      <Text style={styles.title}>Create PIN</Text>
      <Text style={styles.subtitle}>
        Set a 6-digit PIN to secure your vault.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={handlePinChange}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          placeholder="••••••"
          placeholderTextColor="#64748b"
          autoFocus
        />
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
        {step === 'pin' && renderPinStep()}
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
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 20,
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
    marginTop: 18,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  smallButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  smallButtonText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  actionsRowCentered: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  orText: {
    color: '#94a3b8',
    marginHorizontal: 8,
    fontWeight: '700',
  },
});

export default SetupVaultScreen;
