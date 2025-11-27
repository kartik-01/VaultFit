import React, {useEffect, useState} from 'react';
import {Platform, Linking} from 'react-native';
import {View, Text, StyleSheet, Button} from 'react-native';
import {supabaseAuth} from '../../services/supabase';

const AuthCallbackWeb: React.FC = () => {
  const [status, setStatus] = useState('Processing authentication...');
  const [fragment, setFragment] = useState<string | null>(null);
  const [autoOpening, setAutoOpening] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = window.location.hash || '';
    setFragment(hash || null);
    (async () => {
      try {
        if (!hash) {
          setStatus('No authentication fragment found in the URL.');
          return;
        }
        setStatus('Applying session from callback...');
        // Use helper to set session from fragment (parses access/refresh tokens)
        await supabaseAuth.setSessionFromFragment(hash);
        setStatus('Verified — session stored. Opening the app...');
        // Attempt to open the native app automatically. Keep a visible fallback button
        // in case the browser blocks automatic navigation.
        setAutoOpening(true);
        const appLink = `vaultfit://auth/callback${hash}`;
        // Try a direct navigation first (works on many mobile browsers).
        try {
          window.location.href = appLink;
        } catch (e) {
          // ignore and try iframe fallback below
        }
        // As an additional attempt, create a temporary iframe (some browsers allow this).
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = appLink;
          document.body.appendChild(iframe);
          setTimeout(() => {
            try { document.body.removeChild(iframe); } catch (_) {}
          }, 1500);
        } catch (e) {
          // ignore
        }
        // After a short wait, stop showing the auto-opening indicator so the button appears.
        setTimeout(() => setAutoOpening(false), 1500);
      } catch (err) {
        console.warn('[VaultFit] AuthCallback error', err);
        setStatus('Failed to apply session; please try again or copy the fragment to the app.');
      }
    })();
  }, []);

  const openApp = () => {
    if (!fragment) return;
    const appLink = `vaultfit://auth/callback${fragment}`;
    // On web, setting window.location will attempt to open the app.
    try {
      window.location.href = appLink;
    } catch (e) {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VaultFit — Authentication</Text>
      <Text style={styles.status}>{status}</Text>
      {fragment ? (
        <View style={{marginTop: 12}}>
          <Text style={styles.label}>Deep link (copy/paste):</Text>
          <Text style={styles.mono}>{`vaultfit://auth/callback${fragment}`}</Text>
          <View style={{marginTop: 12}}>
            {autoOpening ? (
              <Text style={styles.status}>Opening the app…</Text>
            ) : (
              <Button title="Open VaultFit" onPress={openApp} />
            )}
          </View>
        </View>
      ) : null}
      <Text style={styles.note}>If the app does not open automatically, install the VaultFit build that registers the URL scheme.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#020617'},
  title: {color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 12},
  status: {color: '#cbd5f5', textAlign: 'center'},
  label: {color: '#94a3b8', marginTop: 8},
  mono: {color: '#94a3b8', marginTop: 6, fontFamily: 'monospace'},
  note: {color: '#64748b', marginTop: 18, textAlign: 'center'},
});

export default AuthCallbackWeb;
