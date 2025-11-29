import React, {useState, useRef, useEffect} from 'react';
import {View, Text, StyleSheet, TextInput, TouchableOpacity, Alert} from 'react-native';
import {supabaseAuth} from '../../services/supabase';

interface Props {
  onAuthSuccess: () => void;
}

const SignInScreen: React.FC<Props> = ({onAuthSuccess}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [step, setStep] = useState<'enterEmail' | 'enterCode'>('enterEmail');
  const [resendSecs, setResendSecs] = useState(0);
  const resendTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current as any);
        resendTimerRef.current = null;
      }
    };
  }, []);

  const startResendTimer = (secs = 30) => {
    setResendSecs(secs);
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current as any);
    }
    resendTimerRef.current = setInterval(() => {
      setResendSecs(s => {
        if (s <= 1) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current as any);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000) as unknown as number;
  };

  const sendOtp = async () => {
    if (!email) return Alert.alert('Email required', 'Please enter your email address');
    setLoading(true);
    setInfo(null);
    try {
      const resp = await supabaseAuth.sendEmailOtp(email, true);
      // Log the full response for debugging template/delivery issues
      // eslint-disable-next-line no-console
      console.debug('[VaultFit] sendOtp response', resp);
      if (resp?.error) {
        console.warn('[VaultFit] sendOtp error', resp.error);
        Alert.alert('Error sending code', resp.error.message || 'Unable to send code');
      } else {
        setStep('enterCode');
        setInfo('Code sent — check your email (it may take a minute).');
        startResendTimer(30);
      }
    } catch (err) {
      console.warn('[VaultFit] sendOtp failed', err);
      Alert.alert('Error', 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Legacy manual session check removed — OTP flow handles verification now

  const verifyOtp = async () => {
    if (code.length < 4) return Alert.alert('Enter code', 'Please enter the 6-digit code');
    setLoading(true);
    try {
      const resp = await supabaseAuth.verifyEmailOtp(email, code);
      if (resp?.error) {
        console.warn('[VaultFit] verifyOtp error', resp.error);
        Alert.alert('Invalid code', resp.error.message || 'Unable to verify code');
      } else {
        // Success — Supabase has set the session in storage
        onAuthSuccess();
      }
    } catch (err) {
      console.warn('[VaultFit] verifyOtp failed', err);
      Alert.alert('Error', 'Unable to verify code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to VaultFit</Text>

      {step === 'enterEmail' ? (
        <>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading || !email}>
            <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send code'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter the code we sent to</Text>
          <Text style={{color: '#cbd5f5', marginBottom: 8}}>{email}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
            placeholderTextColor="#64748b"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={loading || !code}>
            <Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify code'}</Text>
          </TouchableOpacity>

          <View style={{flexDirection: 'row', justifyContent: 'center', marginTop: 12}}>
            <TouchableOpacity onPress={() => { setStep('enterEmail'); setCode(''); }}>
              <Text style={{color: '#94a3b8'}}>Change email</Text>
            </TouchableOpacity>
            <View style={{width: 18}} />
            <TouchableOpacity onPress={sendOtp} disabled={resendSecs > 0}>
              <Text style={{color: resendSecs > 0 ? '#475569' : '#94a3b8'}}>
                {resendSecs > 0 ? `Resend in ${resendSecs}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {info ? <Text style={styles.info}>{info}</Text> : null}

      {/* Legacy manual link-check flow removed — OTP flow handles verification now */}
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
