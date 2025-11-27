import {LinearGradient} from 'expo-linear-gradient';
import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {HealthCollectorPayload} from '../../modules/health-collector';

export interface SnapshotHistoryItem {
  id: string;
  timestamp: number;
  type: string;
  payload: HealthCollectorPayload | null;
}

interface DashboardScreenProps {
  snapshot: HealthCollectorPayload | null;
  history: SnapshotHistoryItem[];
  refreshing: boolean;
  onRefresh: () => void;
  error?: string | null;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({
  snapshot,
  history,
  refreshing,
  onRefresh,
  error,
}) => {
  const metrics = useMemo(() => buildMetricRows(snapshot), [snapshot]);
  const lastSync = snapshot?.lastSync ?? history[0]?.timestamp;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={["#0f172a", "#0b253d", "#052d44"]}
        style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroBadge}>Synced Securely</Text>
            <Text style={styles.heroTitle}>Private Readiness Dashboard</Text>
            <Text style={styles.heroCopy}>
              Live vitals, workouts, and recovery factors rendered entirely on
              device.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={onRefresh}
            activeOpacity={0.85}
            disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.syncLabel}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.lastSyncLabel}>
          Last sync · {lastSync ? formatRelativeDate(lastSync) : 'pending'}
        </Text>
      </LinearGradient>

      <View style={styles.metricGrid}>
        {metrics.map(metric => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </View>

      <InsightPanel snapshot={snapshot} />

      <HistoryPanel history={history} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  colors: [string, string];
}

const MetricCard: React.FC<MetricCardProps> = ({label, value, helper, colors}) => (
  <LinearGradient colors={colors} style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricHelper}>{helper}</Text>
  </LinearGradient>
);

const InsightPanel: React.FC<{snapshot: HealthCollectorPayload | null}> = ({
  snapshot,
}) => (
  <View style={styles.insightCard}>
    <Text style={styles.sectionTitle}>Vitals focus</Text>
    {snapshot ? (
      <View style={styles.vitalsRow}>
        <VitalStat
          label="Resting HR"
          value={formatNumber(snapshot.restingHeartRate)}
          unit="bpm"
        />
        <VitalStat
          label="VO₂ Max"
          value={formatNumber(snapshot.vo2Max)}
          unit="ml/kg/min"
        />
        <VitalStat
          label="HRV"
          value={formatNumber(snapshot.heartRateVariability)}
          unit="ms"
        />
      </View>
    ) : (
      <Text style={styles.placeholderText}>Sync to unlock precision vitals.</Text>
    )}
    <TrendChart samples={snapshot?.heartRate ?? []} />
  </View>
);

const VitalStat: React.FC<{label: string; value: string; unit: string}> = ({
  label,
  value,
  unit,
}) => (
  <View style={styles.vitalStat}>
    <Text style={styles.vitalLabel}>{label}</Text>
    <Text style={styles.vitalValue}>
      {value}
      <Text style={styles.vitalUnit}> {unit}</Text>
    </Text>
  </View>
);

const TrendChart: React.FC<{samples: {timestamp: number; value: number}[]}> = ({
  samples,
}) => {
  const normalized = samples.slice(0, 10).map(sample => sample.value);
  if (normalized.length === 0) {
    return <Text style={styles.placeholderText}>No heart trend captured yet.</Text>;
  }

  const maxValue = Math.max(...normalized) || 1;
  const chartHeight = 80;

  return (
    <View style={styles.trendRow}>
      {normalized.map((value, idx) => (
        <View key={idx} style={styles.trendTrack}>
          <View
            style={[
              styles.trendFill,
              {height: Math.max(8, (value / maxValue) * chartHeight)},
            ]}
          />
        </View>
      ))}
    </View>
  );
};

const HistoryPanel: React.FC<{history: SnapshotHistoryItem[]}> = ({history}) => {
  const latestFive = history.slice(0, 5);

  return (
    <View style={styles.historyCard}>
      <Text style={styles.sectionTitle}>Encrypted timeline</Text>
      {latestFive.length === 0 ? (
        <Text style={styles.placeholderText}>No sessions stored yet.</Text>
      ) : (
        latestFive.map(entry => (
          <View key={entry.id} style={styles.historyRow}>
            <View>
              <Text style={styles.historyLabel}>
                {entry.payload?.workouts?.[0]?.type ?? 'Health Snapshot'}
              </Text>
              <Text style={styles.historyMeta}>
                {formatRelativeDate(entry.timestamp)}
              </Text>
            </View>
            <Text style={styles.historyValue}>
              {entry.payload ? formatNumber(entry.payload.steps) : '•••'} steps
            </Text>
          </View>
        ))
      )}
    </View>
  );
};

const buildMetricRows = (
  snapshot: HealthCollectorPayload | null,
): MetricCardProps[] => {
  const calories =
    (snapshot?.activeEnergyBurned ?? 0) + (snapshot?.basalEnergyBurned ?? 0);

  return [
    {
      label: 'Steps',
      value: formatNumber(snapshot?.steps ?? 0),
      helper: '24h rolling',
      colors: ['#1d4ed8', '#1e40af'],
    },
    {
      label: 'Heart',
      value: `${formatNumber(snapshot?.heartRate?.[0]?.value ?? 0)} bpm`,
      helper: 'recent sample',
      colors: ['#be185d', '#db2777'],
    },
    {
      label: 'Distance',
      value: `${formatNumber(snapshot?.distance ?? 0)} km`,
      helper: 'since midnight',
      colors: ['#0f766e', '#115e59'],
    },
    {
      label: 'Calories',
      value: `${formatNumber(calories)} kcal`,
      helper: 'active + basal',
      colors: ['#ea580c', '#c2410c'],
    },
  ];
};

const formatNumber = (value: number): string => {
  if (!value) return '0';
  return Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value);
};

const formatRelativeDate = (timestamp: number): string => {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return date.toLocaleString();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  heroBadge: {
    color: '#bae6fd',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
  },
  heroCopy: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: 15,
    marginTop: 8,
    maxWidth: 240,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 22,
    padding: 20,
  },
  historyLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  historyMeta: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 13,
    marginTop: 4,
  },
  historyRow: {
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  historyValue: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '600',
  },
  insightCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 24,
    padding: 20,
  },
  lastSyncLabel: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: 13,
    marginTop: 18,
  },
  metricCard: {
    borderRadius: 20,
    padding: 18,
    flexBasis: '48%',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricHelper: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  metricLabel: {
    color: 'rgba(248, 250, 252, 0.9)',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 6,
  },
  placeholderText: {
    color: 'rgba(148, 163, 184, 0.8)',
    fontSize: 14,
    marginTop: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  syncLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  trendFill: {
    backgroundColor: '#38bdf8',
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  trendRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
  },
  trendTrack: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderRadius: 999,
    flex: 1,
    height: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  vitalLabel: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  vitalStat: {
    flex: 1,
  },
  vitalUnit: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  vitalValue: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default DashboardScreen;
