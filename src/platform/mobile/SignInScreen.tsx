import React, {useState} from 'react';
import {View, Text, StyleSheet, TextInput, TouchableOpacity, Alert} from 'react-native';
import {supabaseAuth} from '../../services/supabase';

interface Props {
  onAuthSuccess: () => void;
}

const SignInScreen: React.FC<Props> = ({onAuthSuccess}) => {
  const [email, setEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const signInWithEmail = async () => {
    setLoading(true);
    setInfo(null);
    try {
      await supabaseAuth.signInWithEmail(email);
      setInfo(
        'Magic link sent. Please check your email and follow the link. If you opened the link on this device, return to the app and tap the Continue button. If the link opened in a browser on another device, open the email on this device and tap the link.'
      );
    } catch (err) {
      console.warn('[VaultFit] signInWithEmail error', err);
      Alert.alert('Sign-in error', 'Unable to send magic link.');
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    setLoading(true);
    try {
      const user = await supabaseAuth.getUser();
      if (user) {
        onAuthSuccess();
      } else {
        Alert.alert('Not signed in', 'We did not detect an active session yet.');
      }
    } catch (err) {
      console.warn('[VaultFit] checkSession error', err);
      Alert.alert('Error', 'Unable to check session.');
    } finally {
      setLoading(false);
    }
  };

  // Dev password sign-in removed — app uses magic links only.

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create or sign in to your VaultFit account</Text>

      <Text style={styles.label}>Email (magic link)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.button} onPress={signInWithEmail} disabled={loading || !email}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send Magic Link'}</Text>
      </TouchableOpacity>

      {info ? <Text style={styles.info}>{info}</Text> : null}

      <TouchableOpacity style={[styles.button, styles.checkButton]} onPress={checkSession} disabled={loading}>
        <Text style={styles.buttonText}>I clicked the link — Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#f8fafc',
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  checkButton: {
    backgroundColor: '#60a5fa',
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  info: {
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default SignInScreen;
