import {LinearGradient} from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface WelcomeScreenProps {
  syncing: boolean;
  onConnect: () => void;
  error?: string | null;
}

const features = [
  {
    title: 'Zero-Knowledge Vault',
    caption: 'Your Health data stays local, encrypted end-to-end.',
  },
  {
    title: 'Real-Time Insights',
    caption: 'Sync Apple Health metrics in seconds.',
  },
  {
    title: 'Beautiful Visuals',
    caption: 'Modern glass cards optimized for iOS.',
  },
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  syncing,
  onConnect,
  error,
}) => {
  return (
    <LinearGradient
      colors={["#020617", "#041229", "#052b3f"]}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.badge}>End-to-End Encrypted Health Data</Text>
        <Text style={styles.title}>Your Health Data, Beautifully Private</Text>
        <Text style={styles.subtitle}>
          VaultFit transforms raw Apple Health metrics into live readiness cards,
          stored locally with SQLCipher so only you can unlock them.
        </Text>


        <View style={styles.featuresRow}>
          {features.map(feature => (
            <View key={feature.title} style={styles.glassCard}>
              <Text style={styles.cardTitle}>{feature.title}</Text>
              <Text style={styles.cardCaption}>{feature.caption}</Text>
            </View>
          ))}
        </View>

                <TouchableOpacity
          activeOpacity={0.9}
          onPress={onConnect}
          disabled={syncing}
          style={styles.ctaWrapper}>
          <LinearGradient
            colors={["#2dd4bf", "#06b6d4", "#2563eb"]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.ctaButton}>
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaLabel}>Get Started</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </LinearGradient>
  );
};

const gradientByIndex = (index: number): string => {
  const palette = ['#34d399', '#22d3ee', '#60a5fa'];
  return palette[index % palette.length];
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
    borderRadius: 999,
    borderWidth: 1,
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  barFill: {
    borderRadius: 12,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  barTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    flex: 1,
    marginHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cardCaption: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    gap: 24,
    padding: 24,
  },
  ctaButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: '100%',
  },
  ctaLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  ctaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  glassCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minWidth: '48%',
    padding: 16,
  },
  previewBars: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
  },
  previewCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  previewCopy: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(226, 232, 240, 0.85)',
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
});

export default WelcomeScreen;
